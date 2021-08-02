const { address, bnbMantissa } = require('../Utils/BSC');

const { makeComptroller, makeFToken, makePriceOracle } = require('../Utils/Fortress');

describe('Comptroller', function() {
  let root, accounts;
  let unitroller;
  let brains;
  let oracle;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oracle = await makePriceOracle();
    brains = await deploy('Comptroller');
    unitroller = await deploy('Unitroller');
  });

  let initializeBrains = async (priceOracle, closeFactor, maxAssets) => {
    await send(unitroller, '_setPendingImplementation', [brains._address]);
    await send(brains, '_become', [unitroller._address]);
    const unitrollerAsBrain = await saddle.getContractAt('Comptroller', unitroller._address);
    await send(unitrollerAsBrain, '_setPriceOracle', [priceOracle._address]);
    await send(unitrollerAsBrain, '_setCloseFactor', [closeFactor]);
    await send(unitrollerAsBrain, '_setMaxAssets', [maxAssets]);
    await send(unitrollerAsBrain, '_setLiquidationIncentive', [bnbMantissa(1)]);
    return unitrollerAsBrain;
  };

  describe('delegating to comptroller', () => {
    const closeFactor = bnbMantissa(0.051);
    const maxAssets = 10;
    let unitrollerAsComptroller, fToken;

    beforeEach(async () => {
      unitrollerAsComptroller = await initializeBrains(oracle, bnbMantissa(0.06), 30);
      fToken = await makeFToken({ comptroller: unitrollerAsComptroller });
    });

    describe('becoming brains sets initial state', () => {
      it('reverts if this is not the pending implementation', async () => {
        await expect(
          send(brains, '_become', [unitroller._address])
        ).rejects.toRevert('revert not authorized');
      });

      it('on success it sets admin to caller of constructor', async () => {
        expect(await call(unitrollerAsComptroller, 'admin')).toEqual(root);
        expect(await call(unitrollerAsComptroller, 'pendingAdmin')).toBeAddressZero();
      });

      it('on success it sets closeFactor and maxAssets as specified', async () => {
        const comptroller = await initializeBrains(oracle, closeFactor, maxAssets);
        expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(maxAssets);
      });

      it('allows 0 maxAssets', async () => {
        const comptroller = await initializeBrains(oracle, closeFactor, 0);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(0);
      });

      it('allows 5000 maxAssets', async () => {
        // 5000 is an arbitrary number larger than what we expect to ever actually use
        const comptroller = await initializeBrains(oracle, closeFactor, 5000);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(5000);
      });
    });

    describe('_setCollateralFactor', () => {
      const half = bnbMantissa(0.5),
        one = bnbMantissa(1);

      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [fToken._address, half], {
            from: accounts[1]
          })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
      });

      it('fails if asset is not listed', async () => {
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [fToken._address, half])
        ).toHaveTrollFailure('MARKET_NOT_LISTED', 'SET_COLLATERAL_FACTOR_NO_EXISTS');
      });

      it('fails if factor is too high', async () => {
        const fToken = await makeFToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [fToken._address, one])
        ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
      });

      it('fails if factor is set without an underlying price', async () => {
        const fToken = await makeFToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [fToken._address, half])
        ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
      });

      it('succeeds and sets market', async () => {
        const fToken = await makeFToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        await send(oracle, 'setUnderlyingPrice', [fToken._address, 1]);
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [fToken._address, half])
        ).toHaveLog('NewCollateralFactor', {
          fToken: fToken._address,
          oldCollateralFactorMantissa: '0',
          newCollateralFactorMantissa: half.toString()
        });
      });
    });

    describe('_supportMarket', () => {
      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsComptroller, '_supportMarket', [fToken._address], { from: accounts[1] })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SUPPORT_MARKET_OWNER_CHECK');
      });

      it('fails if asset is not a FToken', async () => {
        const notAFToken = await makePriceOracle();
        await expect(send(unitrollerAsComptroller, '_supportMarket', [notAFToken._address])).rejects.toRevert();
      });

      it('succeeds and sets market', async () => {
        const result = await send(unitrollerAsComptroller, '_supportMarket', [fToken._address]);
        expect(result).toHaveLog('MarketListed', { fToken: fToken._address });
      });

      it('cannot list a market a second time', async () => {
        const result1 = await send(unitrollerAsComptroller, '_supportMarket', [fToken._address]);
        const result2 = await send(unitrollerAsComptroller, '_supportMarket', [fToken._address]);
        expect(result1).toHaveLog('MarketListed', { fToken: fToken._address });
        expect(result2).toHaveTrollFailure('MARKET_ALREADY_LISTED', 'SUPPORT_MARKET_EXISTS');
      });

      it('can list two different markets', async () => {
        const fToken1 = await makeFToken({ comptroller: unitroller });
        const fToken2 = await makeFToken({ comptroller: unitroller });
        const result1 = await send(unitrollerAsComptroller, '_supportMarket', [fToken1._address]);
        const result2 = await send(unitrollerAsComptroller, '_supportMarket', [fToken2._address]);
        expect(result1).toHaveLog('MarketListed', { fToken: fToken1._address });
        expect(result2).toHaveLog('MarketListed', { fToken: fToken2._address });
      });
    });
  });
});
