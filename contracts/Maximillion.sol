pragma solidity ^0.5.16;

import "./FBNB.sol";

/**
 * @title Fortress's Maximillion Contract
 * @author Fortress
 */
contract Maximillion {
    /**
     * @notice The default fBnb market to repay in
     */
    FBNB public fBnb;

    /**
     * @notice Construct a Maximillion to repay max in a FBNB market
     */
    constructor(FBNB fBnb_) public {
        fBnb = fBnb_;
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in the fBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, fBnb);
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in a fBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param fBnb_ The address of the fBnb contract to repay in
     */
    function repayBehalfExplicit(address borrower, FBNB fBnb_) public payable {
        uint received = msg.value;
        uint borrows = fBnb_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            fBnb_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            fBnb_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
