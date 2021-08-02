pragma solidity ^0.5.16;
import "./SafeMath.sol";
import "./IBEP20.sol";

contract FAIVaultAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of FAI Vault
    */
    address public faiVaultImplementation;

    /**
    * @notice Pending brains of FAI Vault
    */
    address public pendingFAIVaultImplementation;
}

contract FAIVaultStorage is FAIVaultAdminStorage {
    /// @notice The FTS TOKEN!
    IBEP20 public fts;

    /// @notice The FAI TOKEN!
    IBEP20 public fai;

    /// @notice Guard variable for re-entrancy checks
    bool internal _notEntered;

    /// @notice FTS balance of vault
    uint256 public ftsBalance;

    /// @notice Accumulated FTS per share
    uint256 public accFTSPerShare;

    //// pending rewards awaiting anyone to update
    uint256 public pendingRewards;

    /// @notice Info of each user.
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    // Info of each user that stakes tokens.
    mapping(address => UserInfo) public userInfo;
}
