pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public ftsAddress;
    address public faiAddress;

    constructor() Comptroller() public {}

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
    /**
     * @notice Recalculate and update FTS speeds for all FTS markets
     */
    function refreshFortressSpeeds() public {
        FToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: fToken.borrowIndex()});
            updateFortressSupplyIndex(address(fToken));
            updateFortressBorrowIndex(address(fToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets_[i];
            if (fortressSpeeds[address(fToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(fToken)});
                Exp memory utility = mul_(assetPrice, fToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            FToken fToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(fortressRate, div_(utilities[i], totalUtility)) : 0;
            setFortressSpeedInternal(fToken, newSpeed);
        }
    }
}
