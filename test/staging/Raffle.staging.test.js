const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config.js");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, deployer, accounts;

          beforeEach(async function () {
              accounts = await ethers.getSigners();
              signer = accounts[0];
              deployer = (await getNamedAccounts()).deployer;
              const raffleDeployment = await deployments.get("Raffle");
              raffle = await ethers.getContractAt(
                  raffleDeployment.abi,
                  raffleDeployment.address,
                  signer,
              );
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  console.log("Setting up test...");
                  const startingTimeStamp = await raffle.getLatestTimeStamp();

                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      // set up listener before we enter the raffle
                      // just in case the blockchain moves really fast
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const winnerEndingBalance = await signer.provider.getBalance(
                                  accounts[0].address,
                              );

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(String(recentWinner), accounts[0].address);
                              assert.equal(String(raffleState), "0");
                              assert.equal(
                                  String(winnerEndingBalance),
                                  String(winnerStartingBalance + raffleEntranceFee), // only one player
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (e) {
                              console.error(e);
                              reject(e);
                          }
                      });

                      // then entering the raffle
                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                      await tx.wait(1);
                      console.log("Ok, time to wait...");
                      const winnerStartingBalance = await signer.provider.getBalance(
                          accounts[0].address,
                      );
                      // and this code won't complete until our listener has finished to listen
                  });
              });
          });
      });
