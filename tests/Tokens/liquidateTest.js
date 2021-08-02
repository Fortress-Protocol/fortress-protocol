const {
  bnbGasCost,
  bnbUnsigned
} = require('../Utils/BSC');

const {
  makeFToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/Fortress');

const repayAmount = bnbUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced

async function preLiquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral) {
  // setup for success in liquidating
  await send(fToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(fToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(fToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(fToken.comptroller, 'setSeizeAllowed', [true]);
  await send(fToken.comptroller, 'setSeizeVerify', [true]);
  await send(fToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(fTokenCollateral, liquidator, 0);
  await setBalance(fTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(fTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(fToken, borrower, 1, 1, repayAmount);
  await preApprove(fToken, liquidator, repayAmount);
}

async function liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral) {
  return send(fToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, fTokenCollateral._address]);
}

async function liquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(fToken, 1);
  await fastForward(fTokenCollateral, 1);
  return send(fToken, 'liquidateBorrow', [borrower, repayAmount, fTokenCollateral._address], {from: liquidator});
}

async function seize(fToken, liquidator, borrower, seizeAmount) {
  return send(fToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('FToken', function () {
  let root, liquidator, borrower, accounts;
  let fToken, fTokenCollateral;

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    fToken = await makeFToken({comptrollerOpts: {kind: 'bool'}});
    fTokenCollateral = await makeFToken({comptroller: fToken.comptroller});
  });

  beforeEach(async () => {
    await preLiquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(fToken.comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(fToken);
      expect(
        await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(fToken);
      await fastForward(fTokenCollateral);
      await send(fToken, 'accrueInterest');
      expect(
        await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(fToken, borrower, borrower, repayAmount, fTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(fToken, liquidator, borrower, 0, fTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      await send(fToken.comptroller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(fToken.comptroller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(fToken.comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("reverts if liquidateBorrowVerify fails", async() => {
      await send(fToken.comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(fToken, liquidator, borrower, repayAmount, fTokenCollateral);
      const afterBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        fTokenCollateral: fTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: fToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fToken, 'cash', repayAmount],
        [fToken, 'borrows', -repayAmount],
        [fToken, liquidator, 'cash', -repayAmount],
        [fTokenCollateral, liquidator, 'tokens', seizeTokens],
        [fToken, borrower, 'borrows', -repayAmount],
        [fTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(fTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(fToken, liquidator, borrower, 0, fTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(fToken, liquidator, borrower, repayAmount, fTokenCollateral);
      const gasCost = await bnbGasCost(result);
      const afterBalances = await getBalances([fToken, fTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fToken, 'cash', repayAmount],
        [fToken, 'borrows', -repayAmount],
        [fToken, liquidator, 'bnb', -gasCost],
        [fToken, liquidator, 'cash', -repayAmount],
        [fTokenCollateral, liquidator, 'bnb', -gasCost],
        [fTokenCollateral, liquidator, 'tokens', seizeTokens],
        [fToken, borrower, 'borrows', -repayAmount],
        [fTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(fToken.comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(fTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if fTokenBalances[borrower] < amount", async () => {
      await setBalance(fTokenCollateral, borrower, 1);
      expect(await seize(fTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if fTokenBalances[liquidator] overflows", async () => {
      await setBalance(fTokenCollateral, liquidator, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      expect(await seize(fTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalances([fTokenCollateral], [liquidator, borrower]);
      const result = await seize(fTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([fTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Transfer', {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fTokenCollateral, liquidator, 'tokens', seizeTokens],
        [fTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });
});
