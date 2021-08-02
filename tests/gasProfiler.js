const {
  bnbUnsigned,
  bnbMantissa,
  bnbExp,
} = require('./Utils/BSC');

const {
  makeComptroller,
  makeFToken,
  preApprove,
  preSupply,
  quickRedeem,
} = require('./Utils/Fortress');

async function ftsBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.fts, 'balanceOf', [user]))
}

async function fortressAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, 'fortressAccrued', [user]));
}

async function fastForwardPatch(patch, comptroller, blocks) {
  if (patch == 'unitroller') {
    return await send(comptroller, 'harnessFastForward', [blocks]);
  } else {
    return await send(comptroller, 'fastForward', [blocks]);
  }
}

const fs = require('fs');
const util = require('util');
const diffStringsUnified = require('jest-diff').default;


async function preRedeem(
  fToken,
  redeemer,
  redeemTokens,
  redeemAmount,
  exchangeRate
) {
  await preSupply(fToken, redeemer, redeemTokens);
  await send(fToken.underlying, 'harnessSetBalance', [
    fToken._address,
    redeemAmount
  ]);
}

const sortOpcodes = (opcodesMap) => {
  return Object.values(opcodesMap)
    .map(elem => [elem.fee, elem.name])
    .sort((a, b) => b[0] - a[0]);
};

const getGasCostFile = name => {
  try {
    const jsonString = fs.readFileSync(name);
    return JSON.parse(jsonString);
  } catch (err) {
    console.log(err);
    return {};
  }
};

const recordGasCost = (totalFee, key, filename, opcodes = {}) => {
  let fileObj = getGasCostFile(filename);
  const newCost = {fee: totalFee, opcodes: opcodes};
  console.log(diffStringsUnified(fileObj[key], newCost));
  fileObj[key] = newCost;
  fs.writeFileSync(filename, JSON.stringify(fileObj, null, ' '), 'utf-8');
};

async function mint(fToken, minter, mintAmount, exchangeRate) {
  expect(await preApprove(fToken, minter, mintAmount, {})).toSucceed();
  return send(fToken, 'mint', [mintAmount], { from: minter });
}

async function claimFortress(comptroller, holder) {
  return send(comptroller, 'claimFortress', [holder], { from: holder });
}

/// GAS PROFILER: saves a digest of the gas prices of common FToken operations
/// transiently fails, not sure why

describe('Gas report', () => {
  let root, minter, redeemer, accounts, fToken;
  const exchangeRate = 50e3;
  const preMintAmount = bnbUnsigned(30e4);
  const mintAmount = bnbUnsigned(10e4);
  const mintTokens = mintAmount.div(exchangeRate);
  const redeemTokens = bnbUnsigned(10e3);
  const redeemAmount = redeemTokens.multipliedBy(exchangeRate);
  const filename = './gasCosts.json';

  describe('FToken', () => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      fToken = await makeFToken({
        comptrollerOpts: { kind: 'bool'},
        interestRateModelOpts: { kind: 'white-paper'},
        exchangeRate
      });
    });

    it('first mint', async () => {
      await send(fToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(fToken, 'harnessSetBlockNumber', [41]);

      const trxReceipt = await mint(fToken, minter, mintAmount, exchangeRate);
      recordGasCost(trxReceipt.gasUsed, 'first mint', filename);
    });

    it('second mint', async () => {
      await mint(fToken, minter, mintAmount, exchangeRate);

      await send(fToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(fToken, 'harnessSetBlockNumber', [41]);

      const mint2Receipt = await mint(fToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['AccrueInterest', 'Transfer', 'Mint']);

      console.log(mint2Receipt.gasUsed);
      const opcodeCount = {};

      await saddle.trace(mint2Receipt, {
        execLog: log => {
          if (log.lastLog != undefined) {
            const key = `${log.op} @ ${log.gasCost}`;
            opcodeCount[key] = (opcodeCount[key] || 0) + 1;
          }
        }
      });

      recordGasCost(mint2Receipt.gasUsed, 'second mint', filename, opcodeCount);
    });

    it('second mint, no interest accrued', async () => {
      await mint(fToken, minter, mintAmount, exchangeRate);

      await send(fToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(fToken, 'harnessSetBlockNumber', [40]);

      const mint2Receipt = await mint(fToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['Transfer', 'Mint']);
      recordGasCost(mint2Receipt.gasUsed, 'second mint, no interest accrued', filename);

      // console.log("NO ACCRUED");
      // const opcodeCount = {};
      // await saddle.trace(mint2Receipt, {
      //   execLog: log => {
      //     opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
      //   }
      // });
      // console.log(getOpcodeDigest(opcodeCount));
    });

    it('redeem', async () => {
      await preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      const trxReceipt = await quickRedeem(fToken, redeemer, redeemTokens);
      recordGasCost(trxReceipt.gasUsed, 'redeem', filename);
    });

    it.skip('print mint opcode list', async () => {
      await preMint(fToken, minter, mintAmount, mintTokens, exchangeRate);
      const trxReceipt = await quickMint(fToken, minter, mintAmount);
      const opcodeCount = {};
      await saddle.trace(trxReceipt, {
        execLog: log => {
          opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
        }
      });
      console.log(getOpcodeDigest(opcodeCount));
    });
  });

  describe.each([
    ['unitroller-g2'],
    ['unitroller']
  ])('FTS claims %s', (patch) => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      comptroller = await makeComptroller({ kind: patch });
      let interestRateModelOpts = {borrowRate: 0.000001};
      fToken = await makeFToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
      if (patch == 'unitroller') {
        await send(comptroller, '_setFortressSpeed', [fToken._address, bnbExp(0.05)]);
      } else {
        await send(comptroller, '_addFortressMarkets', [[fToken].map(c => c._address)]);
        await send(comptroller, 'setFortressSpeed', [fToken._address, bnbExp(0.05)]);
      }
      await send(comptroller.fts, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
    });

    it(`${patch} second mint with fts accrued`, async () => {
      await mint(fToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('FTS balance before mint', (await ftsBalance(comptroller, minter)).toString());
      console.log('FTS accrued before mint', (await fortressAccrued(comptroller, minter)).toString());
      const mint2Receipt = await mint(fToken, minter, mintAmount, exchangeRate);
      console.log('FTS balance after mint', (await ftsBalance(comptroller, minter)).toString());
      console.log('FTS accrued after mint', (await fortressAccrued(comptroller, minter)).toString());
      recordGasCost(mint2Receipt.gasUsed, `${patch} second mint with fts accrued`, filename);
    });

    it(`${patch} claim fts`, async () => {
      await mint(fToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('FTS balance before claim', (await ftsBalance(comptroller, minter)).toString());
      console.log('FTS accrued before claim', (await fortressAccrued(comptroller, minter)).toString());
      const claimReceipt = await claimFortress(comptroller, minter);
      console.log('FTS balance after claim', (await ftsBalance(comptroller, minter)).toString());
      console.log('FTS accrued after claim', (await fortressAccrued(comptroller, minter)).toString());
      recordGasCost(claimReceipt.gasUsed, `${patch} claim fts`, filename);
    });
  });
});
