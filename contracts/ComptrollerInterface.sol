pragma solidity ^0.5.16;

contract ComptrollerInterface {
    /// @notice Indicator that this is a Comptroller contract (for inspection)
    bool public constant isComptroller = true;

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata fTokens) external returns (uint[] memory);
    function exitMarket(address fToken) external returns (uint);

    /*** Policy Hooks ***/

    function mintAllowed(address fToken, address minter, uint mintAmount) external returns (uint);
    function mintVerify(address fToken, address minter, uint mintAmount, uint mintTokens) external;

    function redeemAllowed(address fToken, address redeemer, uint redeemTokens) external returns (uint);
    function redeemVerify(address fToken, address redeemer, uint redeemAmount, uint redeemTokens) external;

    function borrowAllowed(address fToken, address borrower, uint borrowAmount) external returns (uint);
    function borrowVerify(address fToken, address borrower, uint borrowAmount) external;

    function repayBorrowAllowed(
        address fToken,
        address payer,
        address borrower,
        uint repayAmount) external returns (uint);
    function repayBorrowVerify(
        address fToken,
        address payer,
        address borrower,
        uint repayAmount,
        uint borrowerIndex) external;

    function liquidateBorrowAllowed(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external returns (uint);
    function liquidateBorrowVerify(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount,
        uint seizeTokens) external;

    function seizeAllowed(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external returns (uint);
    function seizeVerify(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external;

    function transferAllowed(address fToken, address src, address dst, uint transferTokens) external returns (uint);
    function transferVerify(address fToken, address src, address dst, uint transferTokens) external;

    /*** Liquidity/Liquidation Calculations ***/

    function liquidateCalculateSeizeTokens(
        address fTokenBorrowed,
        address fTokenCollateral,
        uint repayAmount) external view returns (uint, uint);

    function setMintedFAIOf(address owner, uint amount) external returns (uint);
}

contract ComptrollerG5Interface {
    /// @notice Indicator that this is a Comptroller contract (for inspection)
    bool public constant isComptroller = true;

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata fTokens) external returns (uint[] memory);
    function exitMarket(address fToken) external returns (uint);

    /*** Policy Hooks ***/

    function mintAllowed(address fToken, address minter, uint mintAmount) external returns (uint);
    function mintVerify(address fToken, address minter, uint mintAmount, uint mintTokens) external;

    function redeemAllowed(address fToken, address redeemer, uint redeemTokens) external returns (uint);
    function redeemVerify(address fToken, address redeemer, uint redeemAmount, uint redeemTokens) external;

    function borrowAllowed(address fToken, address borrower, uint borrowAmount) external returns (uint);
    function borrowVerify(address fToken, address borrower, uint borrowAmount) external;

    function repayBorrowAllowed(
        address fToken,
        address payer,
        address borrower,
        uint repayAmount) external returns (uint);
    function repayBorrowVerify(
        address fToken,
        address payer,
        address borrower,
        uint repayAmount,
        uint borrowerIndex) external;

    function liquidateBorrowAllowed(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external returns (uint);
    function liquidateBorrowVerify(
        address fTokenBorrowed,
        address fTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount,
        uint seizeTokens) external;

    function seizeAllowed(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external returns (uint);
    function seizeVerify(
        address fTokenCollateral,
        address fTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external;

    function transferAllowed(address fToken, address src, address dst, uint transferTokens) external returns (uint);
    function transferVerify(address fToken, address src, address dst, uint transferTokens) external;

    /*** Liquidity/Liquidation Calculations ***/

    function liquidateCalculateSeizeTokens(
        address fTokenBorrowed,
        address fTokenCollateral,
        uint repayAmount) external view returns (uint, uint);
}

interface IComptroller {
    /*** Treasury Data ***/
    function treasuryGuardian() external view returns (address payable);
    function treasuryAddress() external view returns (address payable);
}

interface IFAIVault {
    function updatePendingRewards() external;
}
