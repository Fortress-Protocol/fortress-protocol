const {
  makeFToken,
  getBalances,
  adjustBalances
} = require('../Utils/Fortress');

const exchangeRate = 5;

describe('FBNB', function () {
  let root, nonRoot, accounts;
  let fToken;
  beforeEach(async () => {
    [root, nonRoot, ...accounts] = saddle.accounts;
    fToken = await makeFToken({kind: 'fbnb', comptrollerOpts: {kind: 'bool'}});
  });

  describe("getCashPrior", () => {
    it("returns the amount of bnb held by the fBnb contract before the current message", async () => {
      expect(await call(fToken, 'harnessGetCashPrior', [], {value: 100})).toEqualNumber(0);
    });
  });

  describe("doTransferIn", () => {
    it("succeeds if from is msg.nonRoot and amount is msg.value", async () => {
      expect(await call(fToken, 'harnessDoTransferIn', [root, 100], {value: 100})).toEqualNumber(100);
    });

    it("reverts if from != msg.sender", async () => {
      await expect(call(fToken, 'harnessDoTransferIn', [nonRoot, 100], {value: 100})).rejects.toRevert("revert sender mismatch");
    });

    it("reverts if amount != msg.value", async () => {
      await expect(call(fToken, 'harnessDoTransferIn', [root, 77], {value: 100})).rejects.toRevert("revert value mismatch");
    });

    describe("doTransferOut", () => {
      it("transfers bnb out", async () => {
        const beforeBalances = await getBalances([fToken], [nonRoot]);
        const receipt = await send(fToken, 'harnessDoTransferOut', [nonRoot, 77], {value: 77});
        const afterBalances = await getBalances([fToken], [nonRoot]);
        expect(receipt).toSucceed();
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [fToken, nonRoot, 'bnb', 77]
        ]));
      });

      it("reverts if it fails", async () => {
        await expect(call(fToken, 'harnessDoTransferOut', [root, 77], {value: 0})).rejects.toRevert();
      });
    });
  });
});
