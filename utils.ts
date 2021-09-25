import hre, { ethers } from "hardhat";

export async function takeSnapshot() {
  return await ethers.provider.send("evm_snapshot", []);
}

export async function restoreSnapshot(id: string) {
  await ethers.provider.send("evm_revert", [id]);
}
