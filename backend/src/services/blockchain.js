const path = require("path");
const { ethers } = require("ethers");

const artifact = require(path.join(
  __dirname,
  "../../../contracts/artifacts/contracts/ShipmentRegistry.sol/ShipmentRegistry.json"
));

const BREACH_TYPE = ["Temperature", "Humidity", "Vibration"];
const BREACH_TYPE_INDEX = { Temperature: 0, Humidity: 1, Vibration: 2 };
const SHIPMENT_STATUS = ["InTransit", "Breached", "Delivered"];

// Fixed-point scale factors matching the contract's units.
const TEMP_SCALE = 100; // e.g. 22.4C -> 2240
const HUMIDITY_SCALE = 100; // e.g. 55.1% -> 5510
const VIBRATION_SCALE = 100;
const GPS_SCALE = 1_000_000; // degrees -> micro-degrees

let provider;
let adminWallet; // used for createShipment / markDelivered
let deviceWallet; // used for recordBreach
let contract; // read-only / admin-connected instance
let deviceContract; // device-connected instance

function init() {
  if (contract) return;

  provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  if (process.env.ADMIN_PRIVATE_KEY) {
    adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  }
  if (process.env.DEVICE_PRIVATE_KEY) {
    deviceWallet = new ethers.Wallet(process.env.DEVICE_PRIVATE_KEY, provider);
  }

  const address = process.env.CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("CONTRACT_ADDRESS not set in environment");
  }

  contract = new ethers.Contract(address, artifact.abi, adminWallet || provider);
  deviceContract = new ethers.Contract(address, artifact.abi, deviceWallet || provider);
}

async function createShipment({
  shipmentId,
  product,
  origin,
  destination,
  tempMin,
  tempMax,
  humidityMin,
  humidityMax,
  vibrationMax,
}) {
  init();
  const tx = await contract.createShipment(
    shipmentId,
    product,
    origin,
    destination,
    Math.round(tempMin * TEMP_SCALE),
    Math.round(tempMax * TEMP_SCALE),
    Math.round(humidityMin * HUMIDITY_SCALE),
    Math.round(humidityMax * HUMIDITY_SCALE),
    Math.round(vibrationMax * VIBRATION_SCALE)
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

async function recordBreach({ shipmentId, breachType, measuredValue, lat, lon, timestamp, deviceId }) {
  init();
  const tx = await deviceContract.recordBreach(
    shipmentId,
    BREACH_TYPE_INDEX[breachType],
    Math.round(measuredValue * 100),
    Math.round(lat * GPS_SCALE),
    Math.round(lon * GPS_SCALE),
    timestamp,
    deviceId
  );
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function markDelivered(shipmentId) {
  init();
  const tx = await contract.markDelivered(shipmentId);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function getShipment(shipmentId) {
  init();
  const [product, origin, destination, thresholds, status] = await contract.getShipment(shipmentId);
  return {
    product,
    origin,
    destination,
    thresholds: {
      tempMin: Number(thresholds.tempMin) / TEMP_SCALE,
      tempMax: Number(thresholds.tempMax) / TEMP_SCALE,
      humidityMin: Number(thresholds.humidityMin) / HUMIDITY_SCALE,
      humidityMax: Number(thresholds.humidityMax) / HUMIDITY_SCALE,
      vibrationMax: Number(thresholds.vibrationMax) / VIBRATION_SCALE,
    },
    status: SHIPMENT_STATUS[Number(status)],
  };
}

async function getBreaches(shipmentId) {
  init();
  const breaches = await contract.getBreaches(shipmentId);
  return breaches.map((b) => ({
    breachType: BREACH_TYPE[Number(b.breachType)],
    measuredValue: Number(b.measuredValue) / 100,
    lat: Number(b.lat) / GPS_SCALE,
    lon: Number(b.lon) / GPS_SCALE,
    timestamp: Number(b.timestamp),
    deviceId: b.deviceId,
  }));
}

async function getNetworkInfo() {
  init();
  const [network, blockNumber] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
  return {
    name: network.name === "unknown" ? "localhost" : network.name,
    chainId: Number(network.chainId),
    latestBlock: blockNumber,
    contractAddress: process.env.CONTRACT_ADDRESS,
  };
}

module.exports = {
  createShipment,
  recordBreach,
  markDelivered,
  getNetworkInfo,
  getShipment,
  getBreaches,
  BREACH_TYPE,
};
