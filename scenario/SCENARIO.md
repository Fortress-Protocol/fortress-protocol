
# Types
* `name:<Type>` - Helper to describe arguments with names, not actually input this way
* `<Bool>` - `True` or `False`
* `<Number>` - A standard number (e.g. `5` or `6.0` or `10.0e18`)
* `<FToken>` - The local name for a given fToken when created, e.g. `fZRX`
* `<User>` - One of: `Admin, Bank, Geoff, Torrey, Robert, Coburn, Jared`
* `<String>` - A string, may be quoted but does not have to be if a single-word (e.g. `"Mint"` or `Mint`)
* `<Address>` - TODO
* `<Assertion>` - See assertions below.

# Events

## Core Events

* "History n:<Number>=5" - Prints history of actions
  * E.g. "History"
  * E.g. "History 10"
* `Read ...` - Reads given value and prints result
  * E.g. `Read FToken fBAT ExchangeRateStored` - Returns exchange rate of fBAT
* `Assert <Assertion>` - Validates given assertion, raising an exception if assertion fails
  * E.g. `Assert Equal (Bep20 BAT TokenBalance Geoff) (Exactly 5.0)` - Returns exchange rate of fBAT
* `FastForward n:<Number> Blocks` - For `FTokenScenario`, moves the block number forward n blocks. Note: in `FTokenScenario` the current block number is mocked (starting at 100000). Thus, this is the only way for the protocol to see a higher block number (for accruing interest).
  * E.g. `FastForward 5 Blocks` - Move block number forward 5 blocks.
* `Inspect` - Prints debugging information about the world
* `Debug message:<String>` - Same as inspect but prepends with a string
* `From <User> <Event>` - Runs event as the given user
  * E.g. `From Geoff (FToken fZRX Mint 5e18)`
* `Invariant <Invariant>` - Adds a new invariant to the world which is checked after each transaction
  * E.g. `Invariant Static (FToken fZRX TotalSupply)`
* `WipeInvariants` - Removes all invariants.
* `Comptroller <ComptrollerEvent>` - Runs given Comptroller event
  * E.g. `Comptroller _setReserveFactor 0.5`
* `FToken <FTokenEvent>` - Runs given FToken event
  * E.g. `FToken fZRX Mint 5e18`
* `Bep20 <Bep20Event>` - Runs given Bep20 event
  * E.g. `Bep20 ZRX Facuet Geoff 5e18`
* `InterestRateModel ...event` - Runs given interest rate model event
  * E.g. `InterestRateModel Deployed (Fixed 0.5)`
* `PriceOracle <PriceOracleEvent>` - Runs given Price Oracle event
  * E.g. `PriceOracle SetPrice fZRX 1.5`

## Comptroller Events

* "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller
  * E.g. "Comptroller Deploy Scenario (PriceOracle Address) 0.1 10"
* `Comptroller SetPaused action:<String> paused:<Bool>` - Pauses or unpaused given fToken function (e.g. Mint)
  * E.g. `Comptroller SetPaused Mint True`
* `Comptroller SupportMarket <FToken>` - Adds support in the Comptroller for the given fToken
  * E.g. `Comptroller SupportMarket fZRX`
* `Comptroller EnterMarkets <User> <FToken> ...` - User enters the given markets
  * E.g. `Comptroller EnterMarkets Geoff fZRX fBNB`
* `Comptroller SetMaxAssets <Number>` - Sets (or resets) the max allowed asset count
  * E.g. `Comptroller SetMaxAssets 4`
* `FToken <fToken> SetOracle oracle:<Contract>` - Sets the oracle
  * E.g. `Comptroller SetOracle (Fixed 1.5)`
* `Comptroller SetCollateralFactor <FToken> <Number>` - Sets the collateral factor for given fToken to number
  * E.g. `Comptroller SetCollateralFactor fZRX 0.1`
* `FastForward n:<Number> Blocks` - Moves the block number forward `n` blocks. Note: in `FTokenScenario` and `ComptrollerScenario` the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
  * E.g. `Comptroller FastForward 5 Blocks` - Move block number forward 5 blocks.

## fToken Events

* `FToken Deploy name:<FToken> underlying:<Contract> comptroller:<Contract> interestRateModel:<Contract> initialExchangeRate:<Number> decimals:<Number> admin:<Address>` - Generates a new comptroller and sets to world global
  * E.g. `FToken Deploy fZRX (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 18`
* `FToken <fToken> AccrueInterest` - Accrues interest for given token
  * E.g. `FToken fZRX AccrueInterest`
* `FToken <fToken> Mint <User> amount:<Number>` - Mints the given amount of fToken as specified user
  * E.g. `FToken fZRX Mint Geoff 1.0`
* `FToken <fToken> Redeem <User> amount:<Number>` - Redeems the given amount of fToken as specified user
      * E.g. `FToken fZRX Redeem Geoff 1.0e18`
* `FToken <fToken> Borrow <User> amount:<Number>` - Borrows the given amount of this fToken as specified user
      * E.g. `FToken fZRX Borrow Geoff 1.0e18`
* `FToken <fToken> ReduceReserves amount:<Number>` - Reduces the reserves of the fToken
      * E.g. `FToken fZRX ReduceReserves 1.0e18`
* `FToken <fToken> SetReserveFactor amount:<Number>` - Sets the reserve factor for the fToken
      * E.g. `FToken fZRX SetReserveFactor 0.1`
* `FToken <fToken> SetInterestRateModel interestRateModel:<Contract>` - Sets the interest rate model for the given fToken
  * E.g. `FToken fZRX SetInterestRateModel (Fixed 1.5)`
* `FToken <fToken> SetComptroller comptroller:<Contract>` - Sets the comptroller for the given fToken
  * E.g. `FToken fZRX SetComptroller Comptroller`
* `FToken <fToken> Mock variable:<String> value:<Number>` - Mocks a given value on fToken. Note: value must be a supported mock and this will only work on a FTokenScenario contract.
  * E.g. `FToken fZRX Mock totalBorrows 5.0e18`
  * E.g. `FToken fZRX Mock totalReserves 0.5e18`

## Erc-20 Events

* `Bep20 Deploy name:<Bep20>` - Generates a new BEP-20 token by name
  * E.g. `Bep20 Deploy ZRX`
* `Bep20 <Bep20> Approve <User> <Address> <Amount>` - Adds an allowance between user and address
  * E.g. `Bep20 ZRX Approve Geoff fZRX 1.0e18`
* `Bep20 <Bep20> Faucet <Address> <Amount>` - Adds an arbitrary balance to given user
  * E.g. `Bep20 ZRX Facuet Geoff 1.0e18`

## Price Oracle Events

* `Deploy` - Generates a new price oracle (note: defaults to (Fixed 1.0))
  * E.g. `PriceOracle Deploy (Fixed 1.0)`
  * E.g. `PriceOracle Deploy Simple`
  * E.g. `PriceOracle Deploy NotPriceOracle`
* `SetPrice <FToken> <Amount>` - Sets the per-bnb price for the given fToken
  * E.g. `PriceOracle SetPrice fZRX 1.0`

## Interest Rate Model Events

## Deploy

* `Deploy params:<String[]>` - Generates a new interest rate model (note: defaults to (Fixed 0.25))
  * E.g. `InterestRateModel Deploy (Fixed 0.5)`
  * E.g. `InterestRateModel Deploy Whitepaper`

# Values

## Core Values

* `True` - Returns true
* `False` - Returns false
* `Zero` - Returns 0
* `Some` - Returns 100e18
* `Little` - Returns 100e10
* `Exactly <Amount>` - Returns a strict numerical value
  * E.g. `Exactly 5.0`
* `Exp <Amount>` - Returns the mantissa for a given exp
  * E.g. `Exp 5.5`
* `Precisely <Amount>` - Matches a number to given number of significant figures
  * E.g. `Exactly 5.1000` - Matches to 5 sig figs
* `Anything` - Matches anything
* `Nothing` - Matches nothing
* `Default value:<Value> default:<Value>` - Returns value if truthy, otherwise default. Note: this does short-circuit
* `LastContract` - Returns the address of last constructed contract
* `User <...>` - Returns User value (see below)
* `Comptroller <...>` - Returns Comptroller value (see below)
* `FToken <...>` - Returns FToken value (see below)
* `Bep20 <...>` - Returns Bep20 value (see below)
* `InterestRateModel <...>` - Returns InterestRateModel value (see below)
* `PriceOracle <...>` - Returns PriceOracle value (see below)

## User Values

* `User <User> Address` - Returns address of user
  * E.g. `User Geoff Address` - Returns Geoff's address

## Comptroller Values

* `Comptroller Liquidity <User>` - Returns a given user's trued up liquidity
  * E.g. `Comptroller Liquidity Geoff`
* `Comptroller MembershipLength <User>` - Returns a given user's length of membership
  * E.g. `Comptroller MembershipLength Geoff`
* `Comptroller CheckMembership <User> <FToken>` - Returns one if user is in asset, zero otherwise.
  * E.g. `Comptroller CheckMembership Geoff fZRX`
* "Comptroller CheckListed <FToken>" - Returns true if market is listed, false otherwise.
  * E.g. "Comptroller CheckListed fZRX"

## FToken Values
* `FToken <FToken> UnderlyingBalance <User>` - Returns a user's underlying balance (based on given exchange rate)
  * E.g. `FToken fZRX UnderlyingBalance Geoff`
* `FToken <FToken> BorrowBalance <User>` - Returns a user's borrow balance (including interest)
  * E.g. `FToken fZRX BorrowBalance Geoff`
* `FToken <FToken> TotalBorrowBalance` - Returns the fToken's total borrow balance
  * E.g. `FToken fZRX TotalBorrowBalance`
* `FToken <FToken> Reserves` - Returns the fToken's total reserves
  * E.g. `FToken fZRX Reserves`
* `FToken <FToken> Comptroller` - Returns the fToken's comptroller
  * E.g. `FToken fZRX Comptroller`
* `FToken <FToken> PriceOracle` - Returns the fToken's price oracle
  * E.g. `FToken fZRX PriceOracle`
* `FToken <FToken> ExchangeRateStored` - Returns the fToken's exchange rate (based on balances stored)
  * E.g. `FToken fZRX ExchangeRateStored`
* `FToken <FToken> ExchangeRate` - Returns the fToken's current exchange rate
  * E.g. `FToken fZRX ExchangeRate`

## Erc-20 Values

* `Bep20 <Bep20> Address` - Returns address of BEP-20 contract
  * E.g. `Bep20 ZRX Address` - Returns ZRX's address
* `Bep20 <Bep20> Name` - Returns name of BEP-20 contract
  * E.g. `Bep20 ZRX Address` - Returns ZRX's name
* `Bep20 <Bep20> Symbol` - Returns symbol of BEP-20 contract
  * E.g. `Bep20 ZRX Symbol` - Returns ZRX's symbol
* `Bep20 <Bep20> Decimals` - Returns number of decimals in BEP-20 contract
  * E.g. `Bep20 ZRX Decimals` - Returns ZRX's decimals
* `Bep20 <Bep20> TotalSupply` - Returns the BEP-20 token's total supply
  * E.g. `Bep20 ZRX TotalSupply`
  * E.g. `Bep20 fZRX TotalSupply`
* `Bep20 <Bep20> TokenBalance <Address>` - Returns the BEP-20 token balance of a given address
  * E.g. `Bep20 ZRX TokenBalance Geoff` - Returns a user's ZRX balance
  * E.g. `Bep20 fZRX TokenBalance Geoff` - Returns a user's fZRX balance
  * E.g. `Bep20 ZRX TokenBalance fZRX` - Returns fZRX's ZRX balance
* `Bep20 <Bep20> Allowance owner:<Address> spender:<Address>` - Returns the BEP-20 allowance from owner to spender
  * E.g. `Bep20 ZRX Allowance Geoff Torrey` - Returns the ZRX allowance of Geoff to Torrey
  * E.g. `Bep20 fZRX Allowance Geoff Coburn` - Returns the fZRX allowance of Geoff to Coburn
  * E.g. `Bep20 ZRX Allowance Geoff fZRX` - Returns the ZRX allowance of Geoff to the fZRX fToken

## PriceOracle Values

* `Address` - Gets the address of the global price oracle
* `Price asset:<Address>` - Gets the price of the given asset

## Interest Rate Model Values

* `Address` - Gets the address of the global interest rate model

# Assertions

* `Equal given:<Value> expected:<Value>` - Asserts that given matches expected.
  * E.g. `Assert Equal (Exactly 0) Zero`
  * E.g. `Assert Equal (FToken fZRX TotalSupply) (Exactly 55)`
  * E.g. `Assert Equal (FToken fZRX Comptroller) (Comptroller Address)`
* `True given:<Value>` - Asserts that given is true.
  * E.g. `Assert True (Comptroller CheckMembership Geoff fBNB)`
* `False given:<Value>` - Asserts that given is false.
  * E.g. `Assert False (Comptroller CheckMembership Geoff fBNB)`
* `Failure error:<String> info:<String> detail:<Number?>` - Asserts that last transaction had a graceful failure with given error, info and detail.
  * E.g. `Assert Failure UNAUTHORIZED SUPPORT_MARKET_OWNER_CHECK`
  * E.g. `Assert Failure MATH_ERROR MINT_CALCULATE_BALANCE 5`
* `Revert` - Asserts that the last transaction reverted.
* `Success` - Asserts that the last transaction completed successfully (that is, did not revert nor emit graceful failure).
* `Log name:<String> ((key:<String> value:<Value>) ...)` - Asserts that last transaction emitted log with given name and key-value pairs.
  * E.g. `Assert Log Minted (("account" (User Geoff address)) ("amount" (Exactly 55)))`
