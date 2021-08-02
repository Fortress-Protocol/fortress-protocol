pragma solidity ^0.5.16;

import "../PriceOracle.sol";
import "../FBep20.sol";
import "../BEP20Interface.sol";
import "../Exponential.sol";
import "../SafeMath.sol";
import "./Chainlink/AggregatorV2V3Interface.sol";
import "./Umbrella/IChain.sol";
import "./Umbrella/IRegistry.sol";
import "./IPancakePair.sol";

contract FortressPriceOracle is PriceOracle, Exponential {
    using SafeMath for uint;
    address public admin;

    address public constant WBNB_ADDRESS = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant FTS_ADDRESS = 0x4437743ac02957068995c48E08465E0EE1769fBE;

    address public constant FBNB_ADDRESS = 0xE24146585E882B6b59ca9bFaaaFfED201E4E5491;

    mapping(address => uint) internal prices;
    mapping(address => AggregatorV2V3Interface) internal feeds;

    /// @notice Check if the address is LP
    mapping(address => bool) public areLPs;

    // Umbrella registry with all contract addresses, most important is `Chain`
    IRegistry public registry;
    bytes32 public ftsKey;

    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    event NewAdmin(address oldAdmin, address newAdmin);
    event FeedSet(address feed, address token);

    constructor() public {
        admin = msg.sender;
    }

    function getUnderlyingPrice(FToken fToken) public view returns (uint) {
        if (address(fToken) == FBNB_ADDRESS) {
            return getPrice(WBNB_ADDRESS);
        }

        address underlying = FBep20(address(fToken)).underlying();
        uint price = getPrice(underlying);

        uint decimalDelta = uint(18).sub(uint(BEP20Interface(underlying).decimals()));
        // Ensure that we don't multiply the result by 0
        if (decimalDelta > 0) {
            return price.mul(10**decimalDelta);
        } else {
            return price;
        }
    }

    function getPrice(address underlying) internal view returns (uint) {
        if (prices[underlying] != 0) {
            // return v1 price.
            return prices[address(underlying)];
        } else if (underlying == FTS_ADDRESS) {
            // Handle Umbrella supported tokens.
            return getUmbrellaPrice(ftsKey);
        } else if (areLPs[underlying]) {
            // Handle LP tokens.
            return getLPFairPrice(underlying);
        } else {
            // Handle Chainlink supported tokens.
            return getChainlinkPrice(getFeed(underlying));
        }
    }

    /**
     * @notice Get the fair price of a LP. We use the mechanism from Alpha Finance.
     *         Ref: https://blog.alphafinance.io/fair-lp-token-pricing/
     * @param pair The pair of AMM (PancakeSwap)
     * @return The price
     */
    function getLPFairPrice(address pair) internal view returns (uint) {
        address token0 = IPancakePair(pair).token0();
        address token1 = IPancakePair(pair).token1();
        uint totalSupply = IPancakePair(pair).totalSupply();
        (uint r0, uint r1, ) = IPancakePair(pair).getReserves();
        uint sqrtR = sqrt(mul_(r0, r1));
        uint p0 = getPrice(token0);
        uint p1 = getPrice(token1);
        uint sqrtP = sqrt(mul_(p0, p1));
        return div_(mul_(2, mul_(sqrtR, sqrtP)), totalSupply);
    }

    function getChainlinkPrice(AggregatorV2V3Interface feed) internal view returns (uint) {
        // Chainlink USD-denominated feeds store answers at 8 decimals
        uint decimalDelta = uint(18).sub(feed.decimals());
        // Ensure that we don't multiply the result by 0
        if (decimalDelta > 0) {
            return uint(feed.latestAnswer()).mul(10**decimalDelta);
        } else {
            return uint(feed.latestAnswer());
        }
    }

    function getUmbrellaPrice(bytes32 _key) public view returns (uint256) {
        (uint256 value, uint256 timestamp) = _chain().getCurrentValue(_key);
        require(timestamp > 0, "value does not exists");
        return value;
    }

    function setUmbrellaRegistry(address _registry) external onlyAdmin {
        require(_registry != address(0x0), "_registry is empty");
        registry = IRegistry(_registry);
    }
    function setUmbrellaFTSKey(bytes32 _ftsKey) external onlyAdmin {
        require(_ftsKey != 0x0, "_ftsKey is empty");
        ftsKey = _ftsKey;
    }

    function _chain() internal view returns (IChain umbChain) {
        umbChain = IChain(registry.getAddress("Chain"));
    }

    function setUnderlyingPrice(FToken fToken, uint underlyingPriceMantissa) external onlyAdmin() {
        address asset = address(FBep20(address(fToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) external onlyAdmin() {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function setFeed(address token, address feed) external onlyAdmin() {
        require(feed != address(0) && feed != address(this), "invalid feed address");
        emit FeedSet(feed, token);
        feeds[token] = AggregatorV2V3Interface(feed);
    }

    function getFeed(address token) public view returns (AggregatorV2V3Interface) {
        return feeds[token];
    }

    /**
     * @notice See assets as LP tokens for multiple tokens
     * @param tokenAddresses The list of tokens
     * @param isLP The list of token properties (it's LP or not)
     */
    function setLPs(address[] calldata tokenAddresses, bool[] calldata isLP) external onlyAdmin() {
        require(tokenAddresses.length == isLP.length, "mismatched data");
        for (uint i = 0; i < tokenAddresses.length; i++) {
            areLPs[tokenAddresses[i]] = isLP[i];
        }
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function setAdmin(address newAdmin) external onlyAdmin() {
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }

    modifier onlyAdmin() {
      require(msg.sender == admin, "only admin may call");
      _;
    }
}
