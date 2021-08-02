import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface FortressLensMethods {
  fTokenBalances(fToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  fTokenBalancesAll(fTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  fTokenMetadata(fToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  fTokenMetadataAll(fTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  fTokenUnderlyingPrice(fToken: string): Sendable<[string,number]>;
  fTokenUnderlyingPriceAll(fTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface FortressLens extends Contract {
  methods: FortressLensMethods;
  name: string;
}
