import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Comptroller} from '../Contract/Comptroller';
import {ComptrollerImpl} from '../Contract/ComptrollerImpl';
import {FToken} from '../Contract/FToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {ComptrollerErrorReporter} from '../ErrorReporter';
import {getComptroller, getComptrollerImpl} from '../ContractLookup';
import {getLiquidity} from '../Value/ComptrollerValue';
import {getFTokenV} from '../Value/FTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genComptroller(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, comptrollerImpl: comptroller, comptrollerImplData: comptrollerData} = await buildComptrollerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Comptroller (${comptrollerData.description}) at address ${comptroller._address}`,
    comptrollerData.invokation
  );

  return world;
};

async function setProtocolPaused(world: World, from: string, comptroller: Comptroller, isPaused: boolean): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setProtocolPaused(isPaused), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: set protocol paused to ${isPaused}`,
    invokation
  );

  return world;
}

async function setMaxAssets(world: World, from: string, comptroller: Comptroller, numberOfAssets: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMaxAssets(numberOfAssets.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set max assets to ${numberOfAssets.show()}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, comptroller: Comptroller, liquidationIncentive: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, comptroller: Comptroller, fToken: FToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${fToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(fToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${fToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, comptroller: Comptroller, fToken: FToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.unlist(fToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${fToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, comptroller: Comptroller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.enterMarkets(assets), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, comptroller: Comptroller, asset: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.exitMarket(asset), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setPriceOracle(world: World, from: string, comptroller: Comptroller, priceOracleAddr: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPriceOracle(priceOracleAddr), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, comptroller: Comptroller, fToken: FToken, collateralFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCollateralFactor(fToken._address, collateralFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${fToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, comptroller: Comptroller, closeFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCloseFactor(closeFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function fastForward(world: World, from: string, comptroller: Comptroller, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.fastForward(blocks.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, comptroller: Comptroller, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: comptroller._address,
      data: fnData,
      from: from
    })
  return world;
}

async function addFortressMarkets(world: World, from: string, comptroller: Comptroller, fTokens: FToken[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._addFortressMarkets(fTokens.map(c => c._address)), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Added Fortress markets ${fTokens.map(c => c.name)}`,
    invokation
  );

  return world;
}

async function dropFortressMarket(world: World, from: string, comptroller: Comptroller, fToken: FToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._dropFortressMarket(fToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Drop Fortress market ${fToken.name}`,
    invokation
  );

  return world;
}

async function refreshFortressSpeeds(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.refreshFortressSpeeds(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Refreshed Fortress speeds`,
    invokation
  );

  return world;
}

async function claimFortress(world: World, from: string, comptroller: Comptroller, holder: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.claimFortress(holder), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `FTS claimed by ${holder}`,
    invokation
  );

  return world;
}

async function setFortressRate(world: World, from: string, comptroller: Comptroller, rate: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setFortressRate(rate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `FTS rate set to ${rate.show()}`,
    invokation
  );

  return world;
}

async function setTreasuryData(
  world: World,
  from: string,
  comptroller: Comptroller,
  guardian: string,
  address: string
): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setTreasuryData(guardian, address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set treasury data to guardian: ${guardian}, address: ${address}}`,
    invokation
  );

  return world;
}

async function setFortressSpeed(world: World, from: string, comptroller: Comptroller, fToken: FToken, speed: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setFortressSpeed(fToken._address, speed.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fortress speed for market ${fToken._address} set to ${speed.show()}`,
    invokation
  );

  return world;
}

async function printLiquidity(world: World, comptroller: Comptroller): Promise<World> {
  let enterEvents = await getPastEvents(world, comptroller, 'StdComptroller', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

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

async function setPendingAdmin(world: World, from: string, comptroller: Comptroller, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPendingAdmin(newPendingAdmin), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._acceptAdmin(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setMarketBorrowCaps(world: World, from: string, comptroller: Comptroller, fTokens: FToken[], borrowCaps: NumberV[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMarketBorrowCaps(fTokens.map(c => c._address), borrowCaps.map(c => c.encode())), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Borrow caps on ${fTokens} set to ${borrowCaps}`,
    invokation
  );

  return world;
}

async function setBorrowCapGuardian(world: World, from: string, comptroller: Comptroller, newBorrowCapGuardian: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setBorrowCapGuardian(newBorrowCapGuardian), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets borrow cap guardian to ${newBorrowCapGuardian}`,
    invokation
  );

  return world;
}

export function comptrollerCommands() {
  return [
    new Command<{comptrollerParams: EventV}>(`
        #### Deploy

        * "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller (not as Impl)
          * E.g. "Comptroller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("comptrollerParams", getEventV, {variadic: true})],
      (world, from, {comptrollerParams}) => genComptroller(world, from, comptrollerParams.val)
    ),
    new Command<{comptroller: Comptroller, isPaused: BoolV}>(`
        #### SetProtocolPaused

        * "Comptroller SetProtocolPaused <Bool>" - Pauses or unpaused protocol
          * E.g. "Comptroller SetProtocolPaused True"
      `,
      "SetProtocolPaused",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("isPaused", getBoolV)
      ],
      (world, from, {comptroller, isPaused}) => setProtocolPaused(world, from, comptroller, isPaused.val)
    ),
    new Command<{comptroller: Comptroller, fToken: FToken}>(`
        #### SupportMarket

        * "Comptroller SupportMarket <FToken>" - Adds support in the Comptroller for the given fToken
          * E.g. "Comptroller SupportMarket fZRX"
      `,
      "SupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV)
      ],
      (world, from, {comptroller, fToken}) => supportMarket(world, from, comptroller, fToken)
    ),
    new Command<{comptroller: Comptroller, fToken: FToken}>(`
        #### UnList

        * "Comptroller UnList <FToken>" - Mock unlists a given market in tests
          * E.g. "Comptroller UnList fZRX"
      `,
      "UnList",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV)
      ],
      (world, from, {comptroller, fToken}) => unlistMarket(world, from, comptroller, fToken)
    ),
    new Command<{comptroller: Comptroller, fTokens: FToken[]}>(`
        #### EnterMarkets

        * "Comptroller EnterMarkets (<FToken> ...)" - User enters the given markets
          * E.g. "Comptroller EnterMarkets (fZRX fBNB)"
      `,
      "EnterMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fTokens", getFTokenV, {mapped: true})
      ],
      (world, from, {comptroller, fTokens}) => enterMarkets(world, from, comptroller, fTokens.map((c) => c._address))
    ),
    new Command<{comptroller: Comptroller, fToken: FToken}>(`
        #### ExitMarket

        * "Comptroller ExitMarket <FToken>" - User exits the given markets
          * E.g. "Comptroller ExitMarket fZRX"
      `,
      "ExitMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV)
      ],
      (world, from, {comptroller, fToken}) => exitMarket(world, from, comptroller, fToken._address)
    ),
    new Command<{comptroller: Comptroller, maxAssets: NumberV}>(`
        #### SetMaxAssets

        * "Comptroller SetMaxAssets <Number>" - Sets (or resets) the max allowed asset count
          * E.g. "Comptroller SetMaxAssets 4"
      `,
      "SetMaxAssets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("maxAssets", getNumberV)
      ],
      (world, from, {comptroller, maxAssets}) => setMaxAssets(world, from, comptroller, maxAssets)
    ),
    new Command<{comptroller: Comptroller, liquidationIncentive: NumberV}>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Comptroller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberV)
      ],
      (world, from, {comptroller, liquidationIncentive}) => setLiquidationIncentive(world, from, comptroller, liquidationIncentive)
    ),
    new Command<{comptroller: Comptroller, priceOracle: AddressV}>(`
        #### SetPriceOracle

        * "Comptroller SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "Comptroller SetPriceOracle 0x..."
      `,
      "SetPriceOracle",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("priceOracle", getAddressV)
      ],
      (world, from, {comptroller, priceOracle}) => setPriceOracle(world, from, comptroller, priceOracle.val)
    ),
    new Command<{comptroller: Comptroller, fToken: FToken, collateralFactor: NumberV}>(`
        #### SetCollateralFactor

        * "Comptroller SetCollateralFactor <FToken> <Number>" - Sets the collateral factor for given fToken to number
          * E.g. "Comptroller SetCollateralFactor fZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV),
        new Arg("collateralFactor", getExpNumberV)
      ],
      (world, from, {comptroller, fToken, collateralFactor}) => setCollateralFactor(world, from, comptroller, fToken, collateralFactor)
    ),
    new Command<{comptroller: Comptroller, closeFactor: NumberV}>(`
        #### SetCloseFactor

        * "Comptroller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Comptroller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {comptroller, closeFactor}) => setCloseFactor(world, from, comptroller, closeFactor)
    ),
    new Command<{comptroller: Comptroller, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "Comptroller SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the Comptroller
          * E.g. "Comptroller SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, {comptroller, newPendingAdmin}) => setPendingAdmin(world, from, comptroller, newPendingAdmin.val)
    ),
    new Command<{comptroller: Comptroller}>(`
        #### AcceptAdmin

        * "Comptroller AcceptAdmin" - Accepts admin for the Comptroller
          * E.g. "From Geoff (Comptroller AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, from, {comptroller}) => acceptAdmin(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "FTokenScenario" and "ComptrollerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Comptroller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {comptroller, blocks}) => fastForward(world, from, comptroller, blocks)
    ),
    new View<{comptroller: Comptroller}>(`
        #### Liquidity

        * "Comptroller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => printLiquidity(world, comptroller)
    ),
    new View<{comptroller: Comptroller, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Comptroller contract
      `,
      "Decode",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {comptroller, input}) => decodeCall(world, comptroller, input.val)
    ),

    new Command<{comptroller: Comptroller, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * Comptroller Send functionSignature:<String> callArgs[] - Sends any transaction to comptroller
      * E.g: Comptroller Send "setFTSAddress(address)" (Address FTS)
      `,
      "Send",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {comptroller, signature, callArgs}) => sendAny(world, from, comptroller, signature.val, rawValues(callArgs))
    ),
    new Command<{comptroller: Comptroller, fTokens: FToken[]}>(`
      #### AddFortressMarkets

      * "Comptroller AddFortressMarkets (<Address> ...)" - Makes a market FTS-enabled
      * E.g. "Comptroller AddFortressMarkets (fZRX fBAT)
      `,
      "AddFortressMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fTokens", getFTokenV, {mapped: true})
      ],
      (world, from, {comptroller, fTokens}) => addFortressMarkets(world, from, comptroller, fTokens)
     ),
    new Command<{comptroller: Comptroller, fToken: FToken}>(`
      #### DropFortressMarket

      * "Comptroller DropFortressMarket <Address>" - Makes a market FTS
      * E.g. "Comptroller DropFortressMarket fZRX
      `,
      "DropFortressMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV)
      ],
      (world, from, {comptroller, fToken}) => dropFortressMarket(world, from, comptroller, fToken)
     ),

    new Command<{comptroller: Comptroller}>(`
      #### RefreshFortressSpeeds

      * "Comptroller RefreshFortressSpeeds" - Recalculates all the Fortress market speeds
      * E.g. "Comptroller RefreshFortressSpeeds
      `,
      "RefreshFortressSpeeds",
      [
        new Arg("comptroller", getComptroller, {implicit: true})
      ],
      (world, from, {comptroller}) => refreshFortressSpeeds(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, holder: AddressV}>(`
      #### ClaimFortress

      * "Comptroller ClaimFortress <holder>" - Claims fts
      * E.g. "Comptroller ClaimFortress Geoff
      `,
      "ClaimFortress",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("holder", getAddressV)
      ],
      (world, from, {comptroller, holder}) => claimFortress(world, from, comptroller, holder.val)
    ),
    new Command<{comptroller: Comptroller, rate: NumberV}>(`
      #### SetFortressRate

      * "Comptroller SetFortressRate <rate>" - Sets Fortress rate
      * E.g. "Comptroller SetFortressRate 1e18
      `,
      "SetFortressRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("rate", getNumberV)
      ],
      (world, from, {comptroller, rate}) => setFortressRate(world, from, comptroller, rate)
    ),
    new Command<{comptroller: Comptroller, guardian: AddressV, address: AddressV}>(`
      #### SetTreasuryData

      * "Comptroller SetTreasuryData <guardian> <address>" - Sets Treasury Data
      * E.g. "Comptroller SetTreasuryData 0x.. 0x..
      `,
      "SetTreasuryData",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("guardian", getAddressV),
        new Arg("address", getAddressV)
      ],
      (world, from, {comptroller, guardian, address}) => setTreasuryData(world, from, comptroller, guardian.val, address.val)
    ),
    new Command<{comptroller: Comptroller, fToken: FToken, speed: NumberV}>(`
      #### SetFortressSpeed
      * "Comptroller SetFortressSpeed <fToken> <rate>" - Sets FTS speed for market
      * E.g. "Comptroller SetFortressSpeed fToken 1000
      `,
      "SetFortressSpeed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fToken", getFTokenV),
        new Arg("speed", getNumberV)
      ],
      (world, from, {comptroller, fToken, speed}) => setFortressSpeed(world, from, comptroller, fToken, speed)
    ),
    new Command<{comptroller: Comptroller, fTokens: FToken[], borrowCaps: NumberV[]}>(`
      #### SetMarketBorrowCaps
      * "Comptroller SetMarketBorrowCaps (<FToken> ...) (<borrowCap> ...)" - Sets Market Borrow Caps
      * E.g "Comptroller SetMarketBorrowCaps (fZRX fUSDC) (10000.0e18, 1000.0e6)
      `,
      "SetMarketBorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("fTokens", getFTokenV, {mapped: true}),
        new Arg("borrowCaps", getNumberV, {mapped: true})
      ],
      (world, from, {comptroller,fTokens,borrowCaps}) => setMarketBorrowCaps(world, from, comptroller, fTokens, borrowCaps)
    ),
    new Command<{comptroller: Comptroller, newBorrowCapGuardian: AddressV}>(`
        #### SetBorrowCapGuardian
        * "Comptroller SetBorrowCapGuardian newBorrowCapGuardian:<Address>" - Sets the Borrow Cap Guardian for the Comptroller
          * E.g. "Comptroller SetBorrowCapGuardian Geoff"
      `,
      "SetBorrowCapGuardian",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newBorrowCapGuardian", getAddressV)
      ],
      (world, from, {comptroller, newBorrowCapGuardian}) => setBorrowCapGuardian(world, from, comptroller, newBorrowCapGuardian.val)
    )
  ];
}

export async function processComptrollerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Comptroller", comptrollerCommands(), world, event, from);
}
