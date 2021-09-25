import hre, { ethers } from "hardhat";
import { expect } from "chai";

import { Contract } from "ethers";
import {
  DAI_BONDING_CURVE,
  ERC20_DAI,
  ERC20_USDC,
  FEI_DAO_ADDRESS,
  PROPOSAL_NUMBER,
  RAI_BONDING_CURVE,
  UNI_V3_DAI_USDC_5,
  UNI_V3_RAI_USDC_5,
} from "./run";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { restoreSnapshot, takeSnapshot } from "./utils";

describe("FeiFlashBuy", function () {
  let snapshotId: string;
  let feiFlashBuy: Contract;
  let feiDao: Contract;
  let dai: Contract;
  let usdc: Contract;
  // let dai: Contract;
  let signer: SignerWithAddress;
  before(async () => {
    [signer] = await ethers.getSigners();
    feiDao = await ethers.getContractAt("IGovernorAlpha", FEI_DAO_ADDRESS, signer);
    dai = await ethers.getContractAt("IERC20", ERC20_DAI);
    usdc = await ethers.getContractAt("IERC20", ERC20_USDC);
    const FeiFlashBuy = await ethers.getContractFactory("FeiFlashBuy");
    feiFlashBuy = await FeiFlashBuy.deploy();
    const proposal = await feiDao.proposals(PROPOSAL_NUMBER);
    const voteEndBlock: number = proposal[4].toNumber();
    const currentBlock = await ethers.provider.getBlockNumber();

    for (let i = 0; i < voteEndBlock - currentBlock; i++) {
      await hre.network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }

    expect(await ethers.provider.getBlockNumber()).equal(voteEndBlock);

    await feiDao.queue(PROPOSAL_NUMBER);
    console.log("Proposal queued");

    // Wait a day for the timelock
    await hre.network.provider.request({
      method: "evm_mine",
      params: [(await ethers.provider.getBlock("latest")).timestamp + 3600 * 24],
    });

    await feiDao.execute(PROPOSAL_NUMBER);
    console.log("Proposal executed");

    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snapshotId);
    snapshotId = await takeSnapshot();
  });

  it("Run DAI dydx", async function () {
    
    // Get some DAI to the contract for it to pass while testing
    const daiWhale = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [daiWhale],
    });

    await dai.connect(await ethers.getSigner(daiWhale)).transfer(feiFlashBuy.address, ethers.utils.parseEther("10000"));
    
    // Do the thing
    await feiFlashBuy.daiDydxFlashBuy(ethers.utils.parseEther("1000000"), DAI_BONDING_CURVE);


    console.log("Profits: ", (await dai.balanceOf(signer.address)).toString());
  });

  it("Run DAI", async function () {
    // Get some USDC to the contract for it to pass while testing
    const usdcWhale = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhale],
    });
    await usdc.connect(await ethers.getSigner(usdcWhale)).transfer(feiFlashBuy.address, "10000000000");

    // Do the thing
    await feiFlashBuy.uniV3FlashBuy(
      ethers.utils.parseEther("100000"),
      DAI_BONDING_CURVE,
      UNI_V3_DAI_USDC_5,
      false
    );

    console.log("Profits: ", (await usdc.balanceOf(signer.address)).toString());
  });

  it("Run RAI", async function () {
    // Get some USDC to the contract for it to pass while testing
    const usdcWhale = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhale],
    });
    await usdc.connect(await ethers.getSigner(usdcWhale)).transfer(feiFlashBuy.address, "2000000000");

    // Do the thing
    await feiFlashBuy.uniV3FlashBuy(
      ethers.utils.parseEther("100000"),
      RAI_BONDING_CURVE,
      UNI_V3_RAI_USDC_5,
      false
    );

    console.log("Profits: ", (await usdc.balanceOf(signer.address)).toString());
  });

  it("Run DPI", async function () {
    // Get some USDC to the contract for it to pass while testing
    const usdcWhale = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhale],
    });
    await usdc.connect(await ethers.getSigner(usdcWhale)).transfer(feiFlashBuy.address, "2000000000");

    // Do the thing
    await feiFlashBuy.uniV3FlashBuy(
      ethers.utils.parseEther("100000"),
      DPI_BONDING_CURVE,
      UNI_V3_RAI_USDC_5,
      false
    );

    console.log("Profits: ", (await usdc.balanceOf(signer.address)).toString());
  });
});
