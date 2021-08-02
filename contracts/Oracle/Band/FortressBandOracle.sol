pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../../PriceOracle.sol";
import "../../FBep20.sol";
import "../../BEP20Interface.sol";
import "../../SafeMath.sol";

interface IStdReference {
    /// A structure returned whenever someone requests for standard reference data.
    struct ReferenceData {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdatedBase; // UNIX epoch of the last time when base price gets updated.
        uint256 lastUpdatedQuote; // UNIX epoch of the last time when quote price gets updated.
    }

    /// Returns the price data for the given base/quote pair. Revert if not available.
    function getReferenceData(string calldata _base, string calldata _quote) external view returns (ReferenceData memory);

    /// Similar to getReferenceData, but with multiple base/quote pairs at once.
    function getReferenceDataBulk(string[] calldata _bases, string[] calldata _quotes) external view returns (ReferenceData[] memory);
}


interface IPancakePair {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external pure returns (string memory);
    function symbol() external pure returns (string memory);
    function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);

    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function PERMIT_TYPEHASH() external pure returns (bytes32);
    function nonces(address owner) external view returns (uint);

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function MINIMUM_LIQUIDITY() external pure returns (uint);
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint);
    function price1CumulativeLast() external view returns (uint);
    function kLast() external view returns (uint);

    function mint(address to) external returns (uint liquidity);
    function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;

    function initialize(address, address) external;
}

contract FortressPriceOracle is PriceOracle {
    using SafeMath for uint256;
    address public admin;

    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    event NewAdmin(address oldAdmin, address newAdmin);

    IStdReference ref;
    
    // mainnet
    address PANCAKE_FTS_WBNB_PAIR_ADDRESS = 0xc69f2139a6Ce6912703AC10e5e74ee26Af1b4a7e;
    address PANCAKE_WBNB_BUSD_PAIR_ADDRESS = 0x1B96B92314C44b159149f7E0303511fB2Fc4774f;

    // testnet
    //address PANCAKE_FTS_WBNB_PAIR_ADDRESS = 0x761f0a0ef0f3d23AB0D7291E677332C4eB02d33b;
    //address PANCAKE_WBNB_BUSD_PAIR_ADDRESS = 0x67166FF8CB3aB98fc8EB3812DcC97EA3659C9399;

    constructor(IStdReference _ref) public {
        ref = _ref;
        admin = msg.sender;
    }

    function getUnderlyingPrice(FToken fToken) public view returns (uint) {
        if (compareStrings(fToken.symbol(), "fBNB")) {
            IStdReference.ReferenceData memory data = ref.getReferenceData("BNB", "USD");
            return data.rate;
        }else if (compareStrings(fToken.symbol(), "fFTS")) {
            IPancakePair pairFTSWBNB = IPancakePair(PANCAKE_FTS_WBNB_PAIR_ADDRESS);
            IPancakePair pairWBNBBUSD = IPancakePair(PANCAKE_WBNB_BUSD_PAIR_ADDRESS);
            (uint reserve00, uint reserve01,) = pairFTSWBNB.getReserves();
            (uint reserve10, uint reserve11,) = pairWBNBBUSD.getReserves();
            if (reserve00 == 0 || reserve01 == 0 || reserve10 == 0 || reserve11 == 0) {
                return 0;
            } else {
                uint ftsBNBPrice = reserve01.mul(1e18).div(reserve00);
                uint bnbPrice = reserve11.mul(1e18).div(reserve10);
                return ftsBNBPrice.mul(bnbPrice).div(1e18);
            }
        }else if (compareStrings(fToken.symbol(), "FTS")) {
            return prices[address(fToken)];
        } else {
            uint256 price;
            BEP20Interface token = BEP20Interface(FBep20(address(fToken)).underlying());

            if(prices[address(token)] != 0) {
                price = prices[address(token)];
            } else {
                IStdReference.ReferenceData memory data = ref.getReferenceData(token.symbol(), "USD");
                price = data.rate;
            }

            uint decimalDelta = 18-uint(token.decimals());
            return price.mul(10**decimalDelta);
        }
    }

    function setUnderlyingPrice(FToken fToken, uint underlyingPriceMantissa) public {
        require(msg.sender == admin, "only admin can set underlying price");
        address asset = address(FBep20(address(fToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        require(msg.sender == admin, "only admin can set price");
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "only admin can set new admin");
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }
}
