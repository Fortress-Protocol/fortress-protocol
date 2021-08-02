pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG1.sol";

contract ComptrollerScenarioG1 is ComptrollerG1 {
    uint public blockNumber;
    address public ftsAddress;
    address public faiAddress;

    constructor() ComptrollerG1() public {}

    function setFTSAddress(address ftsAddress_) public {
        ftsAddress = ftsAddress_;
    }

    function getFTSAddress() public view returns (address) {
        return ftsAddress;
    }

    function setFAIAddress(address faiAddress_) public {
        faiAddress = faiAddress_;
    }

    function getFAIAddress() public view returns (address) {
        return faiAddress;
    }

    function membershipLength(FToken fToken) public view returns (uint) {
        return accountAssets[address(fToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
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
            if (markets[address(allMarkets[i])].isFortress) {
                n++;
            }
        }

        address[] memory fortressMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isFortress) {
                fortressMarkets[k++] = address(allMarkets[i]);
            }
        }
        return fortressMarkets;
    }

    function unlist(FToken fToken) public {
        markets[address(fToken)].isListed = false;
    }
}
