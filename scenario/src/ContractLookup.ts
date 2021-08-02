import { Map } from 'immutable';

import { Event } from './Event';
import { World } from './World';
import { accountMap } from './Accounts';
import { Contract } from './Contract';
import { mustString } from './Utils';

import { FBep20Delegate } from './Contract/FBep20Delegate';
import { FTS } from './Contract/Fortress';
import { FAI } from './Contract/FAI';
import { Comptroller } from './Contract/Comptroller';
import { ComptrollerImpl } from './Contract/ComptrollerImpl';
import { FToken } from './Contract/FToken';
import { Governor } from './Contract/Governor';
import { Bep20 } from './Contract/Bep20';
import { InterestRateModel } from './Contract/InterestRateModel';
import { PriceOracle } from './Contract/PriceOracle';
import { Timelock } from './Contract/Timelock';

type ContractDataEl = string | Map<string, object> | undefined;

function getContractData(world: World, indices: string[][]): ContractDataEl {
  return indices.reduce((value: ContractDataEl, index) => {
    if (value) {
      return value;
    } else {
      return index.reduce((data: ContractDataEl, el) => {
        let lowerEl = el.toLowerCase();

        if (!data) {
          return;
        } else if (typeof data === 'string') {
          return data;
        } else {
          return (data as Map<string, ContractDataEl>).find((_v, key) => key.toLowerCase().trim() === lowerEl.trim());
        }
      }, world.contractData);
    }
  }, undefined);
}

function getContractDataString(world: World, indices: string[][]): string {
  const value: ContractDataEl = getContractData(world, indices);

  if (!value || typeof value !== 'string') {
    throw new Error(
      `Failed to find string value by index (got ${value}): ${JSON.stringify(
        indices
      )}, index contains: ${JSON.stringify(world.contractData.toJSON())}`
    );
  }

  return value;
}

export function getWorldContract<T>(world: World, indices: string[][]): T {
  const address = getContractDataString(world, indices);

  return getWorldContractByAddress<T>(world, address);
}

export function getWorldContractByAddress<T>(world: World, address: string): T {
  const contract = world.contractIndex[address.toLowerCase()];

  if (!contract) {
    throw new Error(
      `Failed to find world contract by address: ${address}, index contains: ${JSON.stringify(
        Object.keys(world.contractIndex)
      )}`
    );
  }

  return <T>(<unknown>contract);
}

export async function getTimelock(world: World): Promise<Timelock> {
  return getWorldContract(world, [['Contracts', 'Timelock']]);
}

export async function getUnitroller(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Unitroller']]);
}

export async function getMaximillion(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Maximillion']]);
}

export async function getComptroller(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Comptroller']]);
}

export async function getComptrollerImpl(world: World, comptrollerImplArg: Event): Promise<ComptrollerImpl> {
  return getWorldContract(world, [['Comptroller', mustString(comptrollerImplArg), 'address']]);
}

export function getFTokenAddress(world: World, fTokenArg: string): string {
  return getContractDataString(world, [['fTokens', fTokenArg, 'address']]);
}

export function getFTokenDelegateAddress(world: World, fTokenDelegateArg: string): string {
  return getContractDataString(world, [['FTokenDelegate', fTokenDelegateArg, 'address']]);
}

export function getBep20Address(world: World, bep20Arg: string): string {
  return getContractDataString(world, [['Tokens', bep20Arg, 'address']]);
}

export function getGovernorAddress(world: World, governorArg: string): string {
  return getContractDataString(world, [['Contracts', governorArg]]);
}

export async function getPriceOracleProxy(world: World): Promise<PriceOracle> {
  return getWorldContract(world, [['Contracts', 'PriceOracleProxy']]);
}

export async function getPriceOracle(world: World): Promise<PriceOracle> {
  return getWorldContract(world, [['Contracts', 'PriceOracle']]);
}

export async function getFTS(
  world: World,
  ftsArg: Event
): Promise<FTS> {
  return getWorldContract(world, [['FTS', 'address']]);
}

export async function getFTSData(
  world: World,
  ftsArg: string
): Promise<[FTS, string, Map<string, string>]> {
  let contract = await getFTS(world, <Event>(<any>ftsArg));
  let data = getContractData(world, [['FTS', ftsArg]]);

  return [contract, ftsArg, <Map<string, string>>(<any>data)];
}

export async function getFAI(
  world: World,
  ftsArg: Event
): Promise<FAI> {
  return getWorldContract(world, [['FAI', 'address']]);
}

export async function getFAIData(
  world: World,
  ftsArg: string
): Promise<[FAI, string, Map<string, string>]> {
  let contract = await getFAI(world, <Event>(<any>ftsArg));
  let data = getContractData(world, [['FAI', ftsArg]]);

  return [contract, ftsArg, <Map<string, string>>(<any>data)];
}

export async function getGovernorData(
  world: World,
  governorArg: string
): Promise<[Governor, string, Map<string, string>]> {
  let contract = getWorldContract<Governor>(world, [['Governor', governorArg, 'address']]);
  let data = getContractData(world, [['Governor', governorArg]]);

  return [contract, governorArg, <Map<string, string>>(<any>data)];
}

export async function getInterestRateModel(
  world: World,
  interestRateModelArg: Event
): Promise<InterestRateModel> {
  return getWorldContract(world, [['InterestRateModel', mustString(interestRateModelArg), 'address']]);
}

export async function getInterestRateModelData(
  world: World,
  interestRateModelArg: string
): Promise<[InterestRateModel, string, Map<string, string>]> {
  let contract = await getInterestRateModel(world, <Event>(<any>interestRateModelArg));
  let data = getContractData(world, [['InterestRateModel', interestRateModelArg]]);

  return [contract, interestRateModelArg, <Map<string, string>>(<any>data)];
}

export async function getBep20Data(
  world: World,
  bep20Arg: string
): Promise<[Bep20, string, Map<string, string>]> {
  let contract = getWorldContract<Bep20>(world, [['Tokens', bep20Arg, 'address']]);
  let data = getContractData(world, [['Tokens', bep20Arg]]);

  return [contract, bep20Arg, <Map<string, string>>(<any>data)];
}

export async function getFTokenData(
  world: World,
  fTokenArg: string
): Promise<[FToken, string, Map<string, string>]> {
  let contract = getWorldContract<FToken>(world, [['fTokens', fTokenArg, 'address']]);
  let data = getContractData(world, [['FTokens', fTokenArg]]);

  return [contract, fTokenArg, <Map<string, string>>(<any>data)];
}

export async function getFTokenDelegateData(
  world: World,
  fTokenDelegateArg: string
): Promise<[FBep20Delegate, string, Map<string, string>]> {
  let contract = getWorldContract<FBep20Delegate>(world, [['FTokenDelegate', fTokenDelegateArg, 'address']]);
  let data = getContractData(world, [['FTokenDelegate', fTokenDelegateArg]]);

  return [contract, fTokenDelegateArg, <Map<string, string>>(<any>data)];
}

export async function getComptrollerImplData(
  world: World,
  comptrollerImplArg: string
): Promise<[ComptrollerImpl, string, Map<string, string>]> {
  let contract = await getComptrollerImpl(world, <Event>(<any>comptrollerImplArg));
  let data = getContractData(world, [['Comptroller', comptrollerImplArg]]);

  return [contract, comptrollerImplArg, <Map<string, string>>(<any>data)];
}

export function getAddress(world: World, addressArg: string): string {
  if (addressArg.toLowerCase() === 'zero') {
    return '0x0000000000000000000000000000000000000000';
  }

  if (addressArg.startsWith('0x')) {
    return addressArg;
  }

  let alias = Object.entries(world.settings.aliases).find(
    ([alias, addr]) => alias.toLowerCase() === addressArg.toLowerCase()
  );
  if (alias) {
    return alias[1];
  }

  let account = world.accounts.find(account => account.name.toLowerCase() === addressArg.toLowerCase());
  if (account) {
    return account.address;
  }

  return getContractDataString(world, [
    ['Contracts', addressArg],
    ['fTokens', addressArg, 'address'],
    ['FTokenDelegate', addressArg, 'address'],
    ['Tokens', addressArg, 'address'],
    ['Comptroller', addressArg, 'address']
  ]);
}

export function getContractByName(world: World, name: string): Contract {
  return getWorldContract(world, [['Contracts', name]]);
}
