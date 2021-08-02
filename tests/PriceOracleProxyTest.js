const BigNumber = require('bignumber.js');

const {
  address,
  bnbMantissa
} = require('./Utils/BSC');

const {
  makeFToken,
  makePriceOracle,
} = require('./Utils/Fortress');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let oracle, backingOracle, fBnb, fUsdc, fSai, fDai, fUsdt, cOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    fBnb = await makeFToken({kind: "fbnb", comptrollerOpts: {kind: "v1-no-proxy"}, supportMarket: true});
    fUsdc = await makeFToken({comptroller: fBnb.comptroller, supportMarket: true});
    fSai = await makeFToken({comptroller: fBnb.comptroller, supportMarket: true});
    fDai = await makeFToken({comptroller: fBnb.comptroller, supportMarket: true});
    fUsdt = await makeFToken({comptroller: fBnb.comptroller, supportMarket: true});
    cOther = await makeFToken({comptroller: fBnb.comptroller, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        fBnb._address,
        fUsdc._address,
        fSai._address,
        fDai._address,
        fUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of fBnb", async () => {
      let configuredFBNB = await call(oracle, "fBnbAddress");
      expect(configuredFBNB).toEqual(fBnb._address);
    });

    it("sets address of fUSDC", async () => {
      let configuredCUSD = await call(oracle, "fUsdcAddress");
      expect(configuredCUSD).toEqual(fUsdc._address);
    });

    it("sets address of fSAI", async () => {
      let configuredCSAI = await call(oracle, "fSaiAddress");
      expect(configuredCSAI).toEqual(fSai._address);
    });

    it("sets address of fDAI", async () => {
      let configuredFDAI = await call(oracle, "fDaiAddress");
      expect(configuredFDAI).toEqual(fDai._address);
    });

    it("sets address of fUSDT", async () => {
      let configuredCUSDT = await call(oracle, "fUsdtAddress");
      expect(configuredCUSDT).toEqual(fUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (fToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [fToken._address, bnbMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [fToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);;
    };

    it("always returns 1e18 for fBnb", async () => {
      await readAndVerifyProxyPrice(fBnb, 1);
    });

    it("uses address(1) for USDC and address(2) for fdai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), bnbMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), bnbMantissa(8)]);
      await readAndVerifyProxyPrice(fDai, 8);
      await readAndVerifyProxyPrice(fUsdc, 5e12);
      await readAndVerifyProxyPrice(fUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeFToken({comptroller: fBnb.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, bnbMantissa(0.01)]);

      await readAndVerifyProxyPrice(fDai, 0.01);
      await readAndVerifyProxyPrice(fSai, 0.01);

      await send(oracle, "setSaiPrice", [bnbMantissa(0.05)]);

      await readAndVerifyProxyPrice(fDai, 0.01);
      await readAndVerifyProxyPrice(fSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [bnbMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 BNB");
    });
});
});
