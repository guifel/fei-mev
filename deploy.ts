import { BigNumber, Contract, ContractFactory } from "ethers";
import "@nomiclabs/hardhat-waffle";
import hre, { ethers } from "hardhat";

async function main(): Promise<void> {
  const FeiFlashBuy: ContractFactory = await ethers.getContractFactory("FeiFlashBuy");
  const feiFlashBuy: Contract = await FeiFlashBuy.deploy({
    maxFeePerGas: BigNumber.from("51100000000"),
    maxPriorityFeePerGas: BigNumber.from("1100000000"),
    nonce: 0,
  });
  console.log(`Deployed at ${feiFlashBuy.address}`);
  console.log(feiFlashBuy.deployTransaction)
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
