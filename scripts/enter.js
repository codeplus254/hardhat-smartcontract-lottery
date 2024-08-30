const { ethers, deployments } = require("hardhat");

async function enterRaffle() {
    const accounts = await ethers.getSigners();
    const signer = accounts[0];
    const raffleDeployment = await deployments.get("Raffle");
    const raffle = await ethers.getContractAt(
        raffleDeployment.abi,
        raffleDeployment.address,
        signer,
    );
    const entranceFee = await raffle.getEntranceFee();
    await raffle.enterRaffle({ value: entranceFee });
    console.log("Entered!");
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
