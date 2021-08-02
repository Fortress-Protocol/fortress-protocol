import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface FAIMethods {
  name(): Callable<string>;
  symbol(): Callable<string>;
  decimals(): Callable<number>;
  totalSupply(): Callable<number>;
  balanceOf(address: string): Callable<string>;
  allowance(owner: string, spender: string): Callable<string>;
  approve(address: string, amount: encodedNumber): Sendable<number>;
  transfer(address: string, amount: encodedNumber): Sendable<boolean>;
  transferFrom(owner: string, spender: string, amount: encodedNumber): Sendable<boolean>;
}

export interface FAIScenarioMethods extends FAIMethods {
  transferScenario(destinations: string[], amount: encodedNumber): Sendable<boolean>;
  transferFromScenario(froms: string[], amount: encodedNumber): Sendable<boolean>;
}

export interface FAI extends Contract {
  methods: FAIMethods;
  name: string;
}

export interface FAIScenario extends Contract {
  methods: FAIScenarioMethods;
  name: string;
}
