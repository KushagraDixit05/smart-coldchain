require("dotenv").config();

// Stands in for the Phase 5 ESP32 device: sends the exact same JSON payload
// shape a real device will send, so the backend needs no changes later.

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";
const SHIPMENT_ID = process.env.SHIPMENT_ID || "SHP-1001";
const DEVICE_ID = process.env.DEVICE_ID || "esp32-01";
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 3000);
const BREACH_CHANCE = Number(process.env.BREACH_CHANCE || 0.1);

// Starting point + a small per-tick drift to simulate a truck/container moving.
let lat = Number(process.env.START_LAT || 19.076);
let lon = Number(process.env.START_LON || 72.8777);

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function nextReading() {
  lat += randomInRange(-0.001, 0.001);
  lon += randomInRange(-0.001, 0.001);

  let temp = randomInRange(2, 6); // normal cold-chain range
  let humidity = randomInRange(35, 55);
  let vibration = randomInRange(0.05, 0.4);

  if (Math.random() < BREACH_CHANCE) {
    const axis = ["temp", "humidity", "vibration"][Math.floor(Math.random() * 3)];
    if (axis === "temp") temp = Math.random() < 0.5 ? randomInRange(-10, -6) : randomInRange(15, 25);
    if (axis === "humidity") humidity = Math.random() < 0.5 ? randomInRange(0, 10) : randomInRange(80, 95);
    if (axis === "vibration") vibration = randomInRange(6, 10);
  }

  return {
    deviceId: DEVICE_ID,
    shipmentId: SHIPMENT_ID,
    temp: Number(temp.toFixed(2)),
    humidity: Number(humidity.toFixed(2)),
    vibration: Number(vibration.toFixed(2)),
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

async function sendReading() {
  const reading = nextReading();
  try {
    const res = await fetch(`${BACKEND_URL}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reading),
    });
    const body = await res.json();
    const tag = body.breach ? `BREACH (${body.breachType})` : "ok";
    console.log(
      `[${new Date().toISOString()}] temp=${reading.temp} humidity=${reading.humidity} vibration=${reading.vibration} -> ${res.status} ${tag}`
    );
  } catch (err) {
    console.error("Failed to send reading:", err.message);
  }
}

console.log(`Simulating device ${DEVICE_ID} for shipment ${SHIPMENT_ID} -> ${BACKEND_URL}`);
setInterval(sendReading, INTERVAL_MS);
sendReading();
