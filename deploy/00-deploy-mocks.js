const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config.js");

const BASE_fEE = ethers.parseEther("0.1");
const GAS_PRICE_LINK = 1e9;
const WEI_PER_UNIT_LINK = 4491923522281474;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_fEE, GAS_PRICE_LINK, WEI_PER_UNIT_LINK];

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        await deploy("VRFCoordinatorV2_5Mock", {
            from: deployer,
            log: true,
            args: args,
        });
        log("Mocks deployed!");
        log("__________________________________________________");
    }
};

module.exports.tags = ["all", "mocks"];
