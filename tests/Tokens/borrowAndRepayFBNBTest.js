const {
  bnbGasCost,
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
  pretendBorrow,
  setBNBBalance,
  getBalances,
  adjustBalances
} = require('../Utils/Fortress');

const BigNumber = require('bignumber.js');

const borrowAmount = bnbUnsigned(10e3);
const repayAmount = bnbUnsigned(10e2);

async function preBorrow(fToken, borrower, borrowAmount) {
  await send(fToken.comptroller, 'setBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setBorrowVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(fToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(fToken, 'harnessSetTotalBorrows', [0]);
  await setBNBBalance(fToken, borrowAmount);
}

async function borrowFresh(fToken, borrower, borrowAmount) {
  return send(fToken, 'harnessBorrowFresh', [borrower, borrowAmount], {from: borrower});
}

async function borrow(fToken, borrower, borrowAmount, opts = {}) {
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(fToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(fToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await pretendBorrow(fToken, borrower, 1, 1, repayAmount);
}

async function repayBorrowFresh(fToken, payer, borrower, repayAmount) {
  return send(fToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer, value: repayAmount});
}

async function repayBorrow(fToken, borrower, repayAmount) {
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'repayBorrow', [], {from: borrower, value: repayAmount});
}

async function repayBorrowBehalf(fToken, payer, borrower, repayAmount) {
  await send(fToken, 'harnessFastForward', [1]);
  return send(fToken, 'repayBorrowBehalf', [borrower], {from: payer, value: repayAmount});
}

describe('FBNB', function () {
  let fToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    fToken = await makeFToken({kind: 'fbnb', comptrollerOpts: {kind: 'bool'}});
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

    it("fails if protocol has less than borrowAmount of underlying", async () => {
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

    it("transfers the underlying cash, tokens, and emits Borrow event", async () => {
      const beforeBalances = await getBalances([fToken], [borrower]);
      const beforeProtocolBorrows = await totalBorrows(fToken);
      const result = await borrowFresh(fToken, borrower, borrowAmount);
      const afterBalances = await getBalances([fToken], [borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fToken, 'bnb', -borrowAmount],
        [fToken, 'borrows', borrowAmount],
        [fToken, borrower, 'bnb', borrowAmount.sub(await bnbGasCost(result))],
        [fToken, borrower, 'borrows', borrowAmount]
      ]));
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
      await send(fToken, 'harnessFastForward', [1]);
      await expect(borrow(fToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(fToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeBalances = await getBalances([fToken], [borrower]);
      await fastForward(fToken);
      const result = await borrow(fToken, borrower, borrowAmount);
      const afterBalances = await getBalances([fToken], [borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fToken, 'bnb', -borrowAmount],
        [fToken, 'borrows', borrowAmount],
        [fToken, borrower, 'bnb', borrowAmount.sub(await bnbGasCost(result))],
        [fToken, borrower, 'borrows', borrowAmount]
      ]));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach(async (benefactorPaying) => {
      let payer;
      const label = benefactorPaying ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorPaying ? benefactor : borrower;

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

        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(fToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert('revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(fToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert('revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
        });

        it("reverts if checkTransferIn fails", async () => {
          await expect(
            send(fToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: root, value: repayAmount})
          ).rejects.toRevert("revert sender mismatch");
          await expect(
            send(fToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer, value: 1})
          ).rejects.toRevert("revert value mismatch");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(fToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits RepayBorrow event", async () => {
          const beforeBalances = await getBalances([fToken], [borrower]);
          const result = await repayBorrowFresh(fToken, payer, borrower, repayAmount);
          const afterBalances = await getBalances([fToken], [borrower]);
          expect(result).toSucceed();
          if (borrower == payer) {
            expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
              [fToken, 'bnb', repayAmount],
              [fToken, 'borrows', -repayAmount],
              [fToken, borrower, 'borrows', -repayAmount],
              [fToken, borrower, 'bnb', -repayAmount.add(await bnbGasCost(result))]
            ]));
          } else {
            expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
              [fToken, 'bnb', repayAmount],
              [fToken, 'borrows', -repayAmount],
              [fToken, borrower, 'borrows', -repayAmount],
            ]));
          }
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

    it("reverts if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(fToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("reverts when repay borrow fresh fails", async () => {
      await send(fToken.comptroller, 'setRepayBorrowAllowed', [false]);
      await expect(repayBorrow(fToken, borrower, repayAmount)).rejects.toRevertWithError('COMPTROLLER_REJECTION', "revert repayBorrow failed");
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(fToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(await repayBorrow(fToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("reverts if overpaying", async () => {
      const beforeAccountBorrowSnap = await borrowSnapshot(fToken, borrower);
      let tooMuch = new BigNumber(beforeAccountBorrowSnap.principal).plus(1);
      await expect(repayBorrow(fToken, borrower, tooMuch)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
      // await assert.toRevertWithError(repayBorrow(fToken, borrower, tooMuch), 'MATH_ERROR', "revert repayBorrow failed");
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(fToken, payer, borrower, repayAmount);
    });

    it("reverts if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(fToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("reverts from within repay borrow fresh", async () => {
      await send(fToken.comptroller, 'setRepayBorrowAllowed', [false]);
      await expect(repayBorrowBehalf(fToken, payer, borrower, repayAmount)).rejects.toRevertWithError('COMPTROLLER_REJECTION', "revert repayBorrowBehalf failed");
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
