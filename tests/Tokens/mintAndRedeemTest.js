const {
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');

const {
  makeFToken,
  balanceOf,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  preApprove,
  quickMint,
  preSupply,
  quickRedeem,
  quickRedeemUnderlying
} = require('../Utils/Fortress');

const exchangeRate = 50e3;
const mintAmount = bnbUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = bnbUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(fToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(fToken, minter, mintAmount);
  await send(fToken.comptroller, 'setMintAllowed', [true]);
  await send(fToken.comptroller, 'setMintVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(fToken, 'harnessSetBalance', [minter, 0]);
  await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
}

async function mintFresh(fToken, minter, mintAmount) {
  return send(fToken, 'harnessMintFresh', [minter, mintAmount]);
}

async function preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await preSupply(fToken, redeemer, redeemTokens);
  await send(fToken.comptroller, 'setRedeemAllowed', [true]);
  await send(fToken.comptroller, 'setRedeemVerify', [true]);
  await send(fToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(fToken.underlying, 'harnessSetBalance', [fToken._address, redeemAmount]);
  await send(fToken.underlying, 'harnessSetBalance', [redeemer, 0]);
  await send(fToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
  await send(fToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
}

async function redeemFreshTokens(fToken, redeemer, redeemTokens, redeemAmount) {
  return send(fToken, 'harnessRedeemFresh', [redeemer, redeemTokens, 0]);
}

async function redeemFreshAmount(fToken, redeemer, redeemTokens, redeemAmount) {
  return send(fToken, 'harnessRedeemFresh', [redeemer, 0, redeemAmount]);
}

describe('FToken', function () {
  let root, minter, redeemer, accounts;
  let fToken;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    fToken = await makeFToken({comptrollerOpts: {kind: 'bool'}, exchangeRate});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(fToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("fails if comptroller tells it to", async () => {
      await send(fToken.comptroller, 'setMintAllowed', [false]);
      expect(await mintFresh(fToken, minter, mintAmount)).toHaveTrollReject('MINT_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await mintFresh(fToken, minter, mintAmount)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(fToken);
      expect(await mintFresh(fToken, minter, mintAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(fToken, 'accrueInterest')).toSucceed();
      expect(await mintFresh(fToken, minter, mintAmount)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(fToken.underlying, 'approve', [fToken._address, 1], {from: minter})
      ).toSucceed();
      await expect(mintFresh(fToken, minter, mintAmount)).rejects.toRevert('revert Insufficient allowance');
    });

    it("fails if insufficient balance", async() => {
      await setBalance(fToken.underlying, minter, 1);
      await expect(mintFresh(fToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("proceeds if sufficient approval and balance", async () =>{
      expect(await mintFresh(fToken, minter, mintAmount)).toSucceed();
    });

    it("fails if exchange calculation fails", async () => {
      expect(await send(fToken, 'harnessSetExchangeRate', [0])).toSucceed();
      await expect(mintFresh(fToken, minter, mintAmount)).rejects.toRevert('revert MINT_EXCHANGE_CALCULATION_FAILED');
    });

    it("fails if transferring in fails", async () => {
      await send(fToken.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(fToken, minter, mintAmount)).rejects.toRevert('revert TOKEN_TRANSFER_IN_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([fToken], [minter]);
      const result = await mintFresh(fToken, minter, mintAmount);
      const afterBalances = await getBalances([fToken], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: mintAmount.toString(),
        mintTokens: mintTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: fToken._address,
        to: minter,
        amount: mintTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [fToken, minter, 'cash', -mintAmount],
        [fToken, minter, 'tokens', mintTokens],
        [fToken, 'cash', mintAmount],
        [fToken, 'tokens', mintTokens]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(fToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMint(fToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from mintFresh without emitting any extra logs", async () => {
      await send(fToken.underlying, 'harnessSetBalance', [minter, 1]);
      await expect(mintFresh(fToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMint(fToken, minter, mintAmount)).toSucceed();
      expect(mintTokens).not.toEqualNumber(0);
      expect(await balanceOf(fToken, minter)).toEqualNumber(mintTokens);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(fToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });

  [redeemFreshTokens, redeemFreshAmount].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("fails if comptroller tells it to", async () =>{
        await send(fToken.comptroller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTrollReject('REDEEM_COMPTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(fToken);
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(fToken, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toSucceed();
      });

      it("fails if insufficient protocol cash to transfer out", async() => {
        await send(fToken.underlying, 'harnessSetBalance', [fToken._address, 1]);
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
      });

      it("fails if exchange calculation fails", async () => {
        if (redeemFresh == redeemFreshTokens) {
          expect(await send(fToken, 'harnessSetExchangeRate', ['0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'])).toSucceed();
          expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED');
        } else {
          expect(await send(fToken, 'harnessSetExchangeRate', [0])).toSucceed();
          expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED');
        }
      });

      it("fails if transferring out fails", async () => {
        await send(fToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
      });

      it("fails if total supply < redemption amount", async () => {
        await send(fToken, 'harnessExchangeRateDetails', [0, 0, 0]);
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("reverts if new account balance underflows", async () => {
        await send(fToken, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([fToken], [redeemer]);
        const result = await redeemFresh(fToken, redeemer, redeemTokens, redeemAmount);
        const afterBalances = await getBalances([fToken], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: redeemAmount.toString(),
          redeemTokens: redeemTokens.toString()
        });
        expect(result).toHaveLog(['Transfer', 1], {
          from: redeemer,
          to: fToken._address,
          amount: redeemTokens.toString()
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [fToken, redeemer, 'cash', redeemAmount],
          [fToken, redeemer, 'tokens', -redeemTokens],
          [fToken, 'cash', -redeemAmount],
          [fToken, 'tokens', -redeemTokens]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(fToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(fToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeem(fToken, redeemer, redeemTokens)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from redeemFresh without emitting any extra logs", async () => {
      await setBalance(fToken.underlying, fToken._address, 0);
      expect(await quickRedeem(fToken, redeemer, redeemTokens, {exchangeRate})).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
    });

    it("returns success from redeemFresh and redeems the right amount", async () => {
      expect(
        await send(fToken.underlying, 'harnessSetBalance', [fToken._address, redeemAmount])
      ).toSucceed();
      expect(await quickRedeem(fToken, redeemer, redeemTokens, {exchangeRate})).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(fToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await send(fToken.underlying, 'harnessSetBalance', [fToken._address, redeemAmount])
      ).toSucceed();
      expect(
        await quickRedeemUnderlying(fToken, redeemer, redeemAmount, {exchangeRate})
      ).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(fToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(fToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "500000000",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });
});
