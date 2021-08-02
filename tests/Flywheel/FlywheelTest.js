const {
  makeComptroller,
  makeFToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/Fortress');
const {
  bnbExp,
  bnbDouble,
  bnbUnsigned
} = require('../Utils/BSC');

const fortressRate = bnbUnsigned(1e18);

async function fortressAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, 'fortressAccrued', [user]));
}

async function ftsBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.fts, 'balanceOf', [user]))
}

async function totalFortressAccrued(comptroller, user) {
  return (await fortressAccrued(comptroller, user)).add(await ftsBalance(comptroller, user));
}

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, fLOW, fREP, fZRX, fEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    fLOW = await makeFToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    fREP = await makeFToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    fZRX = await makeFToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    fEVIL = await makeFToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('getFortressMarkets()', () => {
    it('should return the markets', async () => {
      for (let mkt of [fLOW, fREP, fZRX]) {
        await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      }
      expect(await call(comptroller, 'getFortressMarkets')).toEqual(
        [fLOW, fREP, fZRX].map((c) => c._address)
      );
    });
  });

  describe('_setFortressSpeed()', () => {
    it('should update market index when calling setFortressSpeed', async () => {
      const mkt = fREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);

      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(1)]);

      const {index, block} = await call(comptroller, 'fortressSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a fts market if called by admin', async () => {
      for (let mkt of [fLOW, fREP, fZRX]) {
        await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      }
      const tx = await send(comptroller, '_setFortressSpeed', [fLOW._address, 0]);
      expect(await call(comptroller, 'getFortressMarkets')).toEqual(
        [fREP, fZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('FortressSpeedUpdated', {
        fToken: fLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a fts market from middle of array', async () => {
      for (let mkt of [fLOW, fREP, fZRX]) {
        await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await send(comptroller, '_setFortressSpeed', [fREP._address, 0]);
      expect(await call(comptroller, 'getFortressMarkets')).toEqual(
        [fLOW, fZRX].map((c) => c._address)
      );
    });

    it('should not drop a fts market unless called by admin', async () => {
      for (let mkt of [fLOW, fREP, fZRX]) {
        await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setFortressSpeed', [fLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set fortress speed');
    });

    it('should not add non-listed markets', async () => {
      const fBAT = await makeFToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddFortressMarkets', [[fBAT._address]])
      ).rejects.toRevert('revert market is not listed');

      const markets = await call(comptroller, 'getFortressMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateFortressBorrowIndex()', () => {
    it('should calculate fts borrower index correctly', async () => {
      const mkt = fREP;
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [bnbUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateFortressBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        fortressAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + fortressAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'fortressBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update fortressBorrowState index if fToken not in Fortress markets', async () => {
      const mkt = await makeFToken({
        comptroller: comptroller,
        supportMarket: true,
        addFortressMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateFortressBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'fortressBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'fortressSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = fREP;
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateFortressBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'fortressBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if fts speed is 0', async () => {
      const mkt = fREP;
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0)]);
      await send(comptroller, 'harnessUpdateFortressBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'fortressBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateFortressSupplyIndex()', () => {
    it('should calculate fts supplier index correctly', async () => {
      const mkt = fREP;
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateFortressSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        fortressAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += fortressAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'fortressSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-Fortress markets', async () => {
      const mkt = await makeFToken({
        comptroller: comptroller,
        supportMarket: true,
        addFortressMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateFortressSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'fortressSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'fortressSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // ftoken could have no fts speed or fts supplier state if not in markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = fREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, '_setFortressSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateFortressSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'fortressSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const fortressRemaining = fortressRate.mul(100)
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      await send(comptroller.fts, 'transfer', [comptroller._address, fortressRemaining], {from: root});
      await pretendBorrow(fLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshFortressSpeeds');

      await quickMint(fLOW, a2, bnbUnsigned(10e18));
      await quickMint(fLOW, a3, bnbUnsigned(15e18));

      const a2Accrued0 = await totalFortressAccrued(comptroller, a2);
      const a3Accrued0 = await totalFortressAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(fLOW, a2);
      const a3Balance0 = await balanceOf(fLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(fLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalFortressAccrued(comptroller, a2);
      const a3Accrued1 = await totalFortressAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(fLOW, a2);
      const a3Balance1 = await balanceOf(fLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateFortressSupplyIndex', [fLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(fLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalFortressAccrued(comptroller, a2);
      const a3Accrued2 = await totalFortressAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(220000);
      expect(txT1.gasUsed).toBeGreaterThan(140000);
      expect(txT2.gasUsed).toBeLessThan(140000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerFortress()', () => {

    it('should update borrow index checkpoint but not fortressAccrued for first time user', async () => {
      const mkt = fREP;
      await send(comptroller, "setFortressBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setFortressBorrowerIndex", [mkt._address, root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerFortress", [mkt._address, root, bnbExp(1.1)]);
      expect(await call(comptroller, "fortressAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "fortressBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer fts and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = fREP;
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e18), bnbExp(1)]);
      await send(comptroller, "setFortressBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setFortressBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 fortressBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 FTS
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerFortress", [mkt._address, a1, bnbUnsigned(1.1e18)]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerFortress', {
        fToken: mkt._address,
        borrower: a1,
        fortressDelta: bnbUnsigned(25e18).toString(),
        fortressBorrowIndex: bnbDouble(6).toString()
      });
    });

    it('should not transfer fts automatically', async () => {
      const mkt = fREP;
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e17), bnbExp(1)]);
      await send(comptroller, "setFortressBorrowState", [mkt._address, bnbDouble(1.0019), 10]);
      await send(comptroller, "setFortressBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < fortressClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerFortress", [mkt._address, a1, bnbExp(1.1)]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Fortress market', async () => {
      const mkt = await makeFToken({
        comptroller: comptroller,
        supportMarket: true,
        addFortressMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerFortress", [mkt._address, a1, bnbExp(1.1)]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'fortressBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierFortress()', () => {
    it('should transfer fts and update supply index correctly for first time user', async () => {
      const mkt = fREP;
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setFortressSupplyState", [mkt._address, bnbDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 fortressSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 FTS:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierFortress", [mkt._address, a1]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierFortress', {
        fToken: mkt._address,
        supplier: a1,
        fortressDelta: bnbUnsigned(25e18).toString(),
        fortressSupplyIndex: bnbDouble(6).toString()
      });
    });

    it('should update fts accrued and supply index for repeat user', async () => {
      const mkt = fREP;
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setFortressSupplyState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setFortressSupplierIndex", [mkt._address, a1, bnbDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierFortress", [mkt._address, a1]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when fortressAccrued below threshold', async () => {
      const mkt = fREP;
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "setFortressSupplyState", [mkt._address, bnbDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierFortress", [mkt._address, a1]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Fortress market', async () => {
      const mkt = await makeFToken({
        comptroller: comptroller,
        supportMarket: true,
        addFortressMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierFortress", [mkt._address, a1]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'fortressBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferFTS', () => {
    it('should transfer fts accrued when amount is above threshold', async () => {
      const ftsRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const ftsBalancePre = await ftsBalance(comptroller, a1);
      const tx0 = await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setFortressAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferFortress', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await fortressAccrued(comptroller, a1);
      const ftsBalancePost = await ftsBalance(comptroller, a1);
      expect(ftsBalancePre).toEqualNumber(0);
      expect(ftsBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when fts accrued is below threshold', async () => {
      const ftsRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const ftsBalancePre = await call(comptroller.fts, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setFortressAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferFortress', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await fortressAccrued(comptroller, a1);
      const ftsBalancePost = await ftsBalance(comptroller, a1);
      expect(ftsBalancePre).toEqualNumber(0);
      expect(ftsBalancePost).toEqualNumber(0);
    });

    it('should not transfer fts if fts accrued is greater than fts remaining', async () => {
      const ftsRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const ftsBalancePre = await ftsBalance(comptroller, a1);
      const tx0 = await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      const tx1 = await send(comptroller, 'setFortressAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferFortress', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await fortressAccrued(comptroller, a1);
      const ftsBalancePost = await ftsBalance(comptroller, a1);
      expect(ftsBalancePre).toEqualNumber(0);
      expect(ftsBalancePost).toEqualNumber(0);
    });
  });

  describe('claimFortress', () => {
    it('should accrue fts and then transfer fts accrued', async () => {
      const ftsRemaining = fortressRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      await pretendBorrow(fLOW, a1, 1, 1, 100);
      await send(comptroller, '_setFortressSpeed', [fLOW._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');
      const speed = await call(comptroller, 'fortressSpeeds', [fLOW._address]);
      const a2AccruedPre = await fortressAccrued(comptroller, a2);
      const ftsBalancePre = await ftsBalance(comptroller, a2);
      await quickMint(fLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimFortress', [a2]);
      const a2AccruedPost = await fortressAccrued(comptroller, a2);
      const ftsBalancePost = await ftsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(fortressRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(ftsBalancePre).toEqualNumber(0);
      expect(ftsBalancePost).toEqualNumber(fortressRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue fts and then transfer fts accrued in a single market', async () => {
      const ftsRemaining = fortressRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      await pretendBorrow(fLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');
      const speed = await call(comptroller, 'fortressSpeeds', [fLOW._address]);
      const a2AccruedPre = await fortressAccrued(comptroller, a2);
      const ftsBalancePre = await ftsBalance(comptroller, a2);
      await quickMint(fLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimFortress', [a2, [fLOW._address]]);
      const a2AccruedPost = await fortressAccrued(comptroller, a2);
      const ftsBalancePost = await ftsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(220000);
      expect(speed).toEqualNumber(fortressRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(ftsBalancePre).toEqualNumber(0);
      expect(ftsBalancePost).toEqualNumber(fortressRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when fts accrued is below threshold', async () => {
      const ftsRemaining = bnbExp(1), accruedAmt = bnbUnsigned(0.0009e18)
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      await send(comptroller, 'setFortressAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimFortress', [a1, [fLOW._address]]);
      expect(await fortressAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await ftsBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeFToken({comptroller});
      await expect(
        send(comptroller, 'claimFortress', [a1, [cNOT._address]])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('claimFortress batch', () => {
    it('should revert when claiming fts from non-listed market', async () => {
      const ftsRemaining = fortressRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(fLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(fLOW.underlying, 'approve', [fLOW._address, mintAmount], { from });
        send(fLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(fLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessRefreshFortressSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimFortress', [claimAccts, [fLOW._address, fEVIL._address], true, true])).rejects.toRevert('revert not listed market');
    });


    it('should claim the expected amount when holders and ftokens arg is duplicated', async () => {
      const ftsRemaining = fortressRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(fLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(fLOW.underlying, 'approve', [fLOW._address, mintAmount], { from });
        send(fLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(fLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimFortress', [[...claimAccts, ...claimAccts], [fLOW._address, fLOW._address], false, true]);
      // fts distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'fortressSupplierIndex', [fLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await ftsBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims fts for multiple suppliers only', async () => {
      const ftsRemaining = fortressRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(fLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(fLOW.underlying, 'approve', [fLOW._address, mintAmount], { from });
        send(fLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(fLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimFortress', [claimAccts, [fLOW._address], false, true]);
      // fts distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'fortressSupplierIndex', [fLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await ftsBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims fts for multiple borrowers only, primes uninitiated', async () => {
      const ftsRemaining = fortressRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10), borrowAmt = bnbExp(1), borrowIdx = bnbExp(1)
      await send(comptroller.fts, 'transfer', [comptroller._address, ftsRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(fLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(fLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimFortress', [claimAccts, [fLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'fortressBorrowerIndex', [fLOW._address, acct])).toEqualNumber(bnbDouble(2.25));
        expect(await call(comptroller, 'fortressSupplierIndex', [fLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeFToken({comptroller});
      await expect(
        send(comptroller, 'claimFortress', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('harnessRefreshFortressSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshFortressSpeeds');
      const speed = await call(comptroller, 'fortressSpeeds', [fLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(fLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshFortressSpeeds');
      const speed = await call(comptroller, 'fortressSpeeds', [fLOW._address]);
      expect(speed).toEqualNumber(fortressRate);
      expect(tx).toHaveLog(['FortressSpeedUpdated', 0], {
        fToken: fLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(fLOW, a1, 1, 1, 100);
      await pretendBorrow(fZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address, fZRX._address]]);
      await send(comptroller, 'harnessRefreshFortressSpeeds');
      const speed1 = await call(comptroller, 'fortressSpeeds', [fLOW._address]);
      const speed2 = await call(comptroller, 'fortressSpeeds', [fREP._address]);
      const speed3 = await call(comptroller, 'fortressSpeeds', [fZRX._address]);
      expect(speed1).toEqualNumber(fortressRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(fortressRate.div(4).mul(3));
    });
  });

  describe('harnessAddFortressMarkets', () => {
    it('should correctly add a market if called by admin', async () => {
      const fBAT = await makeFToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddFortressMarkets', [[fLOW._address, fREP._address, fZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddFortressMarkets', [[fBAT._address]]);
      const markets = await call(comptroller, 'getFortressMarkets');
      expect(markets).toEqual([fLOW, fREP, fZRX, fBAT].map((c) => c._address));
      expect(tx2).toHaveLog('FortressSpeedUpdated', {
        fToken: fBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = fLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = bnbUnsigned(1.5e36);

      await send(comptroller, "harnessAddFortressMarkets", [[mkt]]);
      await send(comptroller, "setFortressSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setFortressBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setFortressSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddFortressMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'fortressSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'fortressBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });
});
