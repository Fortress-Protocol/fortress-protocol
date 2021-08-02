pragma solidity ^0.5.16;

import "./FToken.sol";
import "./PriceOracle.sol";
import "./FAIControllerInterface.sol";

contract UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of Unitroller
    */
    address public comptrollerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingComptrollerImplementation;
}

contract ComptrollerV1Storage is UnitrollerAdminStorage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => FToken[]) public accountAssets;

    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives FTS
        bool isFortress;
    }

    /**
     * @notice Official mapping of fTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;

    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;

    struct FortressMarketState {
        /// @notice The market's last updated fortressBorrowIndex or fortressSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice A list of all markets
    FToken[] public allMarkets;

    /// @notice The rate at which the flywheel distributes FTS, per block
    uint public fortressRate;

    /// @notice The portion of fortressRate that each market currently receives
    mapping(address => uint) public fortressSpeeds;

    /// @notice The Fortress market supply state for each market
    mapping(address => FortressMarketState) public fortressSupplyState;

    /// @notice The Fortress market borrow state for each market
    mapping(address => FortressMarketState) public fortressBorrowState;

    /// @notice The Fortress supply index for each market for each supplier as of the last time they accrued FTS
    mapping(address => mapping(address => uint)) public fortressSupplierIndex;

    /// @notice The Fortress borrow index for each market for each borrower as of the last time they accrued FTS
    mapping(address => mapping(address => uint)) public fortressBorrowerIndex;

    /// @notice The FTS accrued but not yet transferred to each user
    mapping(address => uint) public fortressAccrued;

    /// @notice The Address of FAIController
    FAIControllerInterface public faiController;

    /// @notice The minted FAI amount to each user
    mapping(address => uint) public mintedFAIs;

    /// @notice FAI Mint Rate as a percentage
    uint public faiMintRate;

    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     */
    bool public mintFAIGuardianPaused;
    bool public repayFAIGuardianPaused;

    /**
     * @notice Pause/Unpause whole protocol actions
     */
    bool public protocolPaused;

    /// @notice The rate at which the flywheel distributes FTS to FAI Minters, per block
    uint public fortressFAIRate;
}

contract ComptrollerV2Storage is ComptrollerV1Storage {
    /// @notice The rate at which the flywheel distributes FTS to FAI Vault, per block
    uint public fortressFAIVaultRate;

    // address of FAI Vault
    address public faiVaultAddress;

    // start block of release to FAI Vault
    uint256 public releaseStartBlock;

    // minimum release amount to FAI Vault
    uint256 public minReleaseAmount;
}

contract ComptrollerV3Storage is ComptrollerV2Storage {
    /// @notice Treasury Guardian address
    address payable public treasuryGuardian;

    /// @notice Treasury address
    address payable public treasuryAddress;
}

contract ComptrollerV4Storage is ComptrollerV3Storage {
    // @notice The borrowCapGuardian can set borrowCaps to any number for any market. Lowering the borrow cap could disable borrowing on the given market.
    address public borrowCapGuardian;

    // @notice Borrow caps enforced by borrowAllowed for each fToken address. Defaults to zero which corresponds to unlimited borrowing.
    mapping(address => uint) public borrowCaps;
}

contract ComptrollerV5Storage is ComptrollerV4Storage {
    // @notice Disable FTS emission to borrower of the specific market. Defaults to false which corresponds to enable FTS allocation.
    mapping(address => bool) public disableBorrowFortress;
}
