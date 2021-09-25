import "@nomiclabs/hardhat-waffle";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: process.env.ETH_RPC,
        blockNumber: 13294590,
      },
    },
  },
  mocha: {
    timeout: 600000,
  },
};
