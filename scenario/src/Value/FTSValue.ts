import { Event } from '../Event';
import { World } from '../World';
import { FTS } from '../Contract/Fortress';
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
import { getFTS } from '../ContractLookup';

export function ftsFetchers() {
  return [
    new Fetcher<{ fts: FTS }, AddressV>(`
        #### Address

        * "<FTS> Address" - Returns the address of FTS token
          * E.g. "FTS Address"
      `,
      "Address",
      [
        new Arg("fts", getFTS, { implicit: true })
      ],
      async (world, { fts }) => new AddressV(fts._address)
    ),

    new Fetcher<{ fts: FTS }, StringV>(`
        #### Name

        * "<FTS> Name" - Returns the name of the FTS token
          * E.g. "FTS Name"
      `,
      "Name",
      [
        new Arg("fts", getFTS, { implicit: true })
      ],
      async (world, { fts }) => new StringV(await fts.methods.name().call())
    ),

    new Fetcher<{ fts: FTS }, StringV>(`
        #### Symbol

        * "<FTS> Symbol" - Returns the symbol of the FTS token
          * E.g. "FTS Symbol"
      `,
      "Symbol",
      [
        new Arg("fts", getFTS, { implicit: true })
      ],
      async (world, { fts }) => new StringV(await fts.methods.symbol().call())
    ),

    new Fetcher<{ fts: FTS }, NumberV>(`
        #### Decimals

        * "<FTS> Decimals" - Returns the number of decimals of the FTS token
          * E.g. "FTS Decimals"
      `,
      "Decimals",
      [
        new Arg("fts", getFTS, { implicit: true })
      ],
      async (world, { fts }) => new NumberV(await fts.methods.decimals().call())
    ),

    new Fetcher<{ fts: FTS }, NumberV>(`
        #### TotalSupply

        * "FTS TotalSupply" - Returns FTS token's total supply
      `,
      "TotalSupply",
      [
        new Arg("fts", getFTS, { implicit: true })
      ],
      async (world, { fts }) => new NumberV(await fts.methods.totalSupply().call())
    ),

    new Fetcher<{ fts: FTS, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "FTS TokenBalance <Address>" - Returns the FTS token balance of a given address
          * E.g. "FTS TokenBalance Geoff" - Returns Geoff's FTS balance
      `,
      "TokenBalance",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { fts, address }) => new NumberV(await fts.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ fts: FTS, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "FTS Allowance owner:<Address> spender:<Address>" - Returns the FTS allowance from owner to spender
          * E.g. "FTS Allowance Geoff Torrey" - Returns the FTS allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { fts, owner, spender }) => new NumberV(await fts.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ fts: FTS, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "FTS GetCurrentVotes account:<Address>" - Returns the current FTS votes balance for an account
          * E.g. "FTS GetCurrentVotes Geoff" - Returns the current FTS vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { fts, account }) => new NumberV(await fts.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ fts: FTS, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "FTS GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current FTS votes balance at given block
          * E.g. "FTS GetPriorVotes Geoff 5" - Returns the FTS vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { fts, account, blockNumber }) => new NumberV(await fts.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ fts: FTS, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "FTS GetCurrentVotesBlock account:<Address>" - Returns the current FTS votes checkpoint block for an account
          * E.g. "FTS GetCurrentVotesBlock Geoff" - Returns the current FTS votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { fts, account }) => {
        const numCheckpoints = Number(await fts.methods.numCheckpoints(account.val).call());
        const checkpoint = await fts.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ fts: FTS, account: AddressV }, NumberV>(`
        #### VotesLength

        * "FTS VotesLength account:<Address>" - Returns the FTS vote checkpoint array length
          * E.g. "FTS VotesLength Geoff" - Returns the FTS vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { fts, account }) => new NumberV(await fts.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ fts: FTS, account: AddressV }, ListV>(`
        #### AllVotes

        * "FTS AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "FTS AllVotes Geoff" - Returns the FTS vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("fts", getFTS, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { fts, account }) => {
        const numCheckpoints = Number(await fts.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await fts.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getFTSValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("FTS", ftsFetchers(), world, event);
}
