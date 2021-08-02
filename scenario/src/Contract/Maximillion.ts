import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';

interface MaximillionMethods {
  fBnb(): Callable<string>
  repayBehalf(string): Sendable<void>
}

export interface Maximillion extends Contract {
  methods: MaximillionMethods
}
