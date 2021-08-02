pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";
import "../../contracts/PriceOracle.sol";

contract ComptrollerKovan is Comptroller {
  function getFTSAddress() public view returns (address) {
    return 0x61460874a7196d6a22D1eE4922473664b3E95270;
  }
}

contract ComptrollerRopsten is Comptroller {
  function getFTSAddress() public view returns (address) {
    return 0x1Fe16De955718CFAb7A44605458AB023838C2793;
  }
}

contract ComptrollerHarness is Comptroller {
    address ftsAddress;
    uint public blockNumber;

    constructor() Comptroller() public {}

    function setFortressSupplyState(address fToken, uint224 index, uint32 blockNumber_) public {
        fortressSupplyState[fToken].index = index;
        fortressSupplyState[fToken].block = blockNumber_;
    }

    function setFortressBorrowState(address fToken, uint224 index, uint32 blockNumber_) public {
        fortressBorrowState[fToken].index = index;
        fortressBorrowState[fToken].block = blockNumber_;
    }

    function setFortressAccrued(address user, uint userAccrued) public {
        fortressAccrued[user] = userAccrued;
    }

    function setFTSAddress(address ftsAddress_) public {
        ftsAddress = ftsAddress_;
    }

    function getFTSAddress() public view returns (address) {
        return ftsAddress;
    }

    /**
     * @notice Set the amount of FTS distributed per block
     * @param fortressRate_ The amount of FTS wei per block to distribute
     */
    function harnessSetFortressRate(uint fortressRate_) public {
        fortressRate = fortressRate_;
    }

    /**
     * @notice Recalculate and update FTS speeds for all FTS markets
     */
    function harnessRefreshFortressSpeeds() public {
        FToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: fToken.borrowIndex()});
            updateFortressSupplyIndex(address(fToken));
            updateFortressBorrowIndex(address(fToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets_[i];
            if (fortressSpeeds[address(fToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(fToken)});
                Exp memory utility = mul_(assetPrice, fToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(fortressRate, div_(utilities[i], totalUtility)) : 0;
            setFortressSpeedInternal(fToken, newSpeed);
        }
    }

    function setFortressBorrowerIndex(address fToken, address borrower, uint index) public {
        fortressBorrowerIndex[fToken][borrower] = index;
    }

    function setFortressSupplierIndex(address fToken, address supplier, uint index) public {
        fortressSupplierIndex[fToken][supplier] = index;
    }

    function harnessDistributeAllBorrowerFortress(address fToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerFortress(fToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
        fortressAccrued[borrower] = grantFTSInternal(borrower, fortressAccrued[borrower]);
    }

    function harnessDistributeAllSupplierFortress(address fToken, address supplier) public {
        distributeSupplierFortress(fToken, supplier);
        fortressAccrued[supplier] = grantFTSInternal(supplier, fortressAccrued[supplier]);
    }

    function harnessUpdateFortressBorrowIndex(address fToken, uint marketBorrowIndexMantissa) public {
        updateFortressBorrowIndex(fToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdateFortressSupplyIndex(address fToken) public {
        updateFortressSupplyIndex(fToken);
    }

    function harnessDistributeBorrowerFortress(address fToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerFortress(fToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessDistributeSupplierFortress(address fToken, address supplier) public {
        distributeSupplierFortress(fToken, supplier);
    }

    function harnessTransferFortress(address user, uint userAccrued, uint threshold) public returns (uint) {
        if (userAccrued > 0 && userAccrued >= threshold) {
            return grantFTSInternal(user, userAccrued);
        }
        return userAccrued;
    }

    function harnessAddFortressMarkets(address[] memory fTokens) public {
        for (uint i = 0; i < fTokens.length; i++) {
            // temporarily set fortressSpeed to 1 (will be fixed by `harnessRefreshFortressSpeeds`)
            setFortressSpeedInternal(FToken(fTokens[i]), 1);
        }
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getFortressMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (fortressSpeeds[address(allMarkets[i])] > 0) {
                n++;
            }
        }

        address[] memory fortressMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (fortressSpeeds[address(allMarkets[i])] > 0) {
                fortressMarkets[k++] = address(allMarkets[i]);
            }
        }
        return fortressMarkets;
    }
}

contract ComptrollerBorked {
    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        unitroller._acceptImplementation();
    }
}

contract BoolComptroller is ComptrollerG5Interface {
    bool allowMint = true;
    bool allowRedeem = true;
    bool allowBorrow = true;
    bool allowRepayBorrow = true;
    bool allowLiquidateBorrow = true;
    bool allowSeize = true;
    bool allowTransfer = true;

    bool verifyMint = true;
    bool verifyRedeem = true;
    bool verifyBorrow = true;
    bool verifyRepayBorrow = true;
    bool verifyLiquidateBorrow = true;
    bool verifySeize = true;
    bool verifyTransfer = true;

    bool failCalculateSeizeTokens;
    uint calculatedSeizeTokens;

    uint noError = 0;
    uint opaqueError = noError + 11; // an arbitrary, opaque error code

    address payable public treasuryGuardian;
    address payable public treasuryAddress;

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata _fTokens) external returns (uint[] memory) {
        _fTokens;
        uint[] memory ret;
        return ret;
    }

    function exitMarket(address _fToken) external returns (uint) {
        _fToken;
        return noError;
    }

    /*** Policy Hooks ***/

    function mintAllowed(address _fToken, address _minter, uint _mintAmount) external returns (uint) {
        _fToken;
        _minter;
        _mintAmount;
        return allowMint ? noError : opaqueError;
    }

    function mintVerify(address _fToken, address _minter, uint _mintAmount, uint _mintTokens) external {
        _fToken;
        _minter;
        _mintAmount;
        _mintTokens;
        require(verifyMint, "mintVerify rejected mint");
    }

    function redeemAllowed(address _fToken, address _redeemer, uint _redeemTokens) external returns (uint) {
        _fToken;
        _redeemer;
        _redeemTokens;
        return allowRedeem ? noError : opaqueError;
    }

    function redeemVerify(address _fToken, address _redeemer, uint _redeemAmount, uint _redeemTokens) external {
        _fToken;
        _redeemer;
        _redeemAmount;
        _redeemTokens;
        require(verifyRedeem, "redeemVerify rejected redeem");
    }

    function borrowAllowed(address _fToken, address _borrower, uint _borrowAmount) external returns (uint) {
        _fToken;
        _borrower;
        _borrowAmount;
        return allowBorrow ? noError : opaqueError;
    }

    function borrowVerify(address _fToken, address _borrower, uint _borrowAmount) external {
        _fToken;
        _borrower;
        _borrowAmount;
        require(verifyBorrow, "borrowVerify rejected borrow");
    }

    function repayBorrowAllowed(
        address _fToken,
        address _payer,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _fToken;
        _payer;
        _borrower;
        _repayAmount;
        return allowRepayBorrow ? noError : opaqueError;
    }

    function repayBorrowVerify(
        address _fToken,
        address _payer,
        address _borrower,
        uint _repayAmount,
        uint _borrowerIndex) external {
        _fToken;
        _payer;
        _borrower;
        _repayAmount;
        _borrowerIndex;
        require(verifyRepayBorrow, "repayBorrowVerify rejected repayBorrow");
    }

    function liquidateBorrowAllowed(
        address _fTokenBorrowed,
        address _fTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _fTokenBorrowed;
        _fTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        return allowLiquidateBorrow ? noError : opaqueError;
    }

    function liquidateBorrowVerify(
        address _fTokenBorrowed,
        address _fTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount,
        uint _seizeTokens) external {
        _fTokenBorrowed;
        _fTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        _seizeTokens;
        require(verifyLiquidateBorrow, "liquidateBorrowVerify rejected liquidateBorrow");
    }

    function seizeAllowed(
        address _fTokenCollateral,
        address _fTokenBorrowed,
        address _borrower,
        address _liquidator,
        uint _seizeTokens) external returns (uint) {
        _fTokenCollateral;
        _fTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        return allowSeize ? noError : opaqueError;
    }

    function seizeVerify(
        address _fTokenCollateral,
        address _fTokenBorrowed,
        address _liquidator,
        address _borrower,
        uint _seizeTokens) external {
        _fTokenCollateral;
        _fTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        require(verifySeize, "seizeVerify rejected seize");
    }

    function transferAllowed(
        address _fToken,
        address _src,
        address _dst,
        uint _transferTokens) external returns (uint) {
        _fToken;
        _src;
        _dst;
        _transferTokens;
        return allowTransfer ? noError : opaqueError;
    }

    function transferVerify(
        address _fToken,
        address _src,
        address _dst,
        uint _transferTokens) external {
        _fToken;
        _src;
        _dst;
        _transferTokens;
        require(verifyTransfer, "transferVerify rejected transfer");
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _fTokenBorrowed,
        address _fTokenCollateral,
        uint _repayAmount) external view returns (uint, uint) {
        _fTokenBorrowed;
        _fTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setMintVerify(bool verifyMint_) public {
        verifyMint = verifyMint_;
    }

    function setRedeemAllowed(bool allowRedeem_) public {
        allowRedeem = allowRedeem_;
    }

    function setRedeemVerify(bool verifyRedeem_) public {
        verifyRedeem = verifyRedeem_;
    }

    function setBorrowAllowed(bool allowBorrow_) public {
        allowBorrow = allowBorrow_;
    }

    function setBorrowVerify(bool verifyBorrow_) public {
        verifyBorrow = verifyBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setRepayBorrowVerify(bool verifyRepayBorrow_) public {
        verifyRepayBorrow = verifyRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setLiquidateBorrowVerify(bool verifyLiquidateBorrow_) public {
        verifyLiquidateBorrow = verifyLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setSeizeVerify(bool verifySeize_) public {
        verifySeize = verifySeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    function setTransferVerify(bool verifyTransfer_) public {
        verifyTransfer = verifyTransfer_;
    }

    /*** Liquidity/Liquidation Calculations ***/

    function setCalculatedSeizeTokens(uint seizeTokens_) public {
        calculatedSeizeTokens = seizeTokens_;
    }

    function setFailCalculateSeizeTokens(bool shouldFail) public {
        failCalculateSeizeTokens = shouldFail;
    }

    function _setTreasuryData(address payable treasuryGuardian_, address payable treasuryAddress_) external {
        treasuryGuardian = treasuryGuardian_;
        treasuryAddress = treasuryAddress_;
    }
}

contract EchoTypesComptroller is UnitrollerAdminStorage {
    function stringy(string memory s) public pure returns(string memory) {
        return s;
    }

    function addresses(address a) public pure returns(address) {
        return a;
    }

    function booly(bool b) public pure returns(bool) {
        return b;
    }

    function listOInts(uint[] memory u) public pure returns(uint[] memory) {
        return u;
    }

    function reverty() public pure {
        require(false, "gotcha sucka");
    }

    function becomeBrains(address payable unitroller) public {
        Unitroller(unitroller)._acceptImplementation();
    }
}
