import { Event } from '../Event';
import { World } from '../World';
import { FBep20Delegate } from '../Contract/FBep20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getFTokenDelegateAddress } from '../ContractLookup';

export async function getFTokenDelegateV(world: World, event: Event): Promise<FBep20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getFTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<FBep20Delegate>(world, address.val);
}

async function fTokenDelegateAddress(world: World, fTokenDelegate: FBep20Delegate): Promise<AddressV> {
  return new AddressV(fTokenDelegate._address);
}

export function fTokenDelegateFetchers() {
  return [
    new Fetcher<{ fTokenDelegate: FBep20Delegate }, AddressV>(`
        #### Address

        * "FTokenDelegate <FTokenDelegate> Address" - Returns address of FTokenDelegate contract
          * E.g. "FTokenDelegate fDaiDelegate Address" - Returns fDaiDelegate's address
      `,
      "Address",
      [
        new Arg("fTokenDelegate", getFTokenDelegateV)
      ],
      (world, { fTokenDelegate }) => fTokenDelegateAddress(world, fTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getFTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("FTokenDelegate", fTokenDelegateFetchers(), world, event);
}
