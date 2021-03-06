const {
  both,
  bnbMantissa,
  encodeParameters,
  advanceBlocks,
  freezeTime,
  mineBlock
} = require('../../Utils/BSC');

async function enfranchise(fts, actor, amount) {
  await send(fts, 'transfer', [actor, bnbMantissa(amount)]);
  await send(fts, 'delegate', [actor], {from: actor});
}

describe('GovernorAlpha#queue/1', () => {
  let root, a1, a2, accounts;
  beforeAll(async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
  });

  describe("overlapping actions", () => {
    it("reverts on queueing overlapping actions in same proposal", async () => {
      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      const fts = await deploy('FTS', [root]);
      const gov = await deploy('GovernorAlpha', [timelock._address, fts._address, root]);
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);

      await enfranchise(fts, a1, 1e6);
      await mineBlock();

      const targets = [fts._address, fts._address];
      const values = ["0", "0"];
      const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root]), encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, true], {from: a1});
      await advanceBlocks(90000);

      await expect(
        send(gov, 'queue', [proposalId1])
      ).rejects.toRevert("revert GovernorAlpha::_queueOrRevert: proposal action already queued at eta");
    });

    it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
      const timelock = await deploy('TimelockHarness', [root, 86400 * 2]);
      const fts = await deploy('FTS', [root]);
      const gov = await deploy('GovernorAlpha', [timelock._address, fts._address, root]);
      const txAdmin = await send(timelock, 'harnessSetAdmin', [gov._address]);

      await enfranchise(fts, a1, 1e6);
      await enfranchise(fts, a2, 1e6);
      await mineBlock();

      const targets = [fts._address];
      const values = ["0"];
      const signatures = ["getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root])];
      const {reply: proposalId1} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a1});
      const {reply: proposalId2} = await both(gov, 'propose', [targets, values, signatures, calldatas, "do nothing"], {from: a2});
      await mineBlock();

      const txVote1 = await send(gov, 'castVote', [proposalId1, true], {from: a1});
      const txVote2 = await send(gov, 'castVote', [proposalId2, true], {from: a2});
      await advanceBlocks(90000);
      await freezeTime(100);

      const txQueue1 = await send(gov, 'queue', [proposalId1]);
      await expect(
        send(gov, 'queue', [proposalId2])
      ).rejects.toRevert("revert GovernorAlpha::_queueOrRevert: proposal action already queued at eta");

      await freezeTime(101);
      const txQueue2 = await send(gov, 'queue', [proposalId2]);
    });
  });
});
