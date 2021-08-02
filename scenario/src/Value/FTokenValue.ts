import { Event } from '../Event';
import { World } from '../World';
import { FToken } from '../Contract/FToken';
import { FBep20Delegator } from '../Contract/FBep20Delegator';
import { Bep20 } from '../Contract/Bep20';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';
import { getWorldContractByAddress, getFTokenAddress } from '../ContractLookup';

export async function getFTokenV(world: World, event: Event): Promise<FToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getFTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<FToken>(world, address.val);
}

export async function getFBep20DelegatorV(world: World, event: Event): Promise<FBep20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getFTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<FBep20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(await fToken.methods.interestRateModel().call());
}

async function fTokenAddress(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(fToken._address);
}

async function getFTokenAdmin(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(await fToken.methods.admin().call());
}

async function getFTokenPendingAdmin(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(await fToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, fToken: FToken, user: string): Promise<NumberV> {
  return new NumberV(await fToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, fToken: FToken, user): Promise<NumberV> {
  return new NumberV(await fToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, fToken: FToken, user): Promise<NumberV> {
  return new NumberV(await fToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.totalReserves().call());
}

async function getComptroller(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(await fToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.getCash().call());
}

async function getInterestRate(world: World, fToken: FToken): Promise<NumberV> {
  return new NumberV(await fToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, fToken: FToken): Promise<AddressV> {
  return new AddressV(await (fToken as FBep20Delegator).methods.implementation().call());
}

export function fTokenFetchers() {
  return [
    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### Address

        * "FToken <FToken> Address" - Returns address of FToken contract
          * E.g. "FToken fZRX Address" - Returns fZRX's address
      `,
      "Address",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => fTokenAddress(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### InterestRateModel

        * "FToken <FToken> InterestRateModel" - Returns the interest rate model of FToken contract
          * E.g. "FToken fZRX InterestRateModel" - Returns fZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getInterestRateModel(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### Admin

        * "FToken <FToken> Admin" - Returns the admin of FToken contract
          * E.g. "FToken fZRX Admin" - Returns fZRX's admin
      `,
      "Admin",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getFTokenAdmin(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### PendingAdmin

        * "FToken <FToken> PendingAdmin" - Returns the pending admin of FToken contract
          * E.g. "FToken fZRX PendingAdmin" - Returns fZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getFTokenPendingAdmin(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### Underlying

        * "FToken <FToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "FToken fZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("fToken", getFTokenV)
      ],
      async (world, { fToken }) => new AddressV(await fToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "FToken <FToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "FToken fZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("fToken", getFTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { fToken, address }) => balanceOfUnderlying(world, fToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "FToken <FToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "FToken fZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("fToken", getFTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { fToken, address }) => getBorrowBalance(world, fToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "FToken <FToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "FToken fZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("fToken", getFTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { fToken, address }) => getBorrowBalanceStored(world, fToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### TotalBorrows

        * "FToken <FToken> TotalBorrows" - Returns the fToken's total borrow balance
          * E.g. "FToken fZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getTotalBorrows(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "FToken <FToken> TotalBorrowsCurrent" - Returns the fToken's total borrow balance with interest
          * E.g. "FToken fZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getTotalBorrowsCurrent(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### Reserves

        * "FToken <FToken> Reserves" - Returns the fToken's total reserves
          * E.g. "FToken fZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getTotalReserves(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### ReserveFactor

        * "FToken <FToken> ReserveFactor" - Returns reserve factor of FToken contract
          * E.g. "FToken fZRX ReserveFactor" - Returns fZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getReserveFactor(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### Comptroller

        * "FToken <FToken> Comptroller" - Returns the fToken's comptroller
          * E.g. "FToken fZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getComptroller(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### ExchangeRateStored

        * "FToken <FToken> ExchangeRateStored" - Returns the fToken's exchange rate (based on balances stored)
          * E.g. "FToken fZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getExchangeRateStored(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### ExchangeRate

        * "FToken <FToken> ExchangeRate" - Returns the fToken's current exchange rate
          * E.g. "FToken fZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getExchangeRate(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### Cash

        * "FToken <FToken> Cash" - Returns the fToken's current cash
          * E.g. "FToken fZRX Cash"
      `,
      "Cash",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getCash(world, fToken),
      { namePos: 1 }
    ),

    new Fetcher<{ fToken: FToken }, NumberV>(`
        #### InterestRate

        * "FToken <FToken> InterestRate" - Returns the fToken's current interest rate
          * E.g. "FToken fZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, {fToken}) => getInterestRate(world, fToken),
      {namePos: 1}
    ),
    new Fetcher<{fToken: FToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "FToken <FToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "FToken fZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("fToken", getFTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {fToken, signature}) => {
        const res = await world.web3.eth.call({
            to: fToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ fToken: FToken }, AddressV>(`
        #### Implementation

        * "FToken <FToken> Implementation" - Returns the fToken's current implementation
          * E.g. "FToken fDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("fToken", getFTokenV)
      ],
      (world, { fToken }) => getImplementation(world, fToken),
      { namePos: 1 }
    )
  ];
}

export async function getFTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("fToken", fTokenFetchers(), world, event);
}
