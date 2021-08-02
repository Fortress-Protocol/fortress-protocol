pragma solidity ^0.5.16;

import "../../contracts/FAI/FAI.sol";

contract FAIHarness is FAI {
    uint blockNumber = 100000;

    constructor(uint chainId) FAI(chainId) public {}

    function harnessFastForward(uint blocks) public {
        blockNumber += blocks;
    }

    function harnessSetTotalSupply(uint _totalSupply) public {
        totalSupply = _totalSupply;
    }

    function harnessIncrementTotalSupply(uint addtlSupply_) public {
        totalSupply = totalSupply + addtlSupply_;
    }

    function harnessSetBalanceOf(address account, uint _amount) public {
        balanceOf[account] = _amount;
    }

}
