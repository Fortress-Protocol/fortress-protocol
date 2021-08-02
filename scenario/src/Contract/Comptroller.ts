import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, fToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setProtocolPaused(bool): Sendable<number>
  protocolPaused(): Callable<boolean>
  _addFortressMarkets(markets: string[]): Sendable<void>
  _dropFortressMarket(market: string): Sendable<void>
  getFortressMarkets(): Callable<string[]>
  refreshFortressSpeeds(): Sendable<void>
  fortressRate(): Callable<number>
  fortressSupplyState(string): Callable<string>
  fortressBorrowState(string): Callable<string>
  fortressAccrued(string): Callable<string>
  fortressSupplierIndex(market: string, account: string): Callable<string>
  fortressBorrowerIndex(market: string, account: string): Callable<string>
  fortressSpeeds(string): Callable<string>
  claimFortress(string): Sendable<void>
  _setFortressRate(encodedNumber): Sendable<void>
  _setTreasuryData(guardian, address): Sendable<number>
  _setFortressSpeed(fToken: string, encodedNumber): Sendable<void>
  _setMarketBorrowCaps(fTokens:string[], borrowCaps:encodedNumber[]): Sendable<void>
  _setBorrowCapGuardian(string): Sendable<void>
  borrowCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
