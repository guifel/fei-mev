pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// interface IERC20 {
//     function totalSupply() external view returns (uint256);
//     function balanceOf(address account) external view returns (uint256);
//     function transfer(address recipient, uint256 amount) external returns (bool);
//     function allowance(address owner, address spender) external view returns (uint256);
//     function approve(address spender, uint256 amount) external returns (bool);
//     function transferFrom(
//         address sender,
//         address recipient,
//         uint256 amount
//     ) external returns (bool);
// }

interface IBondingCurve {
    function purchase(address to, uint256 amountIn)
        external
        payable
        returns (uint256 amountOut);
    function allocate() external;
}

interface IUniswapV3Pool {
    function flash(
    address recipient,
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
  ) external;
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

       struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
  function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
}

interface PSM {
    function sellGem(address usr, uint256 gemAmt) external;
}

library Types {
    enum AssetDenomination { Wei, Par }
    enum AssetReference { Delta, Target }
    struct AssetAmount {
        bool sign;
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }
}

library Account {
    struct Info {
        address owner;
        uint256 number;
    }
}

library Actions {
    enum ActionType {
        Deposit, Withdraw, Transfer, Buy, Sell, Trade, Liquidate, Vaporize, Call
    }
    struct ActionArgs {
        ActionType actionType;
        uint256 accountId;
        Types.AssetAmount amount;
        uint256 primaryMarketId;
        uint256 secondaryMarketId;
        address otherAddress;
        uint256 otherAccountId;
        bytes data;
    }
}

interface ISoloMargin {
    function operate(Account.Info[] memory accounts, Actions.ActionArgs[] memory actions) external;
}

// The interface for a contract to be callable after receiving a flash loan
interface ICallee {
    function callFunction(address sender, Account.Info memory accountInfo, bytes memory data) external;
}


contract FlashbuyDyDx is ICallee {
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
    function flashLoan(uint loanAmount, address bondingCurve) external {
        
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
    }
    
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

        DAI.transfer(actualSender, DAI.balanceOf(address(this)) - loanAmount - 2);
        require(DAI.balanceOf(address(this)) >= loanAmount + 2, "CANNOT REPAY");
    }
}