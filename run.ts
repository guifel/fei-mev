import {
  DAI_BONDING_CURVE,
  UNI_V3_DAI_USDC_5,
  ERC20_FEI,
  ERC20_USDC,
  ERC20_DAI,
  DPI_BONDING_CURVE,
  ERC20_WETH,
  RAI_BONDING_CURVE,
  UNI_V3_DPI_ETH_30,
  UNI_V3_RAI_USDC_5,
} from "./constants";

import FeiFlashBuyAbi from "./artifacts/contracts/Flashbuy.sol/FeiFlashBuy.json";

import { BigNumber, ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

const FEI_FLASHBUY_CONTRACT = "0xC38Cc9C982A8bdcBBA961d7fac11DdbBD90638fF";

require("dotenv").config();

// const provider = new ethers.providers.StaticJsonRpcProvider(process.env.ETH_RPC);

if (!process.env.FB_PRIV_KEY || !process.env.PRIV_KEY) {
  throw Error("Missing config");
}

const provider = new ethers.providers.StaticJsonRpcProvider(process.env.ETH_RPC);
const fbSigner = new ethers.Wallet(process.env.FB_PRIV_KEY);
const wallet = new ethers.Wallet(process.env.PRIV_KEY, provider);

const main = async () => {
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, fbSigner);
  while (true) {
    await doWork(flashbotsProvider);
    await sleep(2000);
  }
};

const doWork = async (flashbotsProvider: FlashbotsBundleProvider) => {
  // @ts-ignore
  const feiFlashBuy = new ethers.Contract(FEI_FLASHBUY_CONTRACT, FeiFlashBuyAbi.abi, wallet);

  const calls = [
    // DAI 2m
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("2000000"),
      DAI_BONDING_CURVE,
      UNI_V3_DAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),

    // DAI 1m
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("1000000"),
      DAI_BONDING_CURVE,
      UNI_V3_DAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // DAI 500k
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("500000"),
      DAI_BONDING_CURVE,
      UNI_V3_DAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // DAI 150k
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("150000"),
      DAI_BONDING_CURVE,
      UNI_V3_DAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // RAI 333k
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("300000"),
      RAI_BONDING_CURVE,
      UNI_V3_RAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // RAI 166k
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("300000"),
      RAI_BONDING_CURVE,
      UNI_V3_RAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // RAI 50k
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("50000"),
      RAI_BONDING_CURVE,
      UNI_V3_RAI_USDC_5,
      false,
      ethers.utils.solidityPack(["address", "uint24", "address"], [ERC20_FEI, 500, ERC20_USDC])
    ),
    // DPI 1m
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("3076"),
      DPI_BONDING_CURVE,
      UNI_V3_DPI_ETH_30,
      false,
      ethers.utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [ERC20_FEI, 500, ERC20_USDC, 500, ERC20_WETH]
      )
    ),
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("1538"),
      DPI_BONDING_CURVE,
      UNI_V3_DPI_ETH_30,
      false,
      ethers.utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [ERC20_FEI, 500, ERC20_USDC, 500, ERC20_WETH]
      )
    ),
    await feiFlashBuy.populateTransaction.uniV3FlashBuy(
      ethers.utils.parseEther("461"),
      DPI_BONDING_CURVE,
      UNI_V3_DPI_ETH_30,
      false,
      ethers.utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [ERC20_FEI, 500, ERC20_USDC, 500, ERC20_WETH]
      )
    ),
  ];

  let maxProfit = BigNumber.from("0");
  let bestCallIndex: number = -1;
  for (let i = 0; i < calls.length; i++) {
    let resp: string;
    try {
      resp = await provider.call(calls[i]);

      if (resp.startsWith("0x08c379a0")) {
        continue;
      }
    } catch (err) {
      continue;
    }

    let profit = BigNumber.from(resp);

    console.log(`Arb: ${profit.toString()} index ${i}`);

    if (i > 5) {
      // Because it's ETH profits
      profit = profit.mul("3100");
    }

    if (profit.gt(maxProfit)) {
      maxProfit = profit;
      bestCallIndex = i;
    }
  }

  if (maxProfit.eq("0")) {
    return;
  }
  const currentBlock = await provider.getBlockNumber();

  console.log(`[${currentBlock}] Max profit ${maxProfit.toString()} from call index ${bestCallIndex}`);

  if (bestCallIndex <= 6 && maxProfit.lt("200000000")) {
    console.log("Profit USD too small");
    return;
  } else if (bestCallIndex > 5 && maxProfit.lt(ethers.utils.parseEther("200"))) {
    console.log("Profit ETH too small");
    return;
  }

  // Do transaction!
  console.log(`Send transaction...`);

  const transaction = calls[bestCallIndex];

  const baseFee = (await provider.getBlock("latest")).baseFeePerGas as BigNumber;

  transaction.gasPrice = baseFee.mul(13).div(10);
  transaction.gasLimit = BigNumber.from("900000");

  const bundle = await flashbotsProvider.signBundle([
    {
      signer: wallet,
      transaction: transaction,
    },
  ]);

  const bundleReceipts = await Promise.all([
    await flashbotsProvider.sendRawBundle(bundle, currentBlock + 1),
    await flashbotsProvider.sendRawBundle(bundle, currentBlock + 2),
    await flashbotsProvider.sendRawBundle(bundle, currentBlock + 3),
  ]);

  console.log("Sent");
  console.log(bundleReceipts[0]);
  console.log(await (bundleReceipts[0] as any).simulate());
  console.log(await (bundleReceipts[0] as any).receipts());
};

function sleep(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
main();
