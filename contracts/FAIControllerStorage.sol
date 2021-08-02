pragma solidity ^0.5.16;

import "./ComptrollerInterface.sol";

contract FAIUnitrollerAdminStorage {
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
    address public faiControllerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingFAIControllerImplementation;
}

contract FAIControllerStorage is FAIUnitrollerAdminStorage {
    ComptrollerInterface public comptroller;

    struct FortressFAIState {
        /// @notice The last updated fortressFAIMintIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice The Fortress FAI state
    FortressFAIState public fortressFAIState;

    /// @notice The Fortress FAI state initialized
    bool public isFortressFAIInitialized;

    /// @notice The Fortress FAI minter index as of the last time they accrued FTS
    mapping(address => uint) public fortressFAIMinterIndex;
}
