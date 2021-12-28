// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface ITokenMarketplace {
    event BidCanceled(address _msgSender, uint256 _index);
    event StartSaleRound(uint8 _round, uint256 _minted);
    event EndSaleRound(uint8 _round, uint256 _tradeAmount);
    event EndTradeRound(uint8 _round, uint256 _tradeAmount);
    event Registered(address _msgSender, address referral);
    event BidClosed(address _msgSender);
    event AllBidsCanceled(address _msgSender);
    event BidCreated(address _msgSender, uint256 _amount, uint256 _price);
    event Trade(
        address _msgSender,
        address _seller,
        uint256 _amount,
        uint256 _price
    );
    event BuyToken(address _msgSender, uint256 _amount, uint256 _price);
}
