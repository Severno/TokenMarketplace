// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./AcademyToken.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract TokenMarketplace is AccessControl, Pausable, ReentrancyGuard {
    using EnumerableMap for EnumerableMap.UintToAddressMap;

    AcademyToken token;

    uint256 multiplier = 1 ether;
    uint256 round = 0;
    uint256 roundTime = 3 days;
    uint256 tokenInitialPrice = 0.00001 ether; // 0,00001 eth

    mapping(uint256 => SaleRoundSettings) public saleRounds;
    mapping(uint256 => TradeRoundSettings) public tradeRounds;
    mapping(address => address) public registrations;

    Bid[] bids;

    struct Bid {
        address seller;
        uint256 amount; // tokens amount
        uint256 price; // eth
    }

    struct SaleRoundSettings {
        uint256 maxTradeAmount; // ETH max trade amount
        uint256 tradeAmount; // ETH trade amount
        uint256 tokenPrice; // ACDM token
        uint256 tokensAmount;
        uint256 startTime;
        bool isActive;
    }

    struct TradeRoundSettings {
        uint256 tradeAmount; // ETH trade amount
        uint256 startTime;
        bool isActive;
    }

    event BidCanceled(address _msgSender, uint256 index);
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

    // modifier isActiveRound() {
    //     require(
    //         saleRounds[round].startTime + roundTime < block.timestamp,
    //         "Marketplace: Sale round is over"
    //     );
    //     _;
    // }

    modifier isAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "Marketplace: You are not an admin"
        );
        _;
    }

    constructor(address _tokenAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        token = AcademyToken(_tokenAddress);

        saleRounds[round].tokenPrice = tokenInitialPrice;
        saleRounds[round].maxTradeAmount = 1 ether;
        saleRounds[round].isActive = false;
        saleRounds[round].tradeAmount = 0;
        saleRounds[round].startTime = block.timestamp;
        saleRounds[round].tokensAmount =
            saleRounds[round].maxTradeAmount /
            saleRounds[round].tokenPrice;
    }

    /* ANCHOR Registration */

    function registration(address _referral) external {
        require(
            _referral != address(0),
            "Marketplace: Referral can't be a zero address"
        );

        require(
            _referral != msg.sender,
            "Marketplace: You can't choose yourself as a referral"
        );

        registrations[msg.sender] = _referral;
    }

    /* ANCHOR Sale Round */

    function startSaleRound() external isAdmin {
        // Set first round in contstructor. All all other rounds gonna be settuped here
        if (round > 0) setupNewSaleRound();

        saleRounds[round].isActive = true;

        token.mint(address(this), saleRounds[round].tokensAmount);
    }

    function endSaleRound() public isAdmin {
        // Сan finish the round early if all tokens have been redeemed
        if (!isFullfilledMaxTrade()) {
            // Сan finish the round if all tokens were not redeemed, but the time of the round is up
            require(
                !isSaleRoundTimeIsOver(),
                "Martketplace: Sale round time is not finished yet"
            );
        }

        saleRounds[round].isActive = false;

        burnUnredeemedTokens();
        startTradeRound();
    }

    function burnUnredeemedTokens() internal {
        uint256 burnAmount = saleRounds[round].tokensAmount -
            saleRounds[round].tradeAmount;

        if (burnAmount > 0) {
            token.burn(address(this), burnAmount);
        }
    }

    function setupNewSaleRound() internal {
        SaleRoundSettings storage prevSaleRound = saleRounds[round - 1];
        TradeRoundSettings storage prevTradeRound = tradeRounds[round - 1];

        saleRounds[round].tokenPrice = getNextRoundTokenPrice(
            (prevSaleRound.tokenPrice)
        );
        saleRounds[round].maxTradeAmount = prevTradeRound.tradeAmount;
        saleRounds[round].isActive = false;
        saleRounds[round].tradeAmount = 0;
        saleRounds[round].tokensAmount =
            saleRounds[round].maxTradeAmount /
            saleRounds[round].tokenPrice;
    }

    function buyToken() external payable {
        SaleRoundSettings storage settings = saleRounds[round];

        uint256 amount = msg.value;

        require(
            settings.tradeAmount + amount <= settings.maxTradeAmount,
            "Marketplace: The token purchase limit for this round has been reached"
        );

        destributeTreasureForSale();
        uint256 tokensAmount = convertEthToTokens(amount);

        settings.tradeAmount += tokensAmount;

        token.transfer(msg.sender, tokensAmount);

        emit BuyToken(msg.sender, tokensAmount, settings.tokenPrice);
    }

    function destributeTreasureForSale() internal {
        address referral1 = registrations[msg.sender];
        address referral2 = registrations[referral1];

        uint256 firstReferralTreasure = msg.value - ((msg.value / 100) * 95);
        uint256 secondReferralTreasure = msg.value - ((msg.value / 100) * 97);

        if (referral1 != address(0)) {
            payable(referral1).transfer(firstReferralTreasure);
        }

        if (referral2 != address(0)) {
            payable(referral2).transfer(secondReferralTreasure);
        }
    }

    /* ANCHOR Trade Round */

    function trade(uint256 _index, uint256 _amount) external payable {
        require(
            tradeRounds[round].isActive,
            "Marketplace: Trade round is not started yet"
        );

        Bid storage bid = bids[_index];

        uint256 ethCost = convertTokensToEth(_amount, bid.price);

        require(
            bid.amount >= _amount,
            "Marketplace: You can't buy more tokens than bid specified"
        );
        require(token.transfer(msg.sender, _amount));
        require(msg.value == ethCost, "Marketplace: You don't have enough eth");

        destributeTreasureForTrade();

        payable(bid.seller).transfer((ethCost / 1000) * 950);

        emit Trade(msg.sender, bid.seller, _amount, bid.price);

        if (bid.amount == _amount) {
            closeBid(_index);
        } else {
            bid.amount -= _amount;
        }

        tradeRounds[round].tradeAmount += ethCost;
    }

    function startTradeRound() internal {
        TradeRoundSettings storage settings = tradeRounds[round];

        settings.tradeAmount = 0;
        settings.isActive = true;
    }

    function endTradeRound() external isAdmin {
        if (bids.length > 0) {
            cancelAllBids();
        }
        round++;
    }

    function destributeTreasureForTrade() private {
        uint256 _amount = msg.value;

        address referral1 = registrations[msg.sender];
        address referral2 = registrations[referral1];

        uint256 firstReferralTreasure = _amount - ((_amount / 1000) * 975);
        uint256 secondReferralTreasure = _amount - ((_amount / 1000) * 975);

        if (referral1 != address(0))
            payable(referral1).transfer(firstReferralTreasure);
        if (referral2 != address(0))
            payable(referral2).transfer(secondReferralTreasure);
    }

    /* ANCHOR Bids */

    function cancelAllBids() public isAdmin {
        for (uint256 i = 0; i < bids.length; i++) {
            token.transfer(msg.sender, bids[i].amount);
        }

        delete bids;

        emit AllBidsCanceled(msg.sender);
    }

    function cancelBid(uint256 _index) public {
        require(
            bids[_index].seller == msg.sender,
            "Marketplace: You're not a token seller"
        );

        token.transfer(msg.sender, bids[_index].amount);

        delete (bids[_index]);

        emit BidCanceled(msg.sender, _index);
    }

    function closeBid(uint256 _index) internal {
        delete (bids[_index]);

        emit BidClosed(msg.sender);
    }

    function createBid(uint256 _amount, uint256 _price) external {
        require(
            _amount <= token.balanceOf(msg.sender),
            "Marketplace: You don't have enough tokens to sell"
        );

        Bid memory bid = Bid({
            seller: msg.sender,
            amount: _amount,
            price: _price
        });
        token.transferFrom(msg.sender, address(this), _amount);
        bids.push(bid);

        emit BidCreated(msg.sender, _amount, _price);
    }

    /* ANCHOR Getters */

    function getBids() external view returns (Bid[] memory) {
        return bids;
    }

    function getNextRoundTokenPrice(uint256 _prevRoundTokenPrice)
        internal
        pure
        returns (uint256)
    {
        return (_prevRoundTokenPrice * 103) / 100 + 0.000004 ether;
    }

    /* ANCHOR Utils */

    function convertEthToTokens(uint256 _amount)
        private
        view
        returns (uint256)
    {
        return _amount / saleRounds[round].tokenPrice;
    }

    function convertTokensToEth(uint256 _amount, uint256 _price)
        private
        pure
        returns (uint256)
    {
        return _amount * _price;
    }

    function isSaleRoundTimeIsOver() internal view returns (bool) {
        return saleRounds[round].startTime + roundTime > block.timestamp;
    }

    function isFullfilledMaxTrade() internal view returns (bool) {
        return
            saleRounds[round].tradeAmount == saleRounds[round].maxTradeAmount;
    }
}
