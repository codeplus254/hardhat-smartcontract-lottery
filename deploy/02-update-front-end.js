const { frontEndContractsFile, frontEndAbiFile } = require("../helper-hardhat-config");
const { deployments, ethers, network } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        const accounts = await ethers.getSigners();
        const signer = accounts[0];
        const raffleDeployment = await deployments.get("Raffle");
        const raffle = await ethers.getContractAt(
            raffleDeployment.abi,
            raffleDeployment.address,
            signer,
        );
        console.log("Writing to front end...");
        await updateContractAddresses(raffle);
        await updateAbi(raffle);
        console.log("Front end written!");
    }
}

async function updateAbi(raffle) {
    fs.writeFileSync(frontEndAbiFile, raffle.interface.formatJson());
    // fs.writeFileSync(frontEndAbiFile, raffle.interface.format(ethers.FormatTypes.json));
}

async function updateContractAddresses(raffle) {
    let contractAddresses;
    try {
        contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"));
    } catch(e) {
        // in case  frontEndContractsFile is empty, JSON parse raises an error
        // console.error(e);
        contractAddresses = {};
    }
    const chainId = network.config.chainId;
    if (network.config.chainId.toString() in contractAddresses) {
        if (!contractAddresses[chainId.toString()].includes(raffle.target)) {
            contractAddresses[chainId.toString()]=raffle.target;
        }
    } else {
        contractAddresses[chainId.toString()] = [raffle.target];
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses));
}

module.exports.tags = ["all", "frontend"];