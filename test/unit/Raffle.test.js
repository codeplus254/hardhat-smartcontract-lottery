const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config.js");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, VRFCoordinatorV2PlusMock, raffleEntranceFee, deployer, interval, accounts;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              accounts = await ethers.getSigners();
              signer = accounts[0];
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              const raffleDeployment = await deployments.get("Raffle");
              raffle = await ethers.getContractAt(
                  raffleDeployment.abi,
                  raffleDeployment.address,
                  signer,
              );
              // console.log(JSON.stringify(raffle));

              const VRFCoordinatorV2PlusMockDeployment =
                  await deployments.get("VRFCoordinatorV2_5Mock");
              VRFCoordinatorV2PlusMock = await ethers.getContractAt(
                  VRFCoordinatorV2PlusMockDeployment.abi,
                  VRFCoordinatorV2PlusMockDeployment.address,
                  signer,
              );
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
              raffleSubscriptionId = await raffle.getSubscriptionId();
              VRFCoordinatorV2PlusMock.addConsumer(raffleSubscriptionId, raffle.target);
              //   const VRF_SUB_FUND_AMOUNT = ethers.parseEther("2");
              //   await VRFCoordinatorV2PlusMock.fundSubscription(raffleSubscriptionId, VRF_SUB_FUND_AMOUNT);
          });

          describe("constructor", function () {
              it("Initializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState();
                  const interval = await raffle.getInterval();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered",
                  );
              });
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  );
              });
              it("does not allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  // We pretend to be a Chainlink keeper
                  //   await raffle.performUpkeep([]);
                  await raffle.performUpkeep("0x");
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
              });
          });

          describe("checkUpkeep", async function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert(upkeepNeeded);
              });
          });
          describe("performUpkeep", function () {
              it("it can only run if checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded",
                  );
              });
              it("updates the raffle state, emits an event and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.logs[1].args.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(Number(requestId) > 0);
                  assert(Number(raffleState) == 1);
              });
          });
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      VRFCoordinatorV2PlusMock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWithCustomError(VRFCoordinatorV2PlusMock, "InvalidRequest");
                  await expect(
                      VRFCoordinatorV2PlusMock.fulfillRandomWords(1, raffle.target),
                  ).to.be.revertedWithCustomError(VRFCoordinatorV2PlusMock, "InvalidRequest");
              });
              it("picks a winner, resets the lottery and sends money", async function () {
                  console.log("Entering raffle...");
                  const additionalEntrants = 5;
                  const startingAccountIndex = 1; // deployer / signer = 0
                  let winnerStartingBalance;
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp();

                  // performUpkeep (mock being Chainlink Keepers)
                  // fulfillRandomWords (mock being the Chainlink VRF)
                  // We will have to wait for the fulfillRandomWords to be called
                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              console.log(`recent winner: ${recentWinner}`);
                              console.log(`account 0: ${accounts[0].address}`);
                              console.log(`account 1: ${accounts[1].address}`);
                              console.log(`account 2: ${accounts[2].address}`);
                              console.log(`account 3: ${accounts[3].address}`);
                              console.log(`account 4: ${accounts[4].address}`);
                              console.log(`account 5: ${accounts[5].address}`);
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              const winnerEndingBalance = await signer.provider.getBalance(
                                  accounts[5].address,
                              );
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(String(recentWinner), accounts[5].address);
                              assert.equal(String(numPlayers), "0");
                              assert.equal(String(raffleState), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  String(winnerEndingBalance),
                                  String(
                                      winnerStartingBalance +
                                          (raffleEntranceFee * BigInt(additionalEntrants) +
                                              raffleEntranceFee),
                                  ),
                              );
                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });
                      // Setting up the listener
                      // We will fire the event below, and the listener will pick it up and resolve

                      try {
                          const tx = await raffle.performUpkeep("0x");

                          const txReceipt = await tx.wait(1);
                          const bal = await signer.provider.getBalance(
                              VRFCoordinatorV2PlusMock.target,
                          );
                          winnerStartingBalance = await signer.provider.getBalance(
                              accounts[5].address,
                          );
                          await VRFCoordinatorV2PlusMock.fulfillRandomWords(
                              txReceipt.logs[1].args.requestId,
                              raffle.target,
                          );
                      } catch (e) {
                          console.error(e);
                      }
                  });
              });
          });
      });
