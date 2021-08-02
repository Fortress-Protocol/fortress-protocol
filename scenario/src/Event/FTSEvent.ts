import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { FTS, FTSScenario } from '../Contract/Fortress';
import { buildFTS } from '../Builder/FTSBuilder';
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
import { getFTS } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genFTS(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, fts, tokenData } = await buildFTS(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed FTS (${fts.name}) to address ${fts._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyFTS(world: World, fts: FTS, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, fts._address);
  }

  return world;
}

async function approve(world: World, from: string, fts: FTS, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fts.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved FTS token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, fts: FTS, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fts.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FTS tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, fts: FTS, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fts.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} FTS tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, fts: FTSScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fts.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FTS tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, fts: FTSScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fts.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} FTS tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, fts: FTS, account: string): Promise<World> {
  let invokation = await invoke(world, fts.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  fts: FTS,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set FTS blockNumber to ${blockNumber.show()}`,
    await invoke(world, fts.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function ftsCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new FTS token
          * E.g. "FTS Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genFTS(world, from, params.val)
    ),

    new View<{ fts: FTS, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<FTS> Verify apiKey:<String> contractName:<String>=FTS" - Verifies FTS token in BscScan
          * E.g. "FTS Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("FTS") })
      ],
      async (world, { fts, apiKey, contractName }) => {
        return await verifyFTS(world, fts, apiKey.val, fts.name, contractName.val)
      }
    ),

    new Command<{ fts: FTS, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "FTS Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "FTS Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fts, spender, amount }) => {
        return approve(world, from, fts, spender.val, amount)
      }
    ),

    new Command<{ fts: FTS, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "FTS Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "FTS Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fts, recipient, amount }) => transfer(world, from, fts, recipient.val, amount)
    ),

    new Command<{ fts: FTS, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "FTS TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "FTS TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fts, owner, spender, amount }) => transferFrom(world, from, fts, owner.val, spender.val, amount)
    ),

    new Command<{ fts: FTSScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "FTS TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "FTS TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fts, recipients, amount }) => transferScenario(world, from, fts, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ fts: FTSScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "FTS TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "FTS TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fts, froms, amount }) => transferFromScenario(world, from, fts, froms.map(_from => _from.val), amount)
    ),

    new Command<{ fts: FTS, account: AddressV }>(`
        #### Delegate

        * "FTS Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "FTS Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { fts, account }) => delegate(world, from, fts, account.val)
    ),
    new Command<{ fts: FTS, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the FTS Harness
      * E.g. "FTS SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('fts', getFTS, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { fts, blockNumber }) => setBlockNumber(world, from, fts, blockNumber)
      )
  ];
}

export async function processFTSEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("FTS", ftsCommands(), world, event, from);
}
