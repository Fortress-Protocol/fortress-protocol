import { Event } from '../Event';
import { World, addAction } from '../World';
import { FAI, FAIScenario } from '../Contract/FAI';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const FAIContract = getContract('FAI');
const FAIScenarioContract = getContract('FAIScenario');

export interface TokenData {
  invokation: Invokation<FAI>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildFAI(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; fai: FAI; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "FAI Deploy Scenario account:<Address>" - Deploys Scenario FAI Token
        * E.g. "FAI Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await FAIScenarioContract.deploy<FAIScenario>(world, from, [account.val]),
          contract: 'FAIScenario',
          symbol: 'FAI',
          name: 'FAI Stablecoin',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### FAI

      * "FAI Deploy account:<Address>" - Deploys FAI Token
        * E.g. "FAI Deploy Geoff"
    `,
      'FAI',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await FAIScenarioContract.deploy<FAIScenario>(world, from, [account.val]),
            contract: 'FAIScenario',
            symbol: 'FAI',
            name: 'FAI Stablecoin',
            decimals: 18
          };
        } else {
          return {
            invokation: await FAIContract.deploy<FAI>(world, from, [account.val]),
            contract: 'FAI',
            symbol: 'FAI',
            name: 'FAI Stablecoin',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployFAI", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const fai = invokation.value!;
  tokenData.address = fai._address;

  world = await storeAndSaveContract(
    world,
    fai,
    'FAI',
    invokation,
    [
      { index: ['FAI'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, fai, tokenData };
}
