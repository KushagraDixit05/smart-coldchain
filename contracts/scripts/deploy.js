const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ShipmentRegistry with admin:", deployer.address);

  const ShipmentRegistry = await hre.ethers.getContractFactory("ShipmentRegistry");
  const registry = await ShipmentRegistry.deploy(deployer.address);
  await registry.waitForDeployment();

  console.log("ShipmentRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
