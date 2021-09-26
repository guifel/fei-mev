import { Contract, ContractFactory } from "ethers";
import "@nomiclabs/hardhat-waffle";
import hre, { ethers } from "hardhat";

async function main(): Promise<void> {
  const FeiFlashBuy: ContractFactory = await ethers.getContractFactory("FeiFlashBuy");
  const feiFlashBuy: Contract = await FeiFlashBuy.deploy();
  console.log(`Deployed at ${feiFlashBuy.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
