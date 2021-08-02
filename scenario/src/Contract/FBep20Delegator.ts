import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { FTokenMethods } from './FToken';
import { encodedNumber } from '../Encoding';

interface FBep20DelegatorMethods extends FTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface FBep20DelegatorScenarioMethods extends FBep20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface FBep20Delegator extends Contract {
  methods: FBep20DelegatorMethods;
  name: string;
}

export interface FBep20DelegatorScenario extends Contract {
  methods: FBep20DelegatorMethods;
  name: string;
}
