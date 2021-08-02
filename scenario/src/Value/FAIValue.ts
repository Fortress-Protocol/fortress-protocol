import { Event } from '../Event';
import { World } from '../World';
import { FAI } from '../Contract/FAI';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getFAI } from '../ContractLookup';

export function faiFetchers() {
  return [
    new Fetcher<{ fai: FAI }, AddressV>(`
        #### Address

        * "<FAI> Address" - Returns the address of FAI token
          * E.g. "FAI Address"
      `,
      "Address",
      [
        new Arg("fai", getFAI, { implicit: true })
      ],
      async (world, { fai }) => new AddressV(fai._address)
    ),

    new Fetcher<{ fai: FAI }, StringV>(`
        #### Name

        * "<FAI> Name" - Returns the name of the FAI token
          * E.g. "FAI Name"
      `,
      "Name",
      [
        new Arg("fai", getFAI, { implicit: true })
      ],
      async (world, { fai }) => new StringV(await fai.methods.name().call())
    ),

    new Fetcher<{ fai: FAI }, StringV>(`
        #### Symbol

        * "<FAI> Symbol" - Returns the symbol of the FAI token
          * E.g. "FAI Symbol"
      `,
      "Symbol",
      [
        new Arg("fai", getFAI, { implicit: true })
      ],
      async (world, { fai }) => new StringV(await fai.methods.symbol().call())
    ),

    new Fetcher<{ fai: FAI }, NumberV>(`
        #### Decimals

        * "<FAI> Decimals" - Returns the number of decimals of the FAI token
          * E.g. "FAI Decimals"
      `,
      "Decimals",
      [
        new Arg("fai", getFAI, { implicit: true })
      ],
      async (world, { fai }) => new NumberV(await fai.methods.decimals().call())
    ),

    new Fetcher<{ fai: FAI }, NumberV>(`
        #### TotalSupply

        * "FAI TotalSupply" - Returns FAI token's total supply
      `,
      "TotalSupply",
      [
        new Arg("fai", getFAI, { implicit: true })
      ],
      async (world, { fai }) => new NumberV(await fai.methods.totalSupply().call())
    ),

    new Fetcher<{ fai: FAI, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "FAI TokenBalance <Address>" - Returns the FAI token balance of a given address
          * E.g. "FAI TokenBalance Geoff" - Returns Geoff's FAI balance
      `,
      "TokenBalance",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { fai, address }) => new NumberV(await fai.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ fai: FAI, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "FAI Allowance owner:<Address> spender:<Address>" - Returns the FAI allowance from owner to spender
          * E.g. "FAI Allowance Geoff Torrey" - Returns the FAI allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("fai", getFAI, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { fai, owner, spender }) => new NumberV(await fai.methods.allowance(owner.val, spender.val).call())
    )
  ];
}

export async function getFAIValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("FAI", faiFetchers(), world, event);
}
