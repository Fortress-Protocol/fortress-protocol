pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG3.sol";

contract ComptrollerScenarioG3 is ComptrollerG3 {
    uint public blockNumber;

    constructor() ComptrollerG3() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function membershipLength(FToken fToken) public view returns (uint) {
        return accountAssets[address(fToken)].length;
    }

    function unlist(FToken fToken) public {
        markets[address(fToken)].isListed = false;
    }

    function setFortressSpeed(address fToken, uint fortressSpeed) public {
        fortressSpeeds[fToken] = fortressSpeed;
    }
}
