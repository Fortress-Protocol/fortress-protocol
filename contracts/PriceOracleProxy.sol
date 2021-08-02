pragma solidity ^0.5.16;

import "./FBep20.sol";
import "./FToken.sol";
import "./PriceOracle.sol";

interface V1PriceOracleInterface {
    function assetPrices(address asset) external view returns (uint);
}

contract PriceOracleProxy is PriceOracle {
    /// @notice Indicator that this is a PriceOracle contract (for inspection)
    bool public constant isPriceOracle = true;

    /// @notice The v1 price oracle, which will continue to serve prices for v1 assets
    V1PriceOracleInterface public v1PriceOracle;

    /// @notice Address of the guardian, which may set the SAI price once
    address public guardian;

    /// @notice Address of the fBnb contract, which has a constant price
    address public fBnbAddress;

    /// @notice Address of the fUSDC contract, which we hand pick a key for
    address public fUsdcAddress;

    /// @notice Address of the fUSDT contract, which uses the fUSDC price
    address public fUsdtAddress;

    /// @notice Address of the fSAI contract, which may have its price set
    address public fSaiAddress;

    /// @notice Address of the fDAI contract, which we hand pick a key for
    address public fDaiAddress;

    /// @notice Handpicked key for USDC
    address public constant usdcOracleKey = address(1);

    /// @notice Handpicked key for DAI
    address public constant daiOracleKey = address(2);

    /// @notice Frozen SAI price (or 0 if not set yet)
    uint public saiPrice;

    /**
     * @param guardian_ The address of the guardian, which may set the SAI price once
     * @param v1PriceOracle_ The address of the v1 price oracle, which will continue to operate and hold prices for collateral assets
     * @param fBnbAddress_ The address of fBNB, which will return a constant 1e18, since all prices relative to bnb
     * @param fUsdcAddress_ The address of fUSDC, which will be read from a special oracle key
     * @param fSaiAddress_ The address of fSAI, which may be read directly from storage
     * @param fDaiAddress_ The address of fDAI, which will be read from a special oracle key
     * @param fUsdtAddress_ The address of fUSDT, which uses the fUSDC price
     */
    constructor(address guardian_,
                address v1PriceOracle_,
                address fBnbAddress_,
                address fUsdcAddress_,
                address fSaiAddress_,
                address fDaiAddress_,
                address fUsdtAddress_) public {
        guardian = guardian_;
        v1PriceOracle = V1PriceOracleInterface(v1PriceOracle_);

        fBnbAddress = fBnbAddress_;
        fUsdcAddress = fUsdcAddress_;
        fSaiAddress = fSaiAddress_;
        fDaiAddress = fDaiAddress_;
        fUsdtAddress = fUsdtAddress_;
    }

    /**
     * @notice Get the underlying price of a listed fToken asset
     * @param fToken The fToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18)
     */
    function getUnderlyingPrice(FToken fToken) public view returns (uint) {
        address fTokenAddress = address(fToken);

        if (fTokenAddress == fBnbAddress) {
            // bnb always worth 1
            return 1e18;
        }

        if (fTokenAddress == fUsdcAddress || fTokenAddress == fUsdtAddress) {
            return v1PriceOracle.assetPrices(usdcOracleKey);
        }

        if (fTokenAddress == fDaiAddress) {
            return v1PriceOracle.assetPrices(daiOracleKey);
        }

        if (fTokenAddress == fSaiAddress) {
            // use the frozen SAI price if set, otherwise use the DAI price
            return saiPrice > 0 ? saiPrice : v1PriceOracle.assetPrices(daiOracleKey);
        }

        // otherwise just read from v1 oracle
        address underlying = FBep20(fTokenAddress).underlying();
        return v1PriceOracle.assetPrices(underlying);
    }

    /**
     * @notice Set the price of SAI, permanently
     * @param price The price for SAI
     */
    function setSaiPrice(uint price) public {
        require(msg.sender == guardian, "only guardian may set the SAI price");
        require(saiPrice == 0, "SAI price may only be set once");
        require(price < 0.1e18, "SAI price must be < 0.1 BNB");
        saiPrice = price;
    }
}
