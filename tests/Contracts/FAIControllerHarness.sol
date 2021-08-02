pragma solidity ^0.5.16;

import "../../contracts/FAIController.sol";

contract FAIControllerHarness is FAIController {
    address faiAddress;
    uint public blockNumber;

    constructor() FAIController() public {}

    function setFortressFAIState(uint224 index, uint32 blockNumber_) public {
        fortressFAIState.index = index;
        fortressFAIState.block = blockNumber_;
    }

    function setFAIAddress(address faiAddress_) public {
        faiAddress = faiAddress_;
    }

    function getFAIAddress() public view returns (address) {
        return faiAddress;
    }

    function setFortressFAIMinterIndex(address faiMinter, uint index) public {
        fortressFAIMinterIndex[faiMinter] = index;
    }

    function harnessUpdateFortressFAIMintIndex() public {
        updateFortressFAIMintIndex();
    }

    function harnessCalcDistributeFAIMinterFortress(address faiMinter) public {
        calcDistributeFAIMinterFortress(faiMinter);
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
}
