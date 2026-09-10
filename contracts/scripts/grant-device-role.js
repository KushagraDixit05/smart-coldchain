const hre = require("hardhat");

// Usage: CONTRACT_ADDRESS=0x... DEVICE_ADDRESS=0x... npx hardhat run scripts/grant-device-role.js --network <net>
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const deviceAddress = process.env.DEVICE_ADDRESS;
  const [admin] = await hre.ethers.getSigners();

  const registry = await hre.ethers.getContractAt("ShipmentRegistry", contractAddress, admin);
  const DEVICE_ROLE = await registry.DEVICE_ROLE();
  const tx = await registry.grantRole(DEVICE_ROLE, deviceAddress);
  await tx.wait();
  console.log(`Granted DEVICE_ROLE to ${deviceAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
