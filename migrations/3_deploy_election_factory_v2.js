const ElectionFactoryV2 = artifacts.require("ElectionFactoryV2");

module.exports = function(deployer, network, accounts) {
  // Deploy the upgraded ElectionFactoryV2 contract
  deployer.deploy(ElectionFactoryV2, {
    from: accounts[0],
    gas: 6000000,
    gasPrice: 20000000000 // 20 gwei
  }).then(() => {
    console.log("ElectionFactoryV2 deployed successfully");
    console.log("Contract address:", ElectionFactoryV2.address);
    console.log("Deployed by:", accounts[0]);
  });
};
