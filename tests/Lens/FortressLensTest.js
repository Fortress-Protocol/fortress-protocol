const {
  address,
  encodeParameters,
} = require('../Utils/BSC');
const {
  makeComptroller,
  makeFToken,
} = require('../Utils/Fortress');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('FortressLens', () => {
  let FortressLens;
  let acct;

  beforeEach(async () => {
    FortressLens = await deploy('FortressLens');
    acct = accounts[0];
  });

  describe('fTokenMetadata', () => {
    it('is correct for a fBep20', async () => {
      let fBep20 = await makeFToken();
      expect(
        cullTuple(await call(FortressLens, 'fTokenMetadata', [fBep20._address]))
      ).toEqual(
        {
          fToken: fBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(fBep20, 'underlying', []),
          fTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for fBnb', async () => {
      let fBnb = await makeFToken({kind: 'fbnb'});
      expect(
        cullTuple(await call(FortressLens, 'fTokenMetadata', [fBnb._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        fToken: fBnb._address,
        fTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('fTokenMetadataAll', () => {
    it('is correct for a fBep20 and fBnb', async () => {
      let fBep20 = await makeFToken();
      let fBnb = await makeFToken({kind: 'fbnb'});
      expect(
        (await call(FortressLens, 'fTokenMetadataAll', [[fBep20._address, fBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          fToken: fBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(fBep20, 'underlying', []),
          fTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          fToken: fBnb._address,
          fTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('fTokenBalances', () => {
    it('is correct for fBEP20', async () => {
      let fBep20 = await makeFToken();
      expect(
        cullTuple(await call(FortressLens, 'fTokenBalances', [fBep20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          fToken: fBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for fBNB', async () => {
      let fBnb = await makeFToken({kind: 'fbnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(FortressLens, 'fTokenBalances', [fBnb._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          fToken: fBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      );
    });
  });

  describe('fTokenBalancesAll', () => {
    it('is correct for fBnb and fBep20', async () => {
      let fBep20 = await makeFToken();
      let fBnb = await makeFToken({kind: 'fbnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(FortressLens, 'fTokenBalancesAll', [[fBep20._address, fBnb._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          fToken: fBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          fToken: fBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      ]);
    })
  });

  describe('fTokenUnderlyingPrice', () => {
    it('gets correct price for fBep20', async () => {
      let fBep20 = await makeFToken();
      expect(
        cullTuple(await call(FortressLens, 'fTokenUnderlyingPrice', [fBep20._address]))
      ).toEqual(
        {
          fToken: fBep20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for fBnb', async () => {
      let fBnb = await makeFToken({kind: 'fbnb'});
      expect(
        cullTuple(await call(FortressLens, 'fTokenUnderlyingPrice', [fBnb._address]))
      ).toEqual(
        {
          fToken: fBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('fTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let fBep20 = await makeFToken();
      let fBnb = await makeFToken({kind: 'fbnb'});
      expect(
        (await call(FortressLens, 'fTokenUnderlyingPriceAll', [[fBep20._address, fBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          fToken: fBep20._address,
          underlyingPrice: "0",
        },
        {
          fToken: fBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(FortressLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let fts, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let votingDelay;
    let votingPeriod;

    beforeEach(async () => {
      fts = await deploy('FTS', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), fts._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(fts, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
      votingDelay = Number(await call(gov, 'votingDelay'));
      votingPeriod = Number(await call(gov, 'votingPeriod'));
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(FortressLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(FortressLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + votingDelay + votingPeriod).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + votingDelay).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('fts', () => {
    let fts, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      fts = await deploy('FTS', [acct]);
    });

    describe('getFTSBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(FortressLens, 'getFTSBalanceMetadata', [fts._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getFTSBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setFortressAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(FortressLens, 'getFTSBalanceMetadataExt', [fts._address, comptroller._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getFortressVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(FortressLens, 'getFortressVotes', [fts._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(FortressLens, 'getFortressVotes', [fts._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert FTS::getPriorVotes: not yet determined')
      });
    });
  });
});
