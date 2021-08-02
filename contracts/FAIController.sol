pragma solidity ^0.5.16;

import "./FToken.sol";
import "./PriceOracle.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./FAIControllerStorage.sol";
import "./FAIUnitroller.sol";
import "./FAI/FAI.sol";

interface ComptrollerLensInterface {
    function protocolPaused() external view returns (bool);
    function mintedFAIs(address account) external view returns (uint);
    function faiMintRate() external view returns (uint);
    function fortressFAIRate() external view returns (uint);
    function fortressAccrued(address account) external view returns(uint);
    function getAssetsIn(address account) external view returns (FToken[] memory);
    function oracle() external view returns (PriceOracle);

    function distributeFAIMinterFortress(address faiMinter, bool distributeAll) external;
}

/**
 * @title Fortress's FAI Comptroller Contract
 * @author Fortress
 */
contract FAIController is FAIControllerStorage, FAIControllerErrorReporter, Exponential {

    /// @notice Emitted when Comptroller is changed
    event NewComptroller(ComptrollerInterface oldComptroller, ComptrollerInterface newComptroller);

    /**
     * @notice Event emitted when FAI is minted
     */
    event MintFAI(address minter, uint mintFAIAmount);

    /**
     * @notice Event emitted when FAI is repaid
     */
    event RepayFAI(address repayer, uint repayFAIAmount);

    /// @notice The initial Fortress index for a market
    uint224 public constant fortressInitialIndex = 1e36;

    /*** Main Actions ***/

    function mintFAI(uint mintFAIAmount) external returns (uint) {
        if(address(comptroller) != address(0)) {
            require(!ComptrollerLensInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address minter = msg.sender;

            // Keep the flywheel moving
            updateFortressFAIMintIndex();
            ComptrollerLensInterface(address(comptroller)).distributeFAIMinterFortress(minter, false);

            uint oErr;
            MathError mErr;
            uint accountMintFAINew;
            uint accountMintableFAI;

            (oErr, accountMintableFAI) = getMintableFAI(minter);
            if (oErr != uint(Error.NO_ERROR)) {
                return uint(Error.REJECTION);
            }

            // check that user have sufficient mintableFAI balance
            if (mintFAIAmount > accountMintableFAI) {
                return fail(Error.REJECTION, FailureInfo.FAI_MINT_REJECTION);
            }

            (mErr, accountMintFAINew) = addUInt(ComptrollerLensInterface(address(comptroller)).mintedFAIs(minter), mintFAIAmount);
            require(mErr == MathError.NO_ERROR, "FAI_MINT_AMOUNT_CALCULATION_FAILED");
            uint error = comptroller.setMintedFAIOf(minter, accountMintFAINew);
            if (error != 0 ) {
                return error;
            }

            FAI(getFAIAddress()).mint(minter, mintFAIAmount);
            emit MintFAI(minter, mintFAIAmount);

            return uint(Error.NO_ERROR);
        }
    }

    /**
     * @notice Repay FAI
     */
    function repayFAI(uint repayFAIAmount) external returns (uint) {
        if(address(comptroller) != address(0)) {
            require(!ComptrollerLensInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address repayer = msg.sender;

            updateFortressFAIMintIndex();
            ComptrollerLensInterface(address(comptroller)).distributeFAIMinterFortress(repayer, false);

            uint actualBurnAmount;

            uint faiBalance = ComptrollerLensInterface(address(comptroller)).mintedFAIs(repayer);

            if(faiBalance > repayFAIAmount) {
                actualBurnAmount = repayFAIAmount;
            } else {
                actualBurnAmount = faiBalance;
            }

            uint error = comptroller.setMintedFAIOf(repayer, faiBalance - actualBurnAmount);
            if (error != 0) {
                return error;
            }

            FAI(getFAIAddress()).burn(repayer, actualBurnAmount);
            emit RepayFAI(repayer, actualBurnAmount);

            return uint(Error.NO_ERROR);
        }
    }

    /**
     * @notice Initialize the FortressFAIState
     */
    function _initializeFortressFAIState(uint blockNumber) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        if (isFortressFAIInitialized == false) {
            isFortressFAIInitialized = true;
            uint faiBlockNumber = blockNumber == 0 ? getBlockNumber() : blockNumber;
            fortressFAIState = FortressFAIState({
                index: fortressInitialIndex,
                block: safe32(faiBlockNumber, "block number overflows")
            });
        }
    }

    /**
     * @notice Accrue FTS to by updating the FAI minter index
     */
    function updateFortressFAIMintIndex() public returns (uint) {
        uint faiMinterSpeed = ComptrollerLensInterface(address(comptroller)).fortressFAIRate();
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(fortressFAIState.block));
        if (deltaBlocks > 0 && faiMinterSpeed > 0) {
            uint faiAmount = FAI(getFAIAddress()).totalSupply();
            uint fortressAccrued = mul_(deltaBlocks, faiMinterSpeed);
            Double memory ratio = faiAmount > 0 ? fraction(fortressAccrued, faiAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: fortressFAIState.index}), ratio);
            fortressFAIState = FortressFAIState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            fortressFAIState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Calculate FTS accrued by a FAI minter
     * @param faiMinter The address of the FAI minter to distribute FTS to
     */
    function calcDistributeFAIMinterFortress(address faiMinter) public returns(uint, uint, uint, uint) {
        // Check caller is comptroller
        if (msg.sender != address(comptroller)) {
            return (fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK), 0, 0, 0);
        }

        Double memory faiMintIndex = Double({mantissa: fortressFAIState.index});
        Double memory faiMinterIndex = Double({mantissa: fortressFAIMinterIndex[faiMinter]});
        fortressFAIMinterIndex[faiMinter] = faiMintIndex.mantissa;

        if (faiMinterIndex.mantissa == 0 && faiMintIndex.mantissa > 0) {
            faiMinterIndex.mantissa = fortressInitialIndex;
        }

        Double memory deltaIndex = sub_(faiMintIndex, faiMinterIndex);
        uint faiMinterAmount = ComptrollerLensInterface(address(comptroller)).mintedFAIs(faiMinter);
        uint faiMinterDelta = mul_(faiMinterAmount, deltaIndex);
        uint faiMinterAccrued = add_(ComptrollerLensInterface(address(comptroller)).fortressAccrued(faiMinter), faiMinterDelta);
        return (uint(Error.NO_ERROR), faiMinterAccrued, faiMinterDelta, faiMintIndex.mantissa);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new comptroller
      * @dev Admin function to set a new comptroller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setComptroller(ComptrollerInterface comptroller_) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        ComptrollerInterface oldComptroller = comptroller;
        comptroller = comptroller_;
        emit NewComptroller(oldComptroller, comptroller_);

        return uint(Error.NO_ERROR);
    }

    function _become(FAIUnitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        require(unitroller._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account total supply balance.
     *  Note that `fTokenBalance` is the number of fTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountAmountLocalVars {
        uint totalSupplyAmount;
        uint sumSupply;
        uint sumBorrowPlusEffects;
        uint fTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    function getMintableFAI(address minter) public view returns (uint, uint) {
        PriceOracle oracle = ComptrollerLensInterface(address(comptroller)).oracle();
        FToken[] memory enteredMarkets = ComptrollerLensInterface(address(comptroller)).getAssetsIn(minter);

        AccountAmountLocalVars memory vars; // Holds all our calculation results

        uint oErr;
        MathError mErr;

        uint accountMintableFAI;
        uint i;

        /**
         * We use this formula to calculate mintable FAI amount.
         * totalSupplyAmount * FAIMintRate - (totalBorrowAmount + mintedFAIOf)
         */
        for (i = 0; i < enteredMarkets.length; i++) {
            (oErr, vars.fTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = enteredMarkets[i].getAccountSnapshot(minter);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (uint(Error.SNAPSHOT_ERROR), 0);
            }
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(enteredMarkets[i]);
            if (vars.oraclePriceMantissa == 0) {
                return (uint(Error.PRICE_ERROR), 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            (mErr, vars.tokensToDenom) = mulExp(vars.exchangeRate, vars.oraclePrice);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumSupply += tokensToDenom * fTokenBalance
            (mErr, vars.sumSupply) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.fTokenBalance, vars.sumSupply);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }
        }

        (mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, ComptrollerLensInterface(address(comptroller)).mintedFAIs(minter));
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mErr, accountMintableFAI) = mulUInt(vars.sumSupply, ComptrollerLensInterface(address(comptroller)).faiMintRate());
        require(mErr == MathError.NO_ERROR, "FAI_MINT_AMOUNT_CALCULATION_FAILED");

        (mErr, accountMintableFAI) = divUInt(accountMintableFAI, 10000);
        require(mErr == MathError.NO_ERROR, "FAI_MINT_AMOUNT_CALCULATION_FAILED");


        (mErr, accountMintableFAI) = subUInt(accountMintableFAI, vars.sumBorrowPlusEffects);
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.REJECTION), 0);
        }

        return (uint(Error.NO_ERROR), accountMintableFAI);
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the FAI token
     * @return The address of FAI
     */
    function getFAIAddress() public view returns (address) {
        return 0x10a450A21B79c3Af78fb4484FF46D3E647475db4;
    }
}
