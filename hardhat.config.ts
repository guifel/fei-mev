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
        blockNumber: 13293858,
      },
    },
  },
  mocha: {
    timeout: 60000,
  },
};
