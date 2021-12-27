// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./AcademyToken.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract TokenMarketplace is AccessControl {
    using EnumerableMap for EnumerableMap.UintToAddressMap;

    AcademyToken token;

    uint256 multiplier = 1 ether;
    uint256 round = 0;
    uint256 roundTime = 3 days;
    uint256 tokenInitialPrice = 0.00001 ether; // 0,00001 eth

    mapping(uint256 => SaleRoundSettings) public saleRounds;
    mapping(uint256 => TradeRoundSettings) public tradeRounds;
    mapping(address => address[]) public referrals;
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
        console.log(_referral, msg.sender);
        require(
            _referral != address(0),
            "Marketplace: Referral can't be a zero address"
        );

        require(
            _referral != msg.sender,
            "Marketplace: You can't choose yourself as a referral"
        );

        require(
            referrals[_referral].length != 2,
            "Marketplace: User can only have two referrals"
        );

        registrations[msg.sender] = _referral;
        referrals[_referral].push(msg.sender);
    }

    /* ANCHOR Sale Round */

    function startSaleRound() external isAdmin {
        // Set first round in contstructor. All all other rounds gonna be settuped here
        if (round > 0) setupNewSaleRound();

        saleRounds[round].isActive = true;

        token.mint(address(this), saleRounds[round].tokensAmount);
    }

    function endSaleRound() public isAdmin {
        console.log(
            isFullfilledMaxTrade(),
            !isFullfilledMaxTrade(),
            isSaleRoundTimeIsOver(),
            !isSaleRoundTimeIsOver()
        );
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
            convertEthToTokens(saleRounds[round].tradeAmount);

        console.log(
            convertEthToTokens(saleRounds[round].tradeAmount),
            saleRounds[round].tradeAmount,
            saleRounds[round].tokensAmount,
            burnAmount
        );
        uint256 balance = token.balanceOf(address(this));
        console.log(balance);

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

        console.log(
            "setupNewSaleRound",
            getNextRoundTokenPrice((prevSaleRound.tokenPrice)),
            saleRounds[round].tokensAmount,
            saleRounds[round].maxTradeAmount
        );
    }

    function buyOnSaleRound() external payable {
        SaleRoundSettings storage settings = saleRounds[round];

        uint256 amount = msg.value;

        require(
            settings.tradeAmount + amount <= settings.maxTradeAmount,
            "Marketplace: The token purchase limit for this round has been reached"
        );

        uint256 leftAfterDestribution = destributeTreasureForSale(msg.sender);
        uint256 tokensAmount = convertEthToTokens(leftAfterDestribution);

        settings.tradeAmount += tokensAmount;

        token.transfer(msg.sender, tokensAmount);

        emit BuyToken(msg.sender, tokensAmount, settings.tokenPrice);
    }

    function destributeTreasureForSale(address _msgSender)
        internal
        returns (uint256)
    {
        address referral = registrations[_msgSender];
        uint256 leftAfterDestribution = msg.value;
        uint256 firstReferralTreasure = msg.value - ((msg.value / 100) * 95);
        uint256 secondReferralTreasure = msg.value - ((msg.value / 100) * 97);
        console.log("address(this)", msg.sender, address(this));
        if (referrals[referral].length == 0) {
            payable(address(this)).transfer(
                firstReferralTreasure + secondReferralTreasure
            );
            leftAfterDestribution -=
                firstReferralTreasure -
                secondReferralTreasure;
        }

        if (referrals[referral].length == 1) {
            payable(referrals[referral][0]).transfer(firstReferralTreasure);
            leftAfterDestribution -= firstReferralTreasure;
        }

        if (referrals[referral].length == 2) {
            payable(referrals[referral][1]).transfer(secondReferralTreasure);
            leftAfterDestribution -= secondReferralTreasure;
        }

        return leftAfterDestribution;
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

        bid.amount -= _amount;

        require(token.transfer(msg.sender, _amount));

        require(msg.value == ethCost, "Marketplace: You don't have enough eth");

        uint256 leftAfterDestribution = destributeTreasureForTrade(msg.sender);

        payable(bid.seller).transfer(leftAfterDestribution);

        if (bid.amount == _amount) {
            closeBid(_index);
        }

        tradeRounds[round].tradeAmount += ethCost;

        console.log("trade", ethCost, tradeRounds[round].tradeAmount, round);

        emit Trade(msg.sender, bid.seller, _amount, bid.price);
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

    function destributeTreasureForTrade(address _msgSender)
        private
        returns (uint256)
    {
        uint256 _amount = msg.value;

        address referral = registrations[_msgSender];
        uint256 leftAfterDestribution = _amount;
        uint256 firstReferralTreasure = _amount - ((_amount / 1000) * 975);
        uint256 secondReferralTreasure = _amount - ((_amount / 1000) * 975);

        if (referrals[referral].length == 0) {
            payable(address(this)).transfer(
                firstReferralTreasure + secondReferralTreasure
            );
            leftAfterDestribution -=
                firstReferralTreasure -
                secondReferralTreasure;
        }

        if (referrals[referral].length == 1) {
            payable(referrals[referral][0]).transfer(firstReferralTreasure);
            leftAfterDestribution -= firstReferralTreasure;
        }

        if (referrals[referral].length == 2) {
            payable(referrals[referral][1]).transfer(secondReferralTreasure);
            leftAfterDestribution -= secondReferralTreasure;
        }

        return leftAfterDestribution;
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
            "Marketpalce: You don't have enough tokens to sell"
        );

        Bid memory bid = Bid({
            seller: msg.sender,
            amount: _amount,
            price: _price
        });

        console.log("createBidBefore", token.balanceOf(address(this)));

        token.transferFrom(msg.sender, address(this), _amount);

        console.log("createBidAfter", token.balanceOf(address(this)));

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
