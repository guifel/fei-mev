import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: process.env.ETH_RPC as string,
        blockNumber: 13301740,
      },
    },
    mainnet: {
      chainId: 1,
      url: process.env.ETH_RPC as string,
    },
  },
  mocha: {
    timeout: 600000,
  },
};

if (process.env.PRIV_KEY) {
  (config as any).networks.mainnet.accounts = [process.env.PRIV_KEY];
}

export default config;
