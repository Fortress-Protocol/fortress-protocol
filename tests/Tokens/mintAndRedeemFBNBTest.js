const {
  bnbGasCost,
  bnbMantissa,
  bnbUnsigned,
  sendFallback
} = require('../Utils/BSC');

const {
  makeFToken,
  balanceOf,
  fastForward,
  setBalance,
  setBNBBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/Fortress');

const exchangeRate = 5;
const mintAmount = bnbUnsigned(1e5);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = bnbUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(fToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(fToken.comptroller, 'setMintAllowed', [true]);
  await send(fToken.comptroller, 'setMintVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
}

async function mintExplicit(fToken, minter, mintAmount) {
  return send(fToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(fToken, minter, mintAmount) {
  return sendFallback(fToken, {from: minter, value: mintAmount});
}

async function preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(fToken.comptroller, 'setRedeemAllowed', [true]);
  await send(fToken.comptroller, 'setRedeemVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
  await setBNBBalance(fToken, redeemAmount);
  await send(fToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(fToken, redeemer, redeemTokens);
}

async function redeemFTokens(fToken, redeemer, redeemTokens, redeemAmount) {
  return send(fToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(fToken, redeemer, redeemTokens, redeemAmount) {
  return send(fToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('FBNB', () => {
  let root, minter, redeemer, accounts;
  let fToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    fToken = await makeFToken({kind: 'fbnb', comptrollerOpts: {kind: 'bool'}});
    await fastForward(fToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(fToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(fToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([fToken], [minter]);
        const receipt = await mint(fToken, minter, mintAmount);
        const afterBalances = await getBalances([fToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [fToken, 'bnb', mintAmount],
          [fToken, 'tokens', mintTokens],
          [fToken, minter, 'bnb', -mintAmount.add(await bnbGasCost(receipt))],
          [fToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemFTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(fToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(fToken, redeemer, redeemTokens.mul(5), redeemAmount.mul(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(fToken);
        const beforeBalances = await getBalances([fToken], [redeemer]);
        const receipt = await redeem(fToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([fToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [fToken, 'bnb', -redeemAmount],
          [fToken, 'tokens', -redeemTokens],
          [fToken, redeemer, 'bnb', redeemAmount.sub(await bnbGasCost(receipt))],
          [fToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
