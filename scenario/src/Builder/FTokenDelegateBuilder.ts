import { Event } from '../Event';
import { World } from '../World';
import { FBep20Delegate, FBep20DelegateScenario } from '../Contract/FBep20Delegate';
import { FToken } from '../Contract/FToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const FDaiDelegateContract = getContract('FDaiDelegate');
const FDaiDelegateScenarioContract = getTestContract('FDaiDelegateScenario');
const FBep20DelegateContract = getContract('FBep20Delegate');
const FBep20DelegateScenarioContract = getTestContract('FBep20DelegateScenario');


export interface FTokenDelegateData {
  invokation: Invokation<FBep20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildFTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; fTokenDelegate: FBep20Delegate; delegateData: FTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, FTokenDelegateData>(
      `
        #### FDaiDelegate

        * "FDaiDelegate name:<String>"
          * E.g. "FTokenDelegate Deploy FDaiDelegate fDAIDelegate"
      `,
      'FDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await FDaiDelegateContract.deploy<FBep20Delegate>(world, from, []),
          name: name.val,
          contract: 'FDaiDelegate',
          description: 'Standard FDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, FTokenDelegateData>(
      `
        #### FDaiDelegateScenario

        * "FDaiDelegateScenario name:<String>" - A FDaiDelegate Scenario for local testing
          * E.g. "FTokenDelegate Deploy FDaiDelegateScenario fDAIDelegate"
      `,
      'FDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await FDaiDelegateScenarioContract.deploy<FBep20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'FDaiDelegateScenario',
          description: 'Scenario FDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, FTokenDelegateData>(
      `
        #### FBep20Delegate

        * "FBep20Delegate name:<String>"
          * E.g. "FTokenDelegate Deploy FBep20Delegate fDAIDelegate"
      `,
      'FBep20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await FBep20DelegateContract.deploy<FBep20Delegate>(world, from, []),
          name: name.val,
          contract: 'FBep20Delegate',
          description: 'Standard FBep20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, FTokenDelegateData>(
      `
        #### FBep20DelegateScenario

        * "FBep20DelegateScenario name:<String>" - A FBep20Delegate Scenario for local testing
          * E.g. "FTokenDelegate Deploy FBep20DelegateScenario fDAIDelegate"
      `,
      'FBep20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await FBep20DelegateScenarioContract.deploy<FBep20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'FBep20DelegateScenario',
          description: 'Scenario FBep20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, FTokenDelegateData>("DeployFToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const fTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    fTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['FTokenDelegate', delegateData.name],
        data: {
          address: fTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, fTokenDelegate, delegateData };
}
