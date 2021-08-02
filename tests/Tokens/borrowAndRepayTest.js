const {
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');

const {
  makeFToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/Fortress');

const borrowAmount = bnbUnsigned(10e3);
const repayAmount = bnbUnsigned(10e2);

async function preBorrow(fToken, borrower, borrowAmount) {
  await send(fToken.comptroller, 'setBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setBorrowVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken.underlying, 'harnessSetBalance', [fToken._address, borrowAmount]);
  await send(fToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(fToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(fToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(fToken, borrower, borrowAmount) {
  return send(fToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(fToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(fToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(fToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(fToken, borrower, 1, 1, repayAmount);
  await preApprove(fToken, benefactor, repayAmount);
  await preApprove(fToken, borrower, repayAmount);
}

async function repayBorrowFresh(fToken, payer, borrower, repayAmount) {
  return send(fToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(fToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(fToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('FToken', function () {
  let fToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    fToken = await makeFToken({comptrollerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(fToken, borrower, borrowAmount));

    it("fails if comptroller tells it to", async () => {
      await send(fToken.comptroller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(fToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_COMPTROLLER_REJECTION');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await borrowFresh(fToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(fToken);
      expect(await borrowFresh(fToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(fToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(fToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(fToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(fToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(fToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(fToken, borrower, 1e-18, 1e-18, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      expect(await borrowFresh(fToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(fToken, 'harnessSetTotalBorrows', ['0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF']);
      expect(await borrowFresh(fToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(fToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(fToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("reverts if borrowVerify fails", async() => {
      await send(fToken.comptroller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(fToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(fToken.underlying, fToken._address);
      const beforeProtocolBorrows = await totalBorrows(fToken);
      const beforeAccountCash = await balanceOf(fToken.underlying, borrower);
      const result = await borrowFresh(fToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(fToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
      expect(await balanceOf(fToken.underlying, fToken._address)).toEqualNumber(beforeProtocolCash.sub(borrowAmount));
      expect(await totalBorrows(fToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: fToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.add(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(fToken);
      await pretendBorrow(fToken, borrower, 0, 3, 0);
      await borrowFresh(fToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(fToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(bnbMantissa(3));
      expect(await totalBorrows(fToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(fToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(fToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(fToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(fToken.underlying, borrower);
      await fastForward(fToken);
      expect(await borrow(fToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(fToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
          await preRepay(fToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(fToken.comptroller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(fToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_COMPTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(fToken);
          expect(await repayBorrowFresh(fToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it("fails if insufficient approval", async() => {
          await preApprove(fToken, payer, 1);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(fToken.underlying, payer, 1);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(fToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(fToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(fToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(fToken.underlying, fToken._address);
          const result = await repayBorrowFresh(fToken, payer, borrower, repayAmount);
          expect(await balanceOf(fToken.underlying, fToken._address)).toEqualNumber(beforeProtocolCash.add(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: fToken._address,
            amount: repayAmount.toString()
          });
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(fToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
          expect(await repayBorrowFresh(fToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(fToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(bnbMantissa(1));
          expect(await totalBorrows(fToken)).toEqualNumber(beforeProtocolBorrows.sub(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(fToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(fToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(fToken.underlying, borrower, 1);
      await expect(repayBorrow(fToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(fToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(await repayBorrow(fToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(fToken);
      expect(await repayBorrow(fToken, borrower, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(fToken.underlying, borrower, 3);
      await fastForward(fToken);
      await expect(repayBorrow(fToken, borrower, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(fToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(fToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(fToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(fToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(await repayBorrowBehalf(fToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });
  });
});
