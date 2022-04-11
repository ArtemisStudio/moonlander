require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-waffle");
const { privateKey } = require('./secrets.json');

module.exports = {
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true
    },
    localfork: {
      chainId: 1337,
      url: "http://127.0.0.1:8545/",
      allowUnlimitedContractSize: true
    },
    moonbase: {
      url: 'https://rpc.api.moonbase.moonbeam.network',
      chainId: 1287, // 0x507 in hex,
      accounts: [privateKey]
    },
    moonbeam: {
      url: 'RPC-API-ENDPOINT-HERE', // Insert your RPC URL here
      chainId: 1284, // (hex: 0x504),
      accounts: [privateKey]
    }
  }
};