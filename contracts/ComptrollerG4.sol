pragma solidity ^0.5.16;

import "./FToken.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./PriceOracle.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerStorage.sol";
import "./Unitroller.sol";
import "./Governance/FTS.sol";
import "./FAI/FAI.sol";

/**
 * @title Fortress's Comptroller Contract
 * @author Fortress
 */
contract ComptrollerG4 is ComptrollerV4Storage, ComptrollerInterface, ComptrollerErrorReporter, Exponential {
    /// @notice Emitted when an admin supports a market
    event MarketListed(FToken fToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(FToken fToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(FToken fToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(FToken fToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when maxAssets is changed by admin
    event NewMaxAssets(uint oldMaxAssets, uint newMaxAssets);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when FAI Vault info is changed
    event NewFAIVaultInfo(address vault_, uint releaseStartBlock_, uint releaseInterval_);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when an action is paused globally
    event ActionPaused(string action, bool pauseState);

    /// @notice Emitted when an action is paused on a market
    event ActionPaused(FToken fToken, string action, bool pauseState);

    /// @notice Emitted when Fortress FAI rate is changed
    event NewFortressFAIRate(uint oldFortressFAIRate, uint newFortressFAIRate);

    /// @notice Emitted when Fortress FAI Vault rate is changed
    event NewFortressFAIVaultRate(uint oldFortressFAIVaultRate, uint newFortressFAIVaultRate);

    /// @notice Emitted when a new Fortress speed is calculated for a market
    event FortressSpeedUpdated(FToken indexed fToken, uint newSpeed);

    /// @notice Emitted when FTS is distributed to a supplier
    event DistributedSupplierFortress(FToken indexed fToken, address indexed supplier, uint fortressDelta, uint fortressSupplyIndex);

    /// @notice Emitted when FTS is distributed to a borrower
    event DistributedBorrowerFortress(FToken indexed fToken, address indexed borrower, uint fortressDelta, uint fortressBorrowIndex);

    /// @notice Emitted when FTS is distributed to a FAI minter
    event DistributedFAIMinterFortress(address indexed faiMinter, uint fortressDelta, uint fortressFAIMintIndex);

    /// @notice Emitted when FTS is distributed to FAI Vault
    event DistributedFAIVaultFortress(uint amount);

    /// @notice Emitted when FAIController is changed
    event NewFAIController(FAIControllerInterface oldFAIController, FAIControllerInterface newFAIController);

    /// @notice Emitted when FAI mint rate is changed by admin
    event NewFAIMintRate(uint oldFAIMintRate, uint newFAIMintRate);

    /// @notice Emitted when protocol state is changed by admin
    event ActionProtocolPaused(bool state);

    /// @notice Emitted when borrow cap for a fToken is changed
    event NewBorrowCap(FToken indexed fToken, uint newBorrowCap);

    /// @notice Emitted when borrow cap guardian is changed
    event NewBorrowCapGuardian(address oldBorrowCapGuardian, address newBorrowCapGuardian);

    /// @notice The initial Fortress index for a market
    uint224 public constant fortressInitialIndex = 1e36;

    // closeFactorMantissa must be strictly greater than this value
    uint internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    // liquidationIncentiveMantissa must be no less than this value
    uint internal constant liquidationIncentiveMinMantissa = 1.0e18; // 1.0

    // liquidationIncentiveMantissa must be no greater than this value
    uint internal constant liquidationIncentiveMaxMantissa = 1.5e18; // 1.5

    constructor() public {
        admin = msg.sender;
    }

    modifier onlyProtocolAllowed {
        require(!protocolPaused, "protocol is paused");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    modifier onlyListedMarket(FToken fToken) {
        require(markets[address(fToken)].isListed, "market is not listed");
        _;
    }

    modifier validPauseState(bool state) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can");
        require(msg.sender == admin || state == true, "only admin can unpause");
        _;
    }

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (FToken[] memory) {
        return accountAssets[account];
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param fToken The fToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, FToken fToken) external view returns (bool) {
        return markets[address(fToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param fTokens The list of addresses of the fToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] calldata fTokens) external returns (uint[] memory) {
        uint len = fTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            results[i] = uint(addToMarketInternal(FToken(fTokens[i]), msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param fToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(FToken fToken, address borrower) internal returns (Error) {
        Market storage marketToJoin = markets[address(fToken)];

        if (!marketToJoin.isListed) {
            // market is not listed, cannot join
            return Error.MARKET_NOT_LISTED;
        }

        if (marketToJoin.accountMembership[borrower]) {
            // already joined
            return Error.NO_ERROR;
        }

        if (accountAssets[borrower].length >= maxAssets)  {
            // no space, cannot join
            return Error.TOO_MANY_ASSETS;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(fToken);

        emit MarketEntered(fToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param fTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address fTokenAddress) external returns (uint) {
        FToken fToken = FToken(fTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the fToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = fToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(fTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(fToken)];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set fToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete fToken from the account’s list of assets */
        // In order to delete fToken, copy last item in list to location of item to be removed, reduce length by 1
        FToken[] storage userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint i;
        for (; i < len; i++) {
            if (userAssetList[i] == fToken) {
                userAssetList[i] = userAssetList[len - 1];
                userAssetList.length--;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(i < len);

        emit MarketExited(fToken, msg.sender);

        return uint(Error.NO_ERROR);
    }

    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param fToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address fToken, address minter, uint mintAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintGuardianPaused[fToken], "mint is paused");

        // Shh - currently unused
        mintAmount;

        if (!markets[fToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        updateFortressSupplyIndex(fToken);
        distributeSupplierFortress(fToken, minter);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates mint and reverts on rejection. May emit logs.
     * @param fToken Asset being minted
     * @param minter The address minting the tokens
     * @param actualMintAmount The amount of the underlying asset being minted
     * @param mintTokens The number of tokens being minted
     */
    function mintVerify(address fToken, address minter, uint actualMintAmount, uint mintTokens) external {
        // Shh - currently unused
        fToken;
        minter;
        actualMintAmount;
        mintTokens;
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param fToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of fTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address fToken, address redeemer, uint redeemTokens) external onlyProtocolAllowed returns (uint) {
        uint allowed = redeemAllowedInternal(fToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateFortressSupplyIndex(fToken);
        distributeSupplierFortress(fToken, redeemer);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address fToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        if (!markets[fToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[fToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, FToken(fToken), redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param fToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address fToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        // Shh - currently unused
        fToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        require(redeemTokens != 0 || redeemAmount == 0, "redeemTokens zero");
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param fToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address fToken, address borrower, uint borrowAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!borrowGuardianPaused[fToken], "borrow is paused");

        if (!markets[fToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (!markets[fToken].accountMembership[borrower]) {
            // only fTokens may call borrowAllowed if borrower not in market
            require(msg.sender == fToken, "sender must be fToken");

            // attempt to add borrower to the market
            Error err = addToMarketInternal(FToken(fToken), borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }
        }

        if (oracle.getUnderlyingPrice(FToken(fToken)) == 0) {
            return uint(Error.PRICE_ERROR);
        }

        uint borrowCap = borrowCaps[fToken];
        // Borrow cap of 0 corresponds to unlimited borrowing
        if (borrowCap != 0) {
            uint totalBorrows = FToken(fToken).totalBorrows();
            (MathError mathErr, uint nextTotalBorrows) = addUInt(totalBorrows, borrowAmount);
            require(mathErr == MathError.NO_ERROR, "total borrows overflow");
            require(nextTotalBorrows < borrowCap, "market borrow cap reached");
        }

        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, FToken(fToken), 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: FToken(fToken).borrowIndex()});
        updateFortressBorrowIndex(fToken, borrowIndex);
        distributeBorrowerFortress(fToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates borrow and reverts on rejection. May emit logs.
     * @param fToken Asset whose underlying is being borrowed
     * @param borrower The address borrowing the underlying
     * @param borrowAmount The amount of the underlying asset requested to borrow
     */
    function borrowVerify(address fToken, address borrower, uint borrowAmount) external {
        // Shh - currently unused
        fToken;
        borrower;
        borrowAmount;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param fToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which would repay the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address fToken,
        address payer,
        address borrower,
        uint repayAmount) external onlyProtocolAllowed returns (uint) {
        // Shh - currently unused
        payer;
        borrower;
        repayAmount;

        if (!markets[fToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: FToken(fToken).borrowIndex()});
        updateFortressBorrowIndex(fToken, borrowIndex);
        distributeBorrowerFortress(fToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates repayBorrow and reverts on rejection. May emit logs.
     * @param fToken Asset being repaid
     * @param payer The address repaying the borrow
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function repayBorrowVerify(
        address fToken,
        address payer,
        address borrower,
        uint actualRepayAmount,
        uint borrowerIndex) external {
        // Shh - currently unused
        fToken;
        payer;
        borrower;
        actualRepayAmount;
        borrowerIndex;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param fTokenBorrowed Asset which was borrowed by the borrower
     * @param fTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external onlyProtocolAllowed returns (uint) {
        // Shh - currently unused
        liquidator;

        if (!markets[fTokenBorrowed].isListed || !markets[fTokenCollateral].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* The borrower must have shortfall in order to be liquidatable */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, FToken(0), 0, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall == 0) {
            return uint(Error.INSUFFICIENT_SHORTFALL);
        }

        /* The liquidator may not repay more than what is allowed by the closeFactor */
        uint borrowBalance = FToken(fTokenBorrowed).borrowBalanceStored(borrower);
        (MathError mathErr, uint maxClose) = mulScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
        if (mathErr != MathError.NO_ERROR) {
            return uint(Error.MATH_ERROR);
        }
        if (repayAmount > maxClose) {
            return uint(Error.TOO_MUCH_REPAY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates liquidateBorrow and reverts on rejection. May emit logs.
     * @param fTokenBorrowed Asset which was borrowed by the borrower
     * @param fTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function liquidateBorrowVerify(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint actualRepayAmount,
        uint seizeTokens) external {
        // Shh - currently unused
        fTokenBorrowed;
        fTokenCollateral;
        liquidator;
        borrower;
        actualRepayAmount;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param fTokenCollateral Asset which was used as collateral and will be seized
     * @param fTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!seizeGuardianPaused, "seize is paused");

        // Shh - currently unused
        seizeTokens;

        if (!markets[fTokenCollateral].isListed || !markets[fTokenBorrowed].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (FToken(fTokenCollateral).comptroller() != FToken(fTokenBorrowed).comptroller()) {
            return uint(Error.COMPTROLLER_MISMATCH);
        }

        // Keep the flywheel moving
        updateFortressSupplyIndex(fTokenCollateral);
        distributeSupplierFortress(fTokenCollateral, borrower);
        distributeSupplierFortress(fTokenCollateral, liquidator);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates seize and reverts on rejection. May emit logs.
     * @param fTokenCollateral Asset which was used as collateral and will be seized
     * @param fTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeVerify(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external {
        // Shh - currently unused
        fTokenCollateral;
        fTokenBorrowed;
        liquidator;
        borrower;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param fToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of fTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(address fToken, address src, address dst, uint transferTokens) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!transferGuardianPaused, "transfer is paused");

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(fToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateFortressSupplyIndex(fToken);
        distributeSupplierFortress(fToken, src);
        distributeSupplierFortress(fToken, dst);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates transfer and reverts on rejection. May emit logs.
     * @param fToken Asset being transferred
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of fTokens to transfer
     */
    function transferVerify(address fToken, address src, address dst, uint transferTokens) external {
        // Shh - currently unused
        fToken;
        src;
        dst;
        transferTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /*** Liquidity/Liquidation Calculations ***/

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `fTokenBalance` is the number of fTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
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

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, FToken(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param fTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address fTokenModify,
        uint redeemTokens,
        uint borrowAmount) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, FToken(fTokenModify), redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param fTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral fToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        FToken fTokenModify,
        uint redeemTokens,
        uint borrowAmount) internal view returns (Error, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;
        MathError mErr;

        // For each asset the account is in
        FToken[] memory assets = accountAssets[account];
        for (uint i = 0; i < assets.length; i++) {
            FToken asset = assets[i];

            // Read the balances and exchange rate from the fToken
            (oErr, vars.fTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset.getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (Error.SNAPSHOT_ERROR, 0, 0);
            }
            vars.collateralFactor = Exp({mantissa: markets[address(asset)].collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (Error.PRICE_ERROR, 0, 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> bnb (normalized price value)
            (mErr, vars.tokensToDenom) = mulExp3(vars.collateralFactor, vars.exchangeRate, vars.oraclePrice);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // sumCollateral += tokensToDenom * fTokenBalance
            (mErr, vars.sumCollateral) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.fTokenBalance, vars.sumCollateral);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // Calculate effects of interacting with fTokenModify
            if (asset == fTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0);
                }

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0);
                }
            }
        }

        /// @dev FAI Integration^
        (mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, mintedFAIs[account]);
        if (mErr != MathError.NO_ERROR) {
            return (Error.MATH_ERROR, 0, 0);
        }
        /// @dev FAI Integration$

        // These are safe, as the underflow condition is checked first
        if (vars.sumCollateral > vars.sumBorrowPlusEffects) {
            return (Error.NO_ERROR, vars.sumCollateral - vars.sumBorrowPlusEffects, 0);
        } else {
            return (Error.NO_ERROR, 0, vars.sumBorrowPlusEffects - vars.sumCollateral);
        }
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in fToken.liquidateBorrowFresh)
     * @param fTokenBorrowed The address of the borrowed fToken
     * @param fTokenCollateral The address of the collateral fToken
     * @param actualRepayAmount The amount of fTokenBorrowed underlying to convert into fTokenCollateral tokens
     * @return (errorCode, number of fTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(address fTokenBorrowed, address fTokenCollateral, uint actualRepayAmount) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = oracle.getUnderlyingPrice(FToken(fTokenBorrowed));
        uint priceCollateralMantissa = oracle.getUnderlyingPrice(FToken(fTokenCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = FToken(fTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;
        MathError mathErr;

        (mathErr, numerator) = mulExp(liquidationIncentiveMantissa, priceBorrowedMantissa);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, denominator) = mulExp(priceCollateralMantissa, exchangeRateMantissa);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, ratio) = divExp(numerator, denominator);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, seizeTokens) = mulScalarTruncate(ratio, actualRepayAmount);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new price oracle for the comptroller
      * @dev Admin function to set a new price oracle
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setPriceOracle(PriceOracle newOracle) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PRICE_ORACLE_OWNER_CHECK);
        }

        // Track the old oracle for the comptroller
        PriceOracle oldOracle = oracle;

        // Set comptroller's oracle to newOracle
        oracle = newOracle;

        // Emit NewPriceOracle(oldOracle, newOracle)
        emit NewPriceOracle(oldOracle, newOracle);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_CLOSE_FACTOR_OWNER_CHECK);
        }

        Exp memory newCloseFactorExp = Exp({mantissa: newCloseFactorMantissa});
        Exp memory lowLimit = Exp({mantissa: closeFactorMinMantissa});
        if (lessThanOrEqualExp(newCloseFactorExp, lowLimit)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        Exp memory highLimit = Exp({mantissa: closeFactorMaxMantissa});
        if (lessThanExp(highLimit, newCloseFactorExp)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, newCloseFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Admin function to set per-market collateralFactor
      * @param fToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(FToken fToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COLLATERAL_FACTOR_OWNER_CHECK);
        }

        // Verify market is listed
        Market storage market = markets[address(fToken)];
        if (!market.isListed) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SET_COLLATERAL_FACTOR_NO_EXISTS);
        }

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && oracle.getUnderlyingPrice(fToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(fToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets maxAssets which controls how many markets can be entered
      * @dev Admin function to set maxAssets
      * @param newMaxAssets New max assets
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setMaxAssets(uint newMaxAssets) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_MAX_ASSETS_OWNER_CHECK);
        }

        uint oldMaxAssets = maxAssets;
        maxAssets = newMaxAssets;
        emit NewMaxAssets(oldMaxAssets, newMaxAssets);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_LIQUIDATION_INCENTIVE_OWNER_CHECK);
        }

        // Check de-scaled min <= newLiquidationIncentive <= max
        Exp memory newLiquidationIncentive = Exp({mantissa: newLiquidationIncentiveMantissa});
        Exp memory minLiquidationIncentive = Exp({mantissa: liquidationIncentiveMinMantissa});
        if (lessThanExp(newLiquidationIncentive, minLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        Exp memory maxLiquidationIncentive = Exp({mantissa: liquidationIncentiveMaxMantissa});
        if (lessThanExp(maxLiquidationIncentive, newLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Set the given borrow caps for the given fToken markets. Borrowing that brings total borrows to or above borrow cap will revert.
      * @dev Admin or borrowCapGuardian function to set the borrow caps. A borrow cap of 0 corresponds to unlimited borrowing.
      * @param fTokens The addresses of the markets (tokens) to change the borrow caps for
      * @param newBorrowCaps The new borrow cap values in underlying to be set. A value of 0 corresponds to unlimited borrowing.
      */
    function _setMarketBorrowCaps(FToken[] calldata fTokens, uint[] calldata newBorrowCaps) external {
    	require(msg.sender == admin || msg.sender == borrowCapGuardian, "only admin or borrow cap guardian can set borrow caps"); 

        uint numMarkets = fTokens.length;
        uint numBorrowCaps = newBorrowCaps.length;

        require(numMarkets != 0 && numMarkets == numBorrowCaps, "invalid input");

        for(uint i = 0; i < numMarkets; i++) {
            borrowCaps[address(fTokens[i])] = newBorrowCaps[i];
            emit NewBorrowCap(fTokens[i], newBorrowCaps[i]);
        }
    }

    /**
     * @notice Admin function to change the Borrow Cap Guardian
     * @param newBorrowCapGuardian The address of the new Borrow Cap Guardian
     */
    function _setBorrowCapGuardian(address newBorrowCapGuardian) external {
        require(msg.sender == admin, "only admin can set borrow cap guardian");

        // Save current value for inclusion in log
        address oldBorrowCapGuardian = borrowCapGuardian;

        // Store borrowCapGuardian with value newBorrowCapGuardian
        borrowCapGuardian = newBorrowCapGuardian;

        // Emit NewBorrowCapGuardian(OldBorrowCapGuardian, NewBorrowCapGuardian)
        emit NewBorrowCapGuardian(oldBorrowCapGuardian, newBorrowCapGuardian);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param fToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(FToken fToken) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SUPPORT_MARKET_OWNER_CHECK);
        }

        if (markets[address(fToken)].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        // Note that isFortress is not in active use anymore
        fToken.isFToken(); // Sanity check to make sure its really a FToken

        markets[address(fToken)] = Market({isListed: true, isFortress: false, collateralFactorMantissa: 0});

        _addMarketInternal(fToken);

        emit MarketListed(fToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(FToken fToken) internal {
        for (uint i = 0; i < allMarkets.length; i ++) {
            require(allMarkets[i] != fToken, "market already added");
        }
        allMarkets.push(fToken);
    }

    /**
     * @notice Set whole protocol pause/unpause state
     */
    function _setProtocolPaused(bool state) public onlyAdmin returns(bool) {
        protocolPaused = state;
        emit ActionProtocolPaused(state);
        return state;
    }

    /**
      * @notice Sets a new FAI controller
      * @dev Admin function to set a new FAI controller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setFAIController(FAIControllerInterface faiController_) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_FAICONTROLLER_OWNER_CHECK);
        }

        FAIControllerInterface oldRate = faiController;
        faiController = faiController_;
        emit NewFAIController(oldRate, faiController_);
    }

    function _setFAIMintRate(uint newFAIMintRate) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_FAI_MINT_RATE_CHECK);
        }

        uint oldFAIMintRate = faiMintRate;
        faiMintRate = newFAIMintRate;
        emit NewFAIMintRate(oldFAIMintRate, newFAIMintRate);

        return uint(Error.NO_ERROR);
    }

    function _setTreasuryData(address payable newTreasuryGuardian, address payable newTreasuryAddress) external returns (uint) {
        // Check caller is admin
        if (!(msg.sender == admin || msg.sender == treasuryGuardian)) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_TREASURY_OWNER_CHECK);
        }

        address payable oldTreasuryGuardian = treasuryGuardian;
        address payable oldTreasuryAddress = treasuryAddress;

        treasuryGuardian = newTreasuryGuardian;
        treasuryAddress = newTreasuryAddress;

        return uint(Error.NO_ERROR);
    }

    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can");
        require(unitroller._acceptImplementation() == 0, "not authorized");
    }

    /*** Fortress Distribution ***/

    /**
     * @notice Recalculate and update Fortress speeds for all Fortress markets
     */
    function adminOrInitializing() internal view returns (bool) {
        return msg.sender == admin || msg.sender == comptrollerImplementation;
    }

    /*** Fts Distribution ***/

    function setFortressSpeedInternal(FToken fToken, uint fortressSpeed) internal {
        uint currentFortressSpeed = fortressSpeeds[address(fToken)];
        if (currentFortressSpeed != 0) {
            // note that FTS speed could be set to 0 to halt liquidity rewards for a market
            Exp memory borrowIndex = Exp({mantissa: fToken.borrowIndex()});
            updateFortressSupplyIndex(address(fToken));
            updateFortressBorrowIndex(address(fToken), borrowIndex);
        } else if (fortressSpeed != 0) {
            // Add the FTS market
            Market storage market = markets[address(fToken)];
            require(market.isListed == true, "market is not listed");

            if (fortressSupplyState[address(fToken)].index == 0 && fortressSupplyState[address(fToken)].block == 0) {
                fortressSupplyState[address(fToken)] = FortressMarketState({
                    index: fortressInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            }
        
            if (fortressBorrowState[address(fToken)].index == 0 && fortressBorrowState[address(fToken)].block == 0) {
                fortressBorrowState[address(fToken)] = FortressMarketState({
                    index: fortressInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            }
        }

        if (currentFortressSpeed != fortressSpeed) {
            fortressSpeeds[address(fToken)] = fortressSpeed;
            emit FortressSpeedUpdated(fToken, fortressSpeed);
        }
    }

    /**
     * @notice Accrue FTS to the market by updating the supply index
     * @param fToken The market whose supply index to update
     */
    function updateFortressSupplyIndex(address fToken) internal {
        FortressMarketState storage supplyState = fortressSupplyState[fToken];
        uint supplySpeed = fortressSpeeds[fToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = FToken(fToken).totalSupply();
            uint fortressAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(fortressAccrued, supplyTokens) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: supplyState.index}), ratio);
            fortressSupplyState[fToken] = FortressMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            supplyState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Accrue FTS to the market by updating the borrow index
     * @param fToken The market whose borrow index to update
     */
    function updateFortressBorrowIndex(address fToken, Exp memory marketBorrowIndex) internal {
        FortressMarketState storage borrowState = fortressBorrowState[fToken];
        uint borrowSpeed = fortressSpeeds[fToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(FToken(fToken).totalBorrows(), marketBorrowIndex);
            uint fortressAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(fortressAccrued, borrowAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: borrowState.index}), ratio);
            fortressBorrowState[fToken] = FortressMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            borrowState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Calculate FTS accrued by a supplier and possibly transfer it to them
     * @param fToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute FTS to
     */
    function distributeSupplierFortress(address fToken, address supplier) internal {
        if (address(faiVaultAddress) != address(0)) {
            releaseToVault();
        }

        FortressMarketState storage supplyState = fortressSupplyState[fToken];
        Double memory supplyIndex = Double({mantissa: supplyState.index});
        Double memory supplierIndex = Double({mantissa: fortressSupplierIndex[fToken][supplier]});
        fortressSupplierIndex[fToken][supplier] = supplyIndex.mantissa;

        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = fortressInitialIndex;
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = FToken(fToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        uint supplierAccrued = add_(fortressAccrued[supplier], supplierDelta);
        fortressAccrued[supplier] = supplierAccrued;
        emit DistributedSupplierFortress(FToken(fToken), supplier, supplierDelta, supplyIndex.mantissa);
    }

    /**
     * @notice Calculate FTS accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param fToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute FTS to
     */
    function distributeBorrowerFortress(address fToken, address borrower, Exp memory marketBorrowIndex) internal {
        if (address(faiVaultAddress) != address(0)) {
            releaseToVault();
        }

        FortressMarketState storage borrowState = fortressBorrowState[fToken];
        Double memory borrowIndex = Double({mantissa: borrowState.index});
        Double memory borrowerIndex = Double({mantissa: fortressBorrowerIndex[fToken][borrower]});
        fortressBorrowerIndex[fToken][borrower] = borrowIndex.mantissa;

        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(FToken(fToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            uint borrowerAccrued = add_(fortressAccrued[borrower], borrowerDelta);
            fortressAccrued[borrower] = borrowerAccrued;
            emit DistributedBorrowerFortress(FToken(fToken), borrower, borrowerDelta, borrowIndex.mantissa);
        }
    }

    /**
     * @notice Calculate FTS accrued by a FAI minter and possibly transfer it to them
     * @dev FAI minters will not begin to accrue until after the first interaction with the protocol.
     * @param faiMinter The address of the FAI minter to distribute FTS to
     */
    function distributeFAIMinterFortress(address faiMinter, bool distributeAll) public {
        if (address(faiVaultAddress) != address(0)) {
            releaseToVault();
        }

        if (address(faiController) != address(0)) {
            uint faiMinterAccrued;
            uint faiMinterDelta;
            uint faiMintIndexMantissa;
            uint err;
            (err, faiMinterAccrued, faiMinterDelta, faiMintIndexMantissa) = faiController.calcDistributeFAIMinterFortress(faiMinter);
            if (err == uint(Error.NO_ERROR)) {
                fortressAccrued[faiMinter] = faiMinterAccrued;
                emit DistributedFAIMinterFortress(faiMinter, faiMinterDelta, faiMintIndexMantissa);
            }
        }
    }

    /**
     * @notice Claim all the fts accrued by holder in all markets and FAI
     * @param holder The address to claim FTS for
     */
    function claimFortress(address holder) public {
        return claimFortress(holder, allMarkets);
    }

    /**
     * @notice Claim all the fts accrued by holder in the specified markets
     * @param holder The address to claim FTS for
     * @param fTokens The list of markets to claim FTS in
     */
    function claimFortress(address holder, FToken[] memory fTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimFortress(holders, fTokens, true, true);
    }

    /**
     * @notice Claim all fts accrued by the holders
     * @param holders The addresses to claim FTS for
     * @param fTokens The list of markets to claim FTS in
     * @param borrowers Whether or not to claim FTS earned by borrowing
     * @param suppliers Whether or not to claim FTS earned by supplying
     */
    function claimFortress(address[] memory holders, FToken[] memory fTokens, bool borrowers, bool suppliers) public {
        uint j;
        if(address(faiController) != address(0)) {
            faiController.updateFortressFAIMintIndex();
        }
        for (j = 0; j < holders.length; j++) {
            distributeFAIMinterFortress(holders[j], true);
            fortressAccrued[holders[j]] = grantFTSInternal(holders[j], fortressAccrued[holders[j]]);
        }
        for (uint i = 0; i < fTokens.length; i++) {
            FToken fToken = fTokens[i];
            require(markets[address(fToken)].isListed, "not listed market");
            if (borrowers) {
                Exp memory borrowIndex = Exp({mantissa: fToken.borrowIndex()});
                updateFortressBorrowIndex(address(fToken), borrowIndex);
                for (j = 0; j < holders.length; j++) {
                    distributeBorrowerFortress(address(fToken), holders[j], borrowIndex);
                    fortressAccrued[holders[j]] = grantFTSInternal(holders[j], fortressAccrued[holders[j]]);
                }
            }
            if (suppliers) {
                updateFortressSupplyIndex(address(fToken));
                for (j = 0; j < holders.length; j++) {
                    distributeSupplierFortress(address(fToken), holders[j]);
                    fortressAccrued[holders[j]] = grantFTSInternal(holders[j], fortressAccrued[holders[j]]);
                }
            }
        }
    }

    /**
     * @notice Transfer FTS to the user
     * @dev Note: If there is not enough FTS, we do not perform the transfer all.
     * @param user The address of the user to transfer FTS to
     * @param amount The amount of FTS to (possibly) transfer
     * @return The amount of FTS which was NOT transferred to the user
     */
    function grantFTSInternal(address user, uint amount) internal returns (uint) {
        FTS fts = FTS(getFTSAddress());
        uint fortressRemaining = fts.balanceOf(address(this));
        if (amount > 0 && amount <= fortressRemaining) {
            fts.transfer(user, amount);
            return 0;
        }
        return amount;
    }

    /*** Fts Distribution Admin ***/

    /**
     * @notice Set the amount of FTS distributed per block to FAI Mint
     * @param fortressFAIRate_ The amount of FTS wei per block to distribute to FAI Mint
     */
    function _setFortressFAIRate(uint fortressFAIRate_) public {
        require(msg.sender == admin, "only admin can");

        uint oldFAIRate = fortressFAIRate;
        fortressFAIRate = fortressFAIRate_;
        emit NewFortressFAIRate(oldFAIRate, fortressFAIRate_);
    }

    /**
     * @notice Set the amount of FTS distributed per block to FAI Vault
     * @param fortressFAIVaultRate_ The amount of FTS wei per block to distribute to FAI Vault
     */
    function _setFortressFAIVaultRate(uint fortressFAIVaultRate_) public {
        require(msg.sender == admin, "only admin can");

        uint oldFortressFAIVaultRate = fortressFAIVaultRate;
        fortressFAIVaultRate = fortressFAIVaultRate_;
        emit NewFortressFAIVaultRate(oldFortressFAIVaultRate, fortressFAIVaultRate_);
    }

    /**
     * @notice Set the FAI Vault infos
     * @param vault_ The address of the FAI Vault
     * @param releaseStartBlock_ The start block of release to FAI Vault
     * @param minReleaseAmount_ The minimum release amount to FAI Vault
     */
    function _setFAIVaultInfo(address vault_, uint256 releaseStartBlock_, uint256 minReleaseAmount_) public {
        require(msg.sender == admin, "only admin can");

        faiVaultAddress = vault_;
        releaseStartBlock = releaseStartBlock_;
        minReleaseAmount = minReleaseAmount_;
        emit NewFAIVaultInfo(vault_, releaseStartBlock_, minReleaseAmount_);
    }

    /**
     * @notice Set FTS speed for a single market
     * @param fToken The market whose FTS speed to update
     * @param fortressSpeed New FTS speed for market
     */

    function _setFortressSpeed(FToken fToken, uint fortressSpeed) public {
        require(adminOrInitializing(), "only admin can set fortress speed");
        setFortressSpeedInternal(fToken, fortressSpeed);
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (FToken[] memory) {
        return allMarkets;
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the FTS token
     * @return The address of FTS
     */
    function getFTSAddress() public view returns (address) {
        return 0x4437743ac02957068995c48E08465E0EE1769fBE;
    }

    /*** FAI functions ***/

    /**
     * @notice Set the minted FAI amount of the `owner`
     * @param owner The address of the account to set
     * @param amount The amount of FAI to set to the account
     * @return The number of minted FAI by `owner`
     */
    function setMintedFAIOf(address owner, uint amount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintFAIGuardianPaused && !repayFAIGuardianPaused, "FAI is paused");
        // Check caller is faiController
        if (msg.sender != address(faiController)) {
            return fail(Error.REJECTION, FailureInfo.SET_MINTED_FAI_REJECTION);
        }
        mintedFAIs[owner] = amount;

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Transfer FTS to FAI Vault
     */
    function releaseToVault() public {
        if(releaseStartBlock == 0 || getBlockNumber() < releaseStartBlock) {
            return;
        }

        FTS fts = FTS(getFTSAddress());

        uint256 ftsBalance = fts.balanceOf(address(this));
        if(ftsBalance == 0) {
            return;
        }


        uint256 actualAmount;
        uint256 deltaBlocks = sub_(getBlockNumber(), releaseStartBlock);
        // releaseAmount = fortressFAIVaultRate * deltaBlocks
        uint256 _releaseAmount = mul_(fortressFAIVaultRate, deltaBlocks);

        if (_releaseAmount < minReleaseAmount) {
            return;
        }

        if (ftsBalance >= _releaseAmount) {
            actualAmount = _releaseAmount;
        } else {
            actualAmount = ftsBalance;
        }

        releaseStartBlock = getBlockNumber();

        fts.transfer(faiVaultAddress, actualAmount);
        emit DistributedFAIVaultFortress(actualAmount);

        IFAIVault(faiVaultAddress).updatePendingRewards();
    }
}
