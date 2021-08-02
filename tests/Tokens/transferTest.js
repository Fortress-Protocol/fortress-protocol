const {makeFToken} = require('../Utils/Fortress');

describe('FToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const fToken = await makeFToken({supportMarket: true});
      expect(await call(fToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(fToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const fToken = await makeFToken({supportMarket: true});
      await send(fToken, 'harnessSetBalance', [root, 100]);
      expect(await call(fToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(fToken, 'transfer', [accounts[0], 50]);
      expect(await call(fToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(fToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const fToken = await makeFToken({supportMarket: true});
      await send(fToken, 'harnessSetBalance', [root, 100]);
      expect(await call(fToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(fToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const fToken = await makeFToken({comptrollerOpts: {kind: 'bool'}});
      await send(fToken, 'harnessSetBalance', [root, 100]);
      expect(await call(fToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(fToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(fToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(fToken.comptroller, 'setTransferAllowed', [true])
      await send(fToken.comptroller, 'setTransferVerify', [false])
      await expect(send(fToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});