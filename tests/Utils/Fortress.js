"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  bnbBalance,
  bnbMantissa,
  bnbUnsigned,
  mergeInterface
} = require('./BSC');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    treasuryGuardian = saddle.accounts[4],
    treasuryAddress = saddle.accounts[4],
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    const comptroller = await deploy('BoolComptroller');
    return comptroller;
  }

  if (kind == 'boolFee') {
    const comptroller = await deploy('BoolComptroller');
    await send(comptroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress]);
    return comptroller;
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = bnbUnsigned(dfn(opts.maxAssets, 10));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setMaxAssets', [maxAssets]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = bnbMantissa(1);
    const fts = opts.fts || await deploy('FTS', [opts.compOwner || root]);
    const fortressRate = bnbUnsigned(dfn(opts.fortressRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'harnessSetFortressRate', [fortressRate]);
    await send(unitroller, 'setFTSAddress', [fts._address]); // harness only

    return Object.assign(unitroller, { priceOracle, fts });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = bnbUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = bnbMantissa(1);
    const fts = opts.fts || await deploy('FTS', [opts.fortressOwner || root]);
    const fortressRate = bnbUnsigned(dfn(opts.fortressRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);

    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setFTSAddress', [fts._address]); // harness only
    await send(unitroller, 'harnessSetFortressRate', [fortressRate]);

    await send(unitroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress]);

    return Object.assign(unitroller, { priceOracle, fts });
  }
}

async function makeFToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'fbep20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = bnbMantissa(dfn(opts.exchangeRate, 1));
  const decimals = bnbUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'fbnb' ? 'fBNB' : 'fOMG');
  const name = opts.name || `FToken ${symbol}`;
  const admin = opts.admin || root;

  let fToken, underlying;
  let fDelegator, fDelegatee, fDaiMaker;

  switch (kind) {
    case 'fbnb':
      fToken = await deploy('FBNBHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'fdai':
      fDaiMaker  = await deploy('FDaiDelegateMakerHarness');
      underlying = fDaiMaker;
      fDelegatee = await deploy('FDaiDelegateHarness');
      fDelegator = await deploy('FBep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          fDelegatee._address,
          encodeParameters(['address', 'address'], [fDaiMaker._address, fDaiMaker._address])
        ]
      );
      fToken = await saddle.getContractAt('FDaiDelegateHarness', fDelegator._address); // XXXS at
      break;

    case 'fbep20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      fDelegatee = await deploy('FBep20DelegateHarness');
      fDelegator = await deploy('FBep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          fDelegatee._address,
          "0x0"
        ]
      );
      fToken = await saddle.getContractAt('FBep20DelegateHarness', fDelegator._address); // XXXS at
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [fToken._address]);
  }

  if (opts.addFortressMarket) {
    await send(comptroller, '_addFortressMarket', [fToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = bnbMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [fToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = bnbMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [fToken._address, factor])).toSucceed();
  }

  return Object.assign(fToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    const jump = bnbMantissa(dfn(opts.jump, 0));
    const kink = bnbMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'bep20'
  } = opts || {};

  if (kind == 'bep20') {
    const quantity = bnbUnsigned(dfn(opts.quantity, 1e25));
    const decimals = bnbUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Bep20 ${symbol}`;
    return await deploy('BEP20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return bnbUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return bnbUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(fToken, account) {
  const { principal, interestIndex } = await call(fToken, 'harnessAccountBorrows', [account]);
  return { principal: bnbUnsigned(principal), interestIndex: bnbUnsigned(interestIndex) };
}

async function totalBorrows(fToken) {
  return bnbUnsigned(await call(fToken, 'totalBorrows'));
}

async function totalReserves(fToken) {
  return bnbUnsigned(await call(fToken, 'totalReserves'));
}

async function enterMarkets(fTokens, from) {
  return await send(fTokens[0].comptroller, 'enterMarkets', [fTokens.map(c => c._address)], { from });
}

async function fastForward(fToken, blocks = 5) {
  return await send(fToken, 'harnessFastForward', [blocks]);
}

async function setBalance(fToken, account, balance) {
  return await send(fToken, 'harnessSetBalance', [account, balance]);
}

async function setBNBBalance(fBnb, balance) {
  const current = await bnbBalance(fBnb._address);
  const root = saddle.account;
  expect(await send(fBnb, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(fBnb, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(fTokens, accounts) {
  const balances = {};
  for (let fToken of fTokens) {
    const fBalances = balances[fToken._address] = {};
    for (let account of accounts) {
      fBalances[account] = {
        bnb: await bnbBalance(account),
        cash: fToken.underlying && await balanceOf(fToken.underlying, account),
        tokens: await balanceOf(fToken, account),
        borrows: (await borrowSnapshot(fToken, account)).principal
      };
    }
    fBalances[fToken._address] = {
      bnb: await bnbBalance(fToken._address),
      cash: fToken.underlying && await balanceOf(fToken.underlying, fToken._address),
      tokens: await totalSupply(fToken),
      borrows: await totalBorrows(fToken),
      reserves: await totalReserves(fToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let fToken, account, key, diff;
    if (delta.length == 4) {
      ([fToken, account, key, diff] = delta);
    } else {
      ([fToken, key, diff] = delta);
      account = fToken._address;
    }
    balances[fToken._address][account][key] = balances[fToken._address][account][key].add(diff);
  }
  return balances;
}


async function preApprove(fToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(fToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(fToken.underlying, 'approve', [fToken._address, amount], { from });
}

async function quickMint(fToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(fToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(fToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(fToken, 'mint', [mintAmount], { from: minter });
}

async function preSupply(fToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(fToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(fToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(fToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(fToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(fToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(fToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(fToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(fToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(fToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(fToken, price) {
  return send(fToken.comptroller.priceOracle, 'setUnderlyingPrice', [fToken._address, bnbMantissa(price)]);
}

async function setBorrowRate(fToken, rate) {
  return send(fToken.interestRateModel, 'setBorrowRate', [bnbMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(bnbUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(bnbUnsigned));
}

async function pretendBorrow(fToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(fToken, 'harnessSetTotalBorrows', [bnbUnsigned(principalRaw)]);
  await send(fToken, 'harnessSetAccountBorrows', [borrower, bnbUnsigned(principalRaw), bnbMantissa(accountIndex)]);
  await send(fToken, 'harnessSetBorrowIndex', [bnbMantissa(marketIndex)]);
  await send(fToken, 'harnessSetAccrualBlockNumber', [bnbUnsigned(blockNumber)]);
  await send(fToken, 'harnessSetBlockNumber', [bnbUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeFToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setBNBBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
