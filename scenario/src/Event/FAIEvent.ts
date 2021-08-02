import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { FAI, FAIScenario } from '../Contract/FAI';
import { buildFAI } from '../Builder/FAIBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getFAI } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genFAI(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, fai, tokenData } = await buildFAI(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed FAI (${fai.name}) to address ${fai._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyFAI(world: World, fai: FAI, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, fai._address);
  }

  return world;
}

async function approve(world: World, from: string, fai: FAI, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fai.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved FAI token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, fai: FAI, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fai.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FAI tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, fai: FAI, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fai.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} FAI tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, fai: FAIScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fai.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FAI tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, fai: FAIScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fai.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FAI tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

export function faiCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new FAI token
          * E.g. "FAI Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genFAI(world, from, params.val)
    ),

    new View<{ fai: FAI, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<FAI> Verify apiKey:<String> contractName:<String>=FAI" - Verifies FAI token in BscScan
          * E.g. "FAI Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("FAI") })
      ],
      async (world, { fai, apiKey, contractName }) => {
        return await verifyFAI(world, fai, apiKey.val, fai.name, contractName.val)
      }
    ),

    new Command<{ fai: FAI, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "FAI Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "FAI Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fai, spender, amount }) => {
        return approve(world, from, fai, spender.val, amount)
      }
    ),

    new Command<{ fai: FAI, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "FAI Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "FAI Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fai, recipient, amount }) => transfer(world, from, fai, recipient.val, amount)
    ),

    new Command<{ fai: FAI, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "FAI TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "FAI TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fai, owner, spender, amount }) => transferFrom(world, from, fai, owner.val, spender.val, amount)
    ),

    new Command<{ fai: FAIScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "FAI TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "FAI TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fai, recipients, amount }) => transferScenario(world, from, fai, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ fai: FAIScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "FAI TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "FAI TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fai, froms, amount }) => transferFromScenario(world, from, fai, froms.map(_from => _from.val), amount)
    )
  ];
}

export async function processFAIEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("FAI", faiCommands(), world, event, from);
}
