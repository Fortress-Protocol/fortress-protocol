const {
  makeComptroller,
  makeFToken,
  enterMarkets,
  quickMint
} = require('../Utils/Fortress');

describe('Comptroller', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('liquidity', () => {
    it("fails if a price has not been set", async () => {
      const fToken = await makeFToken({supportMarket: true});
      await enterMarkets([fToken], accounts[1]);
      let result = await call(fToken.comptroller, 'getAccountLiquidity', [accounts[1]]);
      expect(result).toHaveTrollError('PRICE_ERROR');
    });

    it("allows a borrow up to collateralFactor, but not more", async () => {
      const collateralFactor = 0.5, underlyingPrice = 1, user = accounts[1], amount = 1e6;
      const fToken = await makeFToken({supportMarket: true, collateralFactor, underlyingPrice});

      let error, liquidity, shortfall;

      // not in market yet, hypothetical borrow should have no effect
      ({1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken._address, 0, amount]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);

      await enterMarkets([fToken], user);
      await quickMint(fToken, user, amount);

      // total account liquidity after supplying `amount`
      ({1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getAccountLiquidity', [user]));
      expect(liquidity).toEqualNumber(amount * collateralFactor);
      expect(shortfall).toEqualNumber(0);

      // hypothetically borrow `amount`, should shortfall over collateralFactor
      ({1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken._address, 0, amount]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(amount * (1 - collateralFactor));

      // hypothetically redeem `amount`, should be back to even
      ({1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken._address, amount, 0]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    }, 20000);

    it("allows entering 3 markets, supplying to 2 and borrowing up to collateralFactor in the 3rd", async () => {
      const amount1 = 1e6, amount2 = 1e3, user = accounts[1];
      const cf1 = 0.5, cf2 = 0.666, cf3 = 0, up1 = 3, up2 = 2.718, up3 = 1;
      const c1 = amount1 * cf1 * up1, c2 = amount2 * cf2 * up2, collateral = Math.floor(c1 + c2);
      const fToken1 = await makeFToken({supportMarket: true, collateralFactor: cf1, underlyingPrice: up1});
      const fToken2 = await makeFToken({supportMarket: true, comptroller: fToken1.comptroller, collateralFactor: cf2, underlyingPrice: up2});
      const fToken3 = await makeFToken({supportMarket: true, comptroller: fToken1.comptroller, collateralFactor: cf3, underlyingPrice: up3});

      await enterMarkets([fToken1, fToken2, fToken3], user);
      await quickMint(fToken1, user, amount1);
      await quickMint(fToken2, user, amount2);

      let error, liquidity, shortfall;

      ({0: error, 1: liquidity, 2: shortfall} = await call(fToken3.comptroller, 'getAccountLiquidity', [user]));
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(collateral);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(fToken3.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken3._address, Math.floor(c2), 0]));
      expect(liquidity).toEqualNumber(collateral);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(fToken3.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken3._address, 0, Math.floor(c2)]));
      expect(liquidity).toEqualNumber(c1);
      expect(shortfall).toEqualNumber(0);

      ({1: liquidity, 2: shortfall} = await call(fToken3.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken3._address, 0, collateral + c1]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(c1);

      ({1: liquidity, 2: shortfall} = await call(fToken1.comptroller, 'getHypotheticalAccountLiquidity', [user, fToken1._address, amount1, 0]));
      expect(liquidity).toEqualNumber(Math.floor(c2));
      expect(shortfall).toEqualNumber(0);
    });
  }, 20000);

  describe("getAccountLiquidity", () => {
    it("returns 0 if not 'in' any markets", async () => {
      const comptroller = await makeComptroller();
      const {0: error, 1: liquidity, 2: shortfall} = await call(comptroller, 'getAccountLiquidity', [accounts[0]]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    });
  });

  describe("getHypotheticalAccountLiquidity", () => {
    it("returns 0 if not 'in' any markets", async () => {
      const fToken = await makeFToken();
      const {0: error, 1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getHypotheticalAccountLiquidity', [accounts[0], fToken._address, 0, 0]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber(0);
    });

    it("returns collateral factor times dollar amount of tokens minted in a single market", async () => {
      const collateralFactor = 0.5, exchangeRate = 1, underlyingPrice = 1;
      const fToken = await makeFToken({supportMarket: true, collateralFactor, exchangeRate, underlyingPrice});
      const from = accounts[0], balance = 1e7, amount = 1e6;
      await enterMarkets([fToken], from);
      await send(fToken.underlying, 'harnessSetBalance', [from, balance], {from});
      await send(fToken.underlying, 'approve', [fToken._address, balance], {from});
      await send(fToken, 'mint', [amount], {from});
      const {0: error, 1: liquidity, 2: shortfall} = await call(fToken.comptroller, 'getHypotheticalAccountLiquidity', [from, fToken._address, 0, 0]);
      expect(error).toEqualNumber(0);
      expect(liquidity).toEqualNumber(amount * collateralFactor * exchangeRate * underlyingPrice);
      expect(shortfall).toEqualNumber(0);
    });
  });
});
