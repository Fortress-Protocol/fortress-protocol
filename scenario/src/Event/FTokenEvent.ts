import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { FToken, FTokenScenario } from '../Contract/FToken';
import { FBep20Delegate } from '../Contract/FBep20Delegate'
import { FBep20Delegator } from '../Contract/FBep20Delegator'
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
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { FTokenErrorReporter } from '../ErrorReporter';
import { getComptroller, getFTokenData } from '../ContractLookup';
import { getExpMantissa } from '../Encoding';
import { buildFToken } from '../Builder/FTokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getFTokenV, getFBep20DelegatorV } from '../Value/FTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genFToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, fToken, tokenData } = await buildFToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added fToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${fToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, fToken: FToken): Promise<World> {
  let invokation = await invoke(world, fToken.methods.accrueInterest(), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, fToken: FToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, fToken.methods.mint(amount.encode()), from, FTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, fToken.methods.mint(), from, FTokenErrorReporter);
  }

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, fToken: FToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods.redeem(tokens.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, fToken: FToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods.redeemUnderlying(amount.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, fToken: FToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods.borrow(amount.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, fToken: FToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, fToken.methods.repayBorrow(amount.encode()), from, FTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, fToken.methods.repayBorrow(), from, FTokenErrorReporter);
  }

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, fToken: FToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, fToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, FTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, fToken.methods.repayBorrowBehalf(behalf), from, FTokenErrorReporter);
  }

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, fToken: FToken, borrower: string, collateral: FToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, fToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, FTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, fToken.methods.liquidateBorrow(borrower, collateral._address), from, FTokenErrorReporter);
  }

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, fToken: FToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, fToken: FToken, treasure: FToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, fToken: FToken, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, fToken.methods._setPendingAdmin(newPendingAdmin), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, fToken: FToken): Promise<World> {
  let invokation = await invoke(world, fToken.methods._acceptAdmin(), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, fToken: FToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods._addReserves(amount.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, fToken: FToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods._reduceReserves(amount.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function transferReserves(world: World, from: string, fToken: FToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods._transferReserves(amount.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} transfer reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, fToken: FToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, fToken.methods._setReserveFactor(reserveFactor.encode()), from, FTokenErrorReporter);

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, fToken: FToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, fToken.methods._setInterestRateModel(interestRateModel), from, FTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${fToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, fToken: FToken, comptroller: string): Promise<World> {
  let invokation = await invoke(world, fToken.methods._setComptroller(comptroller), from, FTokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${fToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  fToken: FToken,
  becomeImplementationData: string
): Promise<World> {

  const fBep20Delegate = getContract('FBep20Delegate');
  const fBep20DelegateContract = await fBep20Delegate.at<FBep20Delegate>(world, fToken._address);

  let invokation = await invoke(
    world,
    fBep20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    FTokenErrorReporter
  );

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  fToken: FToken,
): Promise<World> {

  const fBep20Delegate = getContract('FBep20Delegate');
  const fBep20DelegateContract = await fBep20Delegate.at<FBep20Delegate>(world, fToken._address);

  let invokation = await invoke(
    world,
    fBep20DelegateContract.methods._resignImplementation(),
    from,
    FTokenErrorReporter
  );

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  fToken: FBep20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    fToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    FTokenErrorReporter
  );

  world = addAction(
    world,
    `FToken ${fToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, fToken: FToken): Promise<World> {
  let invokation = await invoke(world, fToken.methods.donate(), from, FTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${fToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function setFTokenMock(world: World, from: string, fToken: FTokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = fToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = fToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for fToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${fToken.name}`,
    invokation
  );

  return world;
}

async function verifyFToken(world: World, fToken: FToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, fToken._address);
  }

  return world;
}

async function printMinters(world: World, fToken: FToken): Promise<World> {
  let events = await getPastEvents(world, fToken, fToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, fToken: FToken): Promise<World> {
  let events = await getPastEvents(world, fToken, fToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, fToken: FToken): Promise<World> {
  let mintEvents = await getPastEvents(world, fToken, fToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, fToken, fToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let comptroller = await getComptroller(world);

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

export function fTokenCommands() {
  return [
    new Command<{ fTokenParams: EventV }>(`
        #### Deploy

        * "FToken Deploy ...fTokenParams" - Generates a new FToken
          * E.g. "FToken fZRX Deploy"
      `,
      "Deploy",
      [new Arg("fTokenParams", getEventV, { variadic: true })],
      (world, from, { fTokenParams }) => genFToken(world, from, fTokenParams.val)
    ),
    new View<{ fTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "FToken <fToken> Verify apiKey:<String>" - Verifies FToken in BscScan
          * E.g. "FToken fZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("fTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { fTokenArg, apiKey }) => {
        let [fToken, name, data] = await getFTokenData(world, fTokenArg.val);

        return await verifyFToken(world, fToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken }>(`
        #### AccrueInterest

        * "FToken <fToken> AccrueInterest" - Accrues interest for given token
          * E.g. "FToken fZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, from, { fToken }) => accrueInterest(world, from, fToken),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "FToken <fToken> Mint amount:<Number>" - Mints the given amount of fToken as specified user
          * E.g. "FToken fZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { fToken, amount }) => mint(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, tokens: NumberV }>(`
        #### Redeem

        * "FToken <fToken> Redeem tokens:<Number>" - Redeems the given amount of fTokens as specified user
          * E.g. "FToken fZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("fToken", getFTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { fToken, tokens }) => redeem(world, from, fToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "FToken <fToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "FToken fZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fToken, amount }) => redeemUnderlying(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV }>(`
        #### Borrow

        * "FToken <fToken> Borrow amount:<Number>" - Borrows the given amount of this fToken as specified user
          * E.g. "FToken fZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { fToken, amount }) => borrow(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "FToken <fToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "FToken fZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { fToken, amount }) => repayBorrow(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "FToken <fToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "FToken fZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("fToken", getFTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { fToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, fToken: FToken, collateral: FToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "FToken <fToken> Liquidate borrower:<User> fTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "FToken fZRX Liquidate Geoff fBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("fToken", getFTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getFTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, fToken, collateral, repayAmount }) => liquidateBorrow(world, from, fToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "FToken <fToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other FToken)
          * E.g. "FToken fZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("fToken", getFTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { fToken, liquidator, borrower, seizeTokens }) => seize(world, from, fToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, treasure: FToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "FToken <fToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "FToken vEVL EvilSeize fZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("fToken", getFTokenV),
        new Arg("treasure", getFTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { fToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, fToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV }>(`
        #### ReduceReserves

        * "FToken <fToken> ReduceReserves amount:<Number>" - Reduces the reserves of the fToken
          * E.g. "FToken fZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fToken, amount }) => reduceReserves(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV }>(`
        #### TransferReserves

        * "FToken <fToken> TransferReserves amount:<Number>" - Transfer the reserves of the fToken
          * E.g. "FToken fZRX TransferReserves 1.0e18"
      `,
      "TransferReserves",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fToken, amount }) => transferReserves(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, amount: NumberV }>(`
    #### AddReserves

    * "FToken <fToken> AddReserves amount:<Number>" - Adds reserves to the fToken
      * E.g. "FToken fZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("fToken", getFTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { fToken, amount }) => addReserves(world, from, fToken, amount),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, newPendingAdmin: AddressV }>(`
        #### SetPendingAdmin

        * "FToken <fToken> SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the fToken
          * E.g. "FToken fZRX SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("fToken", getFTokenV),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, { fToken, newPendingAdmin }) => setPendingAdmin(world, from, fToken, newPendingAdmin.val),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken }>(`
        #### AcceptAdmin

        * "FToken <fToken> AcceptAdmin" - Accepts admin for the fToken
          * E.g. "From Geoff (FToken fZRX AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, from, { fToken }) => acceptAdmin(world, from, fToken),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "FToken <fToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the fToken
          * E.g. "FToken fZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("fToken", getFTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { fToken, reserveFactor }) => setReserveFactor(world, from, fToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "FToken <fToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given fToken
          * E.g. "FToken fZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("fToken", getFTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { fToken, interestRateModel }) => setInterestRateModel(world, from, fToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, comptroller: AddressV }>(`
        #### SetComptroller

        * "FToken <fToken> SetComptroller comptroller:<Contract>" - Sets the comptroller for the given fToken
          * E.g. "FToken fZRX SetComptroller Comptroller"
      `,
      "SetComptroller",
      [
        new Arg("fToken", getFTokenV),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, { fToken, comptroller }) => setComptroller(world, from, fToken, comptroller.val),
      { namePos: 1 }
    ),
    new Command<{
      fToken: FToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "FToken <fToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "FToken fDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('fToken', getFTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { fToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          fToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{fToken: FToken;}>(
      `
        #### ResignImplementation

        * "FToken <fToken> ResignImplementation"
          * E.g. "FToken fDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('fToken', getFTokenV)],
      (world, from, { fToken }) =>
        resignImplementation(
          world,
          from,
          fToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      fToken: FBep20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "FToken <fToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "FToken fDAI SetImplementation (FToken fDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('fToken', getFBep20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { fToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          fToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken }>(`
        #### Donate

        * "FToken <fToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (FToken fBNB Donate))"
      `,
      "Donate",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, from, { fToken }) => donate(world, from, fToken),
      { namePos: 1 }
    ),
    new Command<{ fToken: FToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "FToken <fToken> Mock variable:<String> value:<Number>" - Mocks a given value on fToken. Note: value must be a supported mock and this will only work on a "FTokenScenario" contract.
          * E.g. "FToken fZRX Mock totalBorrows 5.0e18"
          * E.g. "FToken fZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("fToken", getFTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { fToken, variable, value }) => setFTokenMock(world, from, <FTokenScenario>fToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ fToken: FToken }>(`
        #### Minters

        * "FToken <fToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => printMinters(world, fToken),
      { namePos: 1 }
    ),
    new View<{ fToken: FToken }>(`
        #### Borrowers

        * "FToken <fToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => printBorrowers(world, fToken),
      { namePos: 1 }
    ),
    new View<{ fToken: FToken }>(`
        #### Liquidity

        * "FToken <fToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => printLiquidity(world, fToken),
      { namePos: 1 }
    ),
    new View<{ fToken: FToken, input: StringV }>(`
        #### Decode

        * "Decode <fToken> input:<String>" - Prints information about a call to a fToken contract
      `,
      "Decode",
      [
        new Arg("fToken", getFTokenV),
        new Arg("input", getStringV)

      ],
      (world, { fToken, input }) => decodeCall(world, fToken, input.val),
      { namePos: 1 }
    )
  ];
}

export async function processFTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("FToken", fTokenCommands(), world, event, from);
}
