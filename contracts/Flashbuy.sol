pragma solidity >=0.4.22 <0.9.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Interfaces.sol";

contract FeiFlashBuy is ICallee {
    IERC20 private DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 private FEI = IERC20(0x956F47F50A910163D8BF957Cf5846D573E7f87CA);
    IERC20 private USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    ISwapRouter private swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    ISoloMargin private soloMargin = ISoloMargin(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);
    PSM private psm = PSM(0x89B78CfA322F6C5dE0aBcEecab66Aee45393cC5A);
    address mscUsdcJoin = 0x0A59649758aa4d66E25f08Dd01271e891fe52199;

    constructor() public {
        DAI.approve(address(soloMargin), type(uint128).max);
    }
    
    // This is the function we call
    function daiDydxFlashBuy(uint loanAmount, address bondingCurve) external returns (uint256) {
        
        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: loanAmount // Amount to borrow
            }),
            primaryMarketId: 3, // DAI
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: ""
        });
        
        operations[1] = Actions.ActionArgs({
                actionType: Actions.ActionType.Call,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: 0
                }),
                primaryMarketId: 0,
                secondaryMarketId: 0,
                otherAddress: address(this),
                otherAccountId: 0,
                data: abi.encode(
                    // Replace or add any additional variables that you want
                    // to be available to the receiver function
                    msg.sender,
                    bondingCurve,
                    loanAmount
                )
            });
        
        operations[2] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: loanAmount + 2 // Repayment amount with 2 wei fee
            }),
            primaryMarketId: 3, // DAI
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: ""
        });

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = Account.Info({owner: address(this), number: 1});
        
        soloMargin.operate(accountInfos, operations);
        
        // Payout profits
        uint256 profits = DAI.balanceOf(address(this));
        DAI.transfer(msg.sender, profits);        
        
        return profits;
    }
    
    // Dydx callback
    function callFunction(address sender, Account.Info memory accountInfo, bytes memory data) external override {
        (
            address payable actualSender,
            address curveAddress,
            uint loanAmount
        ) = abi.decode(data, (
            address, address,uint
        ));
        
        IBondingCurve bondingCurve = IBondingCurve(curveAddress);
        
        DAI.approve(address(bondingCurve), type(uint128).max);
        uint256 bought = bondingCurve.purchase(address(this), DAI.balanceOf(address(this)));
        

        FEI.approve(address(swapRouter), type(uint128).max);
        uint256 aaas = swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: address(FEI),
            tokenOut: address(USDC),
            fee: 500,
            recipient: address(this),
            deadline: block.timestamp + 200,
            amountIn: bought,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0    
        }));


        USDC.approve(mscUsdcJoin, type(uint128).max);
        psm.sellGem(address(this), USDC.balanceOf(address(this)));

        uint256 bal = DAI.balanceOf(address(this));
        console.log("Balance %s", bal);
        require(bal >= loanAmount + 2, "CANNOT REPAY");

        DAI.transfer(actualSender, bal - loanAmount - 2);
    }

    // borrowIsToken1 tells wich token is the bonding curve token in the promary pool
    function uniV3FlashBuy(uint256 loanAmount, address bondingCurveAddress, address flashSwapPoolAddress, bool borrowIsToken1) external returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(flashSwapPoolAddress);
        address bondingCurveTokenAddress = borrowIsToken1 ? uniPool.token1() : uniPool.token0();
        address intermediaryTokenAddress = borrowIsToken1 ? uniPool.token0() : uniPool.token1();

        uniPool.swap( 
                    address(this),
                    borrowIsToken1,
                    // Negative for exact output
                    -int256(loanAmount),
                    // No slippage check
                    type(uint128).max,
                    abi.encode(bondingCurveAddress, bondingCurveTokenAddress, intermediaryTokenAddress)
        );

        // Payout profits
        IERC20 intermediaryToken = IERC20(intermediaryTokenAddress);
        uint256 profits = intermediaryToken.balanceOf(address(this));
        intermediaryToken.transfer(msg.sender, profits);

        return profits;
    }

    /// @notice Called to `msg.sender` after executing a swap via IUniswapV3Pool#swap.
    /// @dev In the implementation you must pay the pool tokens owed for the swap.
    /// The caller of this method must be checked to be a UniswapV3Pool deployed by the canonical UniswapV3Factory.
    /// amount0Delta and amount1Delta can both be 0 if no tokens were swapped.
    /// @param amount0Delta The amount of token0 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token0 to the pool.
    /// @param amount1Delta The amount of token1 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token1 to the pool.
    /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#swap call
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        
        (
            address bondingCurveAddress,
            address bondingCurveTokenAddress,
            address repayTokenAddress
        ) = abi.decode(data, (address, address, address));

        IERC20 bondingCurveToken = IERC20(bondingCurveTokenAddress);
        IERC20 repayToken = IERC20(repayTokenAddress);

        IBondingCurve bondingCurve = IBondingCurve(bondingCurveAddress);
        
        bondingCurveToken.approve(address(bondingCurve), type(uint128).max);
        uint256 bought = bondingCurve.purchase(address(this), amount0Delta < 0 ? uint256(-amount0Delta) : uint256(-amount1Delta));

        FEI.approve(address(swapRouter), type(uint128).max);
        swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: address(FEI),
            tokenOut: repayTokenAddress,
            fee: 500,
            recipient: address(this),
            deadline: block.timestamp + 200,
            amountIn: bought,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0    
        }));

        console.log("Swapped %s FEI for %s intermediary token", bought, repayToken.balanceOf(address(this)));
        
        uint256 repayAmount = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
        
        console.log("Amount to repay %s", repayAmount);
        
        // Repay the intermediary token to the pool
        // The positive token amount is the amount we have to repay 
        repayToken.transfer(msg.sender, repayAmount);
    }
}