const {
  bnbBalance,
  bnbGasCost,
  getContract
} = require('./Utils/BSC');

const {
  makeComptroller,
  makeFToken,
  makePriceOracle,
  pretendBorrow,
  borrowSnapshot
} = require('./Utils/Fortress');

describe('Maximillion', () => {
  let root, borrower;
  let maximillion, fBnb;
  beforeEach(async () => {
    [root, borrower] = saddle.accounts;
    fBnb = await makeFToken({kind: "fbnb", supportMarket: true});
    maximillion = await deploy('Maximillion', [fBnb._address]);
  });

  describe("constructor", () => {
    it("sets address of fBnb", async () => {
      expect(await call(maximillion, "fBnb")).toEqual(fBnb._address);
    });
  });

  describe("repayBehalf", () => {
    it("refunds the entire amount with no borrows", async () => {
      const beforeBalance = await bnbBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await bnbGasCost(result);
      const afterBalance = await bnbBalance(root);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost));
    });

    it("repays part of a borrow", async () => {
      await pretendBorrow(fBnb, borrower, 1, 1, 150);
      const beforeBalance = await bnbBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await bnbGasCost(result);
      const afterBalance = await bnbBalance(root);
      const afterBorrowSnap = await borrowSnapshot(fBnb, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(100));
      expect(afterBorrowSnap.principal).toEqualNumber(50);
    });

    it("repays a full borrow and refunds the rest", async () => {
      await pretendBorrow(fBnb, borrower, 1, 1, 90);
      const beforeBalance = await bnbBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await bnbGasCost(result);
      const afterBalance = await bnbBalance(root);
      const afterBorrowSnap = await borrowSnapshot(fBnb, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(90));
      expect(afterBorrowSnap.principal).toEqualNumber(0);
    });
  });
});
