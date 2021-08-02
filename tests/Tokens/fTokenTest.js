const {
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');

const {
  makeFToken,
  setBorrowRate,
  pretendBorrow
} = require('../Utils/Fortress');

describe('FToken', function () {
  let root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("fails when non bep-20 underlying", async () => {
      await expect(makeFToken({ underlying: { _address: root } })).rejects.toRevert("revert");
    });

    it("fails when 0 initial exchange rate", async () => {
      await expect(makeFToken({ exchangeRate: 0 })).rejects.toRevert("revert initial exchange rate must be greater than zero.");
    });

    it("succeeds with bep-20 underlying and non-zero exchange rate", async () => {
      const fToken = await makeFToken();
      expect(await call(fToken, 'underlying')).toEqual(fToken.underlying._address);
      expect(await call(fToken, 'admin')).toEqual(root);
    });

    it("succeeds when setting admin to contructor argument", async () => {
      const fToken = await makeFToken({ admin: admin });
      expect(await call(fToken, 'admin')).toEqual(admin);
    });
  });

  describe('name, symbol, decimals', () => {
    let fToken;

    beforeEach(async () => {
      fToken = await makeFToken({ name: "FToken Foo", symbol: "cFOO", decimals: 10 });
    });

    it('should return correct name', async () => {
      expect(await call(fToken, 'name')).toEqual("FToken Foo");
    });

    it('should return correct symbol', async () => {
      expect(await call(fToken, 'symbol')).toEqual("cFOO");
    });

    it('should return correct decimals', async () => {
      expect(await call(fToken, 'decimals')).toEqualNumber(10);
    });
  });

  describe('balanceOfUnderlying', () => {
    it("has an underlying balance", async () => {
      const fToken = await makeFToken({ supportMarket: true, exchangeRate: 2 });
      await send(fToken, 'harnessSetBalance', [root, 100]);
      expect(await call(fToken, 'balanceOfUnderlying', [root])).toEqualNumber(200);
    });
  });

  describe('borrowRatePerBlock', () => {
    it("has a borrow rate", async () => {
      const fToken = await makeFToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const blocksPerYear = await call(fToken.interestRateModel, 'blocksPerYear');
      const perBlock = await call(fToken, 'borrowRatePerBlock');
      expect(Math.abs(perBlock * blocksPerYear - 5e16)).toBeLessThanOrEqual(1e8);
    });
  });

  describe('supplyRatePerBlock', () => {
    it("returns 0 if there's no supply", async () => {
      const fToken = await makeFToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(fToken, 'supplyRatePerBlock');
      await expect(perBlock).toEqualNumber(0);
    });

    it("has a supply rate", async () => {
      const baseRate = 0.05;
      const multiplier = 0.45;
      const kink = 0.95;
      const jump = 5 * multiplier;
      const fToken = await makeFToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate, multiplier, kink, jump } });
      await send(fToken, 'harnessSetReserveFactorFresh', [bnbMantissa(.01)]);
      await send(fToken, 'harnessExchangeRateDetails', [1, 1, 0]);
      await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(1)]);
      // Full utilization (Over the kink so jump is included), 1% reserves
      const borrowRate = baseRate + multiplier * kink + jump * .05;
      const expectedSuplyRate = borrowRate * .99;

      const blocksPerYear = await call(fToken.interestRateModel, 'blocksPerYear');
      const perBlock = await call(fToken, 'supplyRatePerBlock');
      expect(Math.abs(perBlock * blocksPerYear - expectedSuplyRate * 1e18)).toBeLessThanOrEqual(1e8);
    });
  });

  describe("borrowBalanceCurrent", () => {
    let borrower;
    let fToken;

    beforeEach(async () => {
      borrower = accounts[0];
      fToken = await makeFToken();
    });

    beforeEach(async () => {
      await setBorrowRate(fToken, .001)
      await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
    });

    it("reverts if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      // make sure we accrue interest
      await send(fToken, 'harnessFastForward', [1]);
      await expect(send(fToken, 'borrowBalanceCurrent', [borrower])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns successful result from borrowBalanceStored with no interest", async () => {
      await setBorrowRate(fToken, 0);
      await pretendBorrow(fToken, borrower, 1, 1, 5e18);
      expect(await call(fToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18)
    });

    it("returns successful result from borrowBalanceCurrent with no interest", async () => {
      await setBorrowRate(fToken, 0);
      await pretendBorrow(fToken, borrower, 1, 3, 5e18);
      expect(await send(fToken, 'harnessFastForward', [5])).toSucceed();
      expect(await call(fToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18 * 3)
    });
  });

  describe("borrowBalanceStored", () => {
    let borrower;
    let fToken;

    beforeEach(async () => {
      borrower = accounts[0];
      fToken = await makeFToken({ comptrollerOpts: { kind: 'bool' } });
    });

    it("returns 0 for account with no borrows", async () => {
      expect(await call(fToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
    });

    it("returns stored principal when account and market indexes are the same", async () => {
      await pretendBorrow(fToken, borrower, 1, 1, 5e18);
      expect(await call(fToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18);
    });

    it("returns calculated balance when market index is higher than account index", async () => {
      await pretendBorrow(fToken, borrower, 1, 3, 5e18);
      expect(await call(fToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18 * 3);
    });

    it("has undefined behavior when market index is lower than account index", async () => {
      // The market index < account index should NEVER happen, so we don't test this case
    });

    it("reverts on overflow of principal", async () => {
      await pretendBorrow(fToken, borrower, 1, 3, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      await expect(call(fToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });

    it("reverts on non-zero stored principal with zero account index", async () => {
      await pretendBorrow(fToken, borrower, 0, 3, 5);
      await expect(call(fToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });
  });

  describe('exchangeRateStored', () => {
    let fToken, exchangeRate = 2;

    beforeEach(async () => {
      fToken = await makeFToken({ exchangeRate });
    });

    it("returns initial exchange rate with zero fTokenSupply", async () => {
      const result = await call(fToken, 'exchangeRateStored');
      expect(result).toEqualNumber(bnbMantissa(exchangeRate));
    });

    it("calculates with single fTokenSupply and single total borrow", async () => {
      const fTokenSupply = 1, totalBorrows = 1, totalReserves = 0;
      await send(fToken, 'harnessExchangeRateDetails', [fTokenSupply, totalBorrows, totalReserves]);
      const result = await call(fToken, 'exchangeRateStored');
      expect(result).toEqualNumber(bnbMantissa(1));
    });

    it("calculates with fTokenSupply and total borrows", async () => {
      const fTokenSupply = 100e18, totalBorrows = 10e18, totalReserves = 0;
      await send(fToken, 'harnessExchangeRateDetails', [fTokenSupply, totalBorrows, totalReserves].map(bnbUnsigned));
      const result = await call(fToken, 'exchangeRateStored');
      expect(result).toEqualNumber(bnbMantissa(.1));
    });

    it("calculates with cash and fTokenSupply", async () => {
      const fTokenSupply = 5e18, totalBorrows = 0, totalReserves = 0;
      expect(
        await send(fToken.underlying, 'transfer', [fToken._address, bnbMantissa(500)])
      ).toSucceed();
      await send(fToken, 'harnessExchangeRateDetails', [fTokenSupply, totalBorrows, totalReserves].map(bnbUnsigned));
      const result = await call(fToken, 'exchangeRateStored');
      expect(result).toEqualNumber(bnbMantissa(100));
    });

    it("calculates with cash, borrows, reserves and fTokenSupply", async () => {
      const fTokenSupply = 500e18, totalBorrows = 500e18, totalReserves = 5e18;
      expect(
        await send(fToken.underlying, 'transfer', [fToken._address, bnbMantissa(500)])
      ).toSucceed();
      await send(fToken, 'harnessExchangeRateDetails', [fTokenSupply, totalBorrows, totalReserves].map(bnbUnsigned));
      const result = await call(fToken, 'exchangeRateStored');
      expect(result).toEqualNumber(bnbMantissa(1.99));
    });
  });

  describe('getCash', () => {
    it("gets the cash", async () => {
      const fToken = await makeFToken();
      const result = await call(fToken, 'getCash');
      expect(result).toEqualNumber(0);
    });
  });
});
