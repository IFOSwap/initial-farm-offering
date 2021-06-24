require("@nomiclabs/hardhat-waffle");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

require("@nomiclabs/hardhat-truffle5");

module.exports = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      blockGasLimit: 9500000
    },
    development: {
      url: "http://127.0.0.1:7545",
      port: 7545,
      network_id: "101"
    },
    test: {
      url: "http://127.0.0.1:7545",
      port: 7545,
      network_id: "*"
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
