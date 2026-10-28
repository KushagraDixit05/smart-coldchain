/**
 * serialBridge.js
 *
 * Reads JSON telemetry from the ESP32 over a USB serial connection,
 * stores each reading via the existing /api/readings pipeline, and
 * broadcasts the raw frame to every connected WebSocket client so the
 * dashboard can display live data without polling.
 *
 * Environment variables (add to backend/.env):
 *   SERIAL_PORT   – OS device path, e.g. /dev/tty.usbserial-0001   (required)
 *   SERIAL_BAUD   – baud rate matching the ESP32 sketch   (default 115200)
 *   ESP32_SHIPMENT_ID – shipmentId the readings are tagged with (default ESP32-DEVICE-01)
 *   ESP32_DEVICE_ID   – deviceId reported in readings       (default ESP32-001)
 */

require("dotenv").config();
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const pool = require("../db/pool");
const { checkThresholds } = require("./thresholds");
const blockchain = require("./blockchain");

// ─── config ──────────────────────────────────────────────────────────────────

const SERIAL_PORT_PATH = process.env.SERIAL_PORT || null;
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD) || 115200;
const SHIPMENT_ID = process.env.ESP32_SHIPMENT_ID || "ESP32-DEVICE-01";
const DEVICE_ID = process.env.ESP32_DEVICE_ID || "ESP32-001";

// Set of connected WebSocket clients (injected by server.js)
let _wsClients = new Set();

/** Called by server.js to hand the WS client registry to this module. */
function setWsClients(clients) {
  _wsClients = clients;
}

/** Broadcast a plain JS object to all connected WS clients. */
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of _wsClients) {
    try {
      if (client.readyState === 1 /* OPEN */) {
        client.send(msg);
      }
    } catch (_) {
      // ignore dead sockets
    }
  }
}

// ─── serial → database pipeline ──────────────────────────────────────────────

/**
 * Process one parsed JSON frame from the ESP32.
 * Expected shape:
 * {
 *   temp: 25.3,
 *   humidity: 60.1,
 *   vibration: 0 | 1,          // digital state from SW-420
 *   gpsFix: true | false,
 *   lat: 28.6139,
 *   lon: 77.2090,
 *   altitude: 216.5,
 *   satellites: 7,
 *   ts: 1700000000             // unix epoch seconds from millis()
 * }
 */
async function handleFrame(frame) {
  // Broadcast to dashboard regardless of DB result
  broadcast({ type: "sensor_data", data: frame, shipmentId: SHIPMENT_ID, deviceId: DEVICE_ID });

  // Fetch the shipment so we can check thresholds
  const { rows } = await pool.query("SELECT * FROM shipments WHERE shipment_id = $1", [SHIPMENT_ID]);
  const shipment = rows[0];
  if (!shipment) {
    console.warn(`[serialBridge] shipment "${SHIPMENT_ID}" not found – skipping DB write`);
    return;
  }

  const timestamp = frame.ts || Math.floor(Date.now() / 1000);
  const recordedAt = new Date(timestamp * 1000);

  // Use 0,0 when GPS has no fix (lat/lon are already 0 from ESP32)
  const lat = frame.gpsFix ? frame.lat : 0;
  const lon = frame.gpsFix ? frame.lon : 0;

  await pool.query(
    `INSERT INTO readings (shipment_id, device_id, temp, humidity, vibration, lat, lon, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [SHIPMENT_ID, DEVICE_ID, frame.temp, frame.humidity, frame.vibration, lat, lon, recordedAt]
  );

  if (shipment.status === "Delivered") return;

  const reading = {
    shipmentId: SHIPMENT_ID,
    deviceId: DEVICE_ID,
    temp: frame.temp,
    humidity: frame.humidity,
    vibration: frame.vibration,
    lat,
    lon,
    timestamp,
  };

  const breach = checkThresholds(reading, shipment);
  if (!breach) return;

  try {
    const { txHash, blockNumber } = await blockchain.recordBreach({
      shipmentId: SHIPMENT_ID,
      breachType: breach.breachType,
      measuredValue: breach.measuredValue,
      lat,
      lon,
      timestamp,
      deviceId: DEVICE_ID,
    });

    await pool.query(
      `INSERT INTO breach_events (shipment_id, breach_type, measured_value, lat, lon, device_id, recorded_at, tx_hash, block_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [SHIPMENT_ID, breach.breachType, breach.measuredValue, lat, lon, DEVICE_ID, recordedAt, txHash, blockNumber]
    );
    await pool.query("UPDATE shipments SET status = 'Breached' WHERE shipment_id = $1", [SHIPMENT_ID]);

    broadcast({ type: "breach", breachType: breach.breachType, measuredValue: breach.measuredValue, shipmentId: SHIPMENT_ID, txHash, blockNumber });
    console.log(`[serialBridge] BREACH recorded on-chain: ${breach.breachType} = ${breach.measuredValue}`);
  } catch (err) {
    console.error("[serialBridge] blockchain error:", err.message);
  }
}

// ─── serial port init ─────────────────────────────────────────────────────────

function start() {
  if (!SERIAL_PORT_PATH) {
    console.warn("[serialBridge] SERIAL_PORT not set – serial bridge disabled.");
    return;
  }

  console.log(`[serialBridge] Opening ${SERIAL_PORT_PATH} @ ${SERIAL_BAUD} baud …`);

  const port = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: SERIAL_BAUD });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  port.on("open", () => console.log(`[serialBridge] Connected to ESP32 on ${SERIAL_PORT_PATH}`));
  port.on("error", (err) => console.error("[serialBridge] port error:", err.message));
  port.on("close", () => console.warn("[serialBridge] Serial port closed."));

  parser.on("data", (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return; // skip non-JSON lines (boot messages, etc.)

    try {
      const frame = JSON.parse(trimmed);
      handleFrame(frame).catch((err) => console.error("[serialBridge] handleFrame error:", err.message));
    } catch (_) {
      // not valid JSON – ignore
    }
  });
}

module.exports = { start, setWsClients, broadcast };
