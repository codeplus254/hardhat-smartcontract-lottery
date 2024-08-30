const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config.js");
const { verify } = require("../utils/verify.js");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("50");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2PlusAddress, subscriptionId, VRFCoordinatorV2PlusMock;

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2PlusMockDeployment = await deployments.get("VRFCoordinatorV2_5Mock");
        VRFCoordinatorV2PlusMock = await ethers.getContractAt(
            VRFCoordinatorV2PlusMockDeployment.abi,
            VRFCoordinatorV2PlusMockDeployment.address,
            signer,
        );
        vrfCoordinatorV2PlusAddress = VRFCoordinatorV2PlusMock.target;
        const transactionResponse = await VRFCoordinatorV2PlusMock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.logs[0].args.subId;

        // Fund the subscription
        // Usually, you'd need the link token on a real network
        await VRFCoordinatorV2PlusMock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2PlusAddress = networkConfig[chainId]["vrfCoordinatorV2Plus"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [
        vrfCoordinatorV2PlusAddress,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    if (developmentChains.includes(network.name)) {
        VRFCoordinatorV2PlusMock.addConsumer(subscriptionId, raffle.address);
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verify...");
        await verify(raffle.address, args);
    }
    log("_______________________________________________");
};

module.exports.tags = ["all", "raffle"];
