import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { FTokenMethods, FTokenScenarioMethods } from './FToken';

interface FBep20DelegateMethods extends FTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface FBep20DelegateScenarioMethods extends FTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface FBep20Delegate extends Contract {
  methods: FBep20DelegateMethods;
  name: string;
}

export interface FBep20DelegateScenario extends Contract {
  methods: FBep20DelegateScenarioMethods;
  name: string;
}
