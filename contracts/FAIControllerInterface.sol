pragma solidity ^0.5.16;

contract FAIControllerInterface {
    function getFAIAddress() public view returns (address);
    function getMintableFAI(address minter) public view returns (uint, uint);
    function mintFAI(address minter, uint mintFAIAmount) external returns (uint);
    function repayFAI(address repayer, uint repayFAIAmount) external returns (uint);

    function _initializeFortressFAIState(uint blockNumber) external returns (uint);
    function updateFortressFAIMintIndex() external returns (uint);
    function calcDistributeFAIMinterFortress(address faiMinter) external returns(uint, uint, uint, uint);
}
