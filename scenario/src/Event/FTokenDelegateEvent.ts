import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { FToken, FTokenScenario } from '../Contract/FToken';
import { FBep20Delegate } from '../Contract/FBep20Delegate'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getFTokenDelegateData } from '../ContractLookup';
import { buildFTokenDelegate } from '../Builder/FTokenDelegateBuilder';
import { verify } from '../Verify';

async function genFTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, fTokenDelegate, delegateData } = await buildFTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added fToken ${delegateData.name} (${delegateData.contract}) at address ${fTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyFTokenDelegate(world: World, fTokenDelegate: FBep20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, fTokenDelegate._address);
  }

  return world;
}

export function fTokenDelegateCommands() {
  return [
    new Command<{ fTokenDelegateParams: EventV }>(`
        #### Deploy

        * "FTokenDelegate Deploy ...fTokenDelegateParams" - Generates a new FTokenDelegate
          * E.g. "FTokenDelegate Deploy FDaiDelegate fDAIDelegate"
      `,
      "Deploy",
      [new Arg("fTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { fTokenDelegateParams }) => genFTokenDelegate(world, from, fTokenDelegateParams.val)
    ),
    new View<{ fTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "FTokenDelegate <fTokenDelegate> Verify apiKey:<String>" - Verifies FTokenDelegate in BscScan
          * E.g. "FTokenDelegate fDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("fTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { fTokenDelegateArg, apiKey }) => {
        let [fToken, name, data] = await getFTokenDelegateData(world, fTokenDelegateArg.val);

        return await verifyFTokenDelegate(world, fToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processFTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("FTokenDelegate", fTokenDelegateCommands(), world, event, from);
}
