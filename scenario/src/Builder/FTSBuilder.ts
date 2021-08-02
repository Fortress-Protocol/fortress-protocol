import { Event } from '../Event';
import { World, addAction } from '../World';
import { FTS, FTSScenario } from '../Contract/Fortress';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const FTSContract = getContract('FTS');
const FTSScenarioContract = getContract('FTSScenario');

export interface TokenData {
  invokation: Invokation<FTS>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildFTS(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; fts: FTS; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "FTS Deploy Scenario account:<Address>" - Deploys Scenario FTS Token
        * E.g. "FTS Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await FTSScenarioContract.deploy<FTSScenario>(world, from, [account.val]),
          contract: 'FTSScenario',
          symbol: 'FTS',
          name: 'Fortress Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### FTS

      * "FTS Deploy account:<Address>" - Deploys FTS Token
        * E.g. "FTS Deploy Geoff"
    `,
      'FTS',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await FTSScenarioContract.deploy<FTSScenario>(world, from, [account.val]),
            contract: 'FTSScenario',
            symbol: 'FTS',
            name: 'Fortress Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await FTSContract.deploy<FTS>(world, from, [account.val]),
            contract: 'FTS',
            symbol: 'FTS',
            name: 'Fortress Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployFTS", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const fts = invokation.value!;
  tokenData.address = fts._address;

  world = await storeAndSaveContract(
    world,
    fts,
    'FTS',
    invokation,
    [
      { index: ['FTS'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, fts, tokenData };
}
