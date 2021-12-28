// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./AcademyToken.sol";
import "./ITokenMarketplace.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenMarketplace is
    ITokenMarketplace,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    AcademyToken token;

    uint256 multiplier = 1 ether;
    uint8 round = 0;
    uint32 roundTime = 3 days;
    uint256 tokenInitialPrice = 0.00001 ether; // 0,00001 eth

    mapping(uint8 => SaleRoundSettings) public saleRounds;
    mapping(uint8 => TradeRoundSettings) public tradeRounds;
    // Connect msg.sender to referral
    mapping(address => address) public registrations;

    Bid[] public bids;

    struct Bid {
        address seller; // token seller
        uint256 amount; // tokens amount to sell
        uint256 price; // ETH price of one token
    }

    struct SaleRoundSettings {
        uint256 maxTradeAmount; // ETH max trade amount
        uint256 tradeAmount; // ETH trade amount
        uint256 tokenPrice; // ACDM token price
        uint256 tokensAmount; // ACDM token amount
        uint256 startTime; // block.timestamp time
        bool isActive; // isActiveRound
    }

    struct TradeRoundSettings {
        uint256 tradeAmount; // ETH trade amount
        uint256 startTime; // block.timestamp time
        bool isActive; // isActiveRound
    }

    modifier isAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "You are not an admin"
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

    /** @dev Registering a user with a referral
     * @param _referral referral address(metamask).
     */
    function registration(address _referral)
        external
        whenNotPaused
        nonReentrant
    {
        require(_referral != address(0), "Referral can't be a zero address");

        require(
            _referral != msg.sender,
            "You can't choose yourself as a referral"
        );

        registrations[msg.sender] = _referral;

        emit Registered(msg.sender, _referral);
    }

    /* ANCHOR Sale Round */

    /** @dev Start sale round and mint a number of tokens
     * depending on the volume of trades in the trade round
     */
    function startSaleRound() external isAdmin {
        require(
            !saleRounds[round].isActive,
            "You can't start new round while previouse is not finished yet"
        );

        // Set first round in contstructor. All all other rounds gonna be settuped here
        if (round > 0) setupNewSaleRound();

        saleRounds[round].isActive = true;

        token.mint(address(this), saleRounds[round].tokensAmount);

        emit StartSaleRound(round, saleRounds[round].tokensAmount);
    }

    /** @dev Finish the sale round, burn unredeemed tokens,
     * and immediately begin the trade round
     */
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

        emit EndSaleRound(round, saleRounds[round].tradeAmount);
    }

    /** @dev Burn unredeemed tokens
     */
    function burnUnredeemedTokens() internal {
        uint256 burnAmount = saleRounds[round].tokensAmount -
            saleRounds[round].tradeAmount;

        if (burnAmount > 0) {
            token.burn(address(this), burnAmount);
        }
    }

    /** @dev Take the data from the previous sale and trade round, 
        count the maximum number of tokens to sell in the new sale round 
     */
    function setupNewSaleRound() internal {
        saleRounds[round].tokenPrice = getNextRoundTokenPrice(
            (saleRounds[round - 1].tokenPrice)
        );
        saleRounds[round].maxTradeAmount = tradeRounds[round - 1].tradeAmount;
        saleRounds[round].isActive = false;
        saleRounds[round].tradeAmount = 0;
        saleRounds[round].tokensAmount =
            saleRounds[round].maxTradeAmount /
            saleRounds[round].tokenPrice;
    }

    /** @dev The user can buy tokens in the sale round
     */
    function buyToken() external payable whenNotPaused nonReentrant {
        require(
            saleRounds[round].tradeAmount + msg.value <=
                saleRounds[round].maxTradeAmount,
            "The token purchase limit for this round has been reached"
        );

        destributeTreasureForSale();

        uint256 tokensAmount = convertEthToTokens(msg.value);

        saleRounds[round].tradeAmount += tokensAmount;

        token.transfer(msg.sender, tokensAmount);

        emit BuyToken(msg.sender, tokensAmount, saleRounds[round].tokenPrice);
    }

    /** @dev Distribute ETH to referrals
     * Depending on the percentage
     * The first referral receives 5% of the user's purchase
     * Second one gets 3%.
     * Contract gets 92%%.
     * If the user has no referrals specified, all 100% gets a contract
     */
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

    /** @dev A user can buy tokens from another user in ETH.
     * The distribution of the referral goes as follows:
     * To the first referral - 2.5%
     * To the second referral - 2.5%
     * Contract - 0%
     * If no referrals are specified, the contract gets 5%
     */
    function trade(uint256 _index, uint256 _amount)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(tradeRounds[round].isActive, "Trade round is not started yet");

        Bid storage bid = bids[_index];

        uint256 ethCost = convertTokensToEth(_amount, bid.price);

        require(
            bid.amount >= _amount,
            "You can't buy more tokens than bid specified"
        );
        require(token.transfer(msg.sender, _amount));
        require(msg.value == ethCost, "You don't have enough eth");

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

    /** @dev Start trade round
     */
    function startTradeRound() internal {
        TradeRoundSettings storage settings = tradeRounds[round];

        settings.tradeAmount = 0;
        settings.isActive = true;
    }

    /** @dev End trade round, close all open orders and return ACDM tokens to users
     */
    function endTradeRound() external isAdmin {
        if (bids.length > 0) {
            cancelAllBids();
        }

        emit EndTradeRound(round, tradeRounds[round].tradeAmount);

        round++;
    }

    /** @dev Distribute ETH for trade
     * The distribution of the referral goes as follows:
     * To the first referral - 2.5%
     * To the second referral - 2.5%
     * Contract - 0%
     * If no referrals are specified, the contract gets 5%
     */
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

    function cancelAllBids() private {
        for (uint256 i = 0; i < bids.length; i++) {
            token.transfer(msg.sender, bids[i].amount);
        }

        delete bids;

        emit AllBidsCanceled(msg.sender);
    }

    function cancelBid(uint256 _index) public whenNotPaused nonReentrant {
        require(bids[_index].seller == msg.sender, "You're not a token seller");

        token.transfer(msg.sender, bids[_index].amount);

        delete (bids[_index]);

        emit BidCanceled(msg.sender, _index);
    }

    function closeBid(uint256 _index) internal {
        delete (bids[_index]);

        emit BidClosed(msg.sender);
    }

    /** @dev Create a bid to sell ACDM tokens
     */
    function createBid(uint256 _amount, uint256 _price)
        external
        whenNotPaused
        nonReentrant
    {
        require(
            _amount <= token.balanceOf(msg.sender),
            "You don't have enough tokens to sell"
        );

        token.transferFrom(msg.sender, address(this), _amount);
        bids.push(Bid({seller: msg.sender, amount: _amount, price: _price}));

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
        internal
        view
        returns (uint256)
    {
        return _amount / saleRounds[round].tokenPrice;
    }

    function convertTokensToEth(uint256 _amount, uint256 _price)
        internal
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
