const express = require("express");
const { z } = require("zod");
const pool = require("../db/pool");
const { checkThresholds } = require("../services/thresholds");
const blockchain = require("../services/blockchain");

const router = express.Router();

const readingSchema = z.object({
  deviceId: z.string().min(1),
  shipmentId: z.string().min(1),
  temp: z.number(),
  humidity: z.number(),
  vibration: z.number(),
  lat: z.number(),
  lon: z.number(),
  timestamp: z.number().int().positive(),
});

// POST /api/readings — submitted by a device (or the simulator standing in
// for one). Always cached off-chain; if it breaches the shipment's
// thresholds, also recorded on-chain via recordBreach.
router.post("/readings", async (req, res) => {
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
  }
  const reading = parsed.data;

  const { rows } = await pool.query("SELECT * FROM shipments WHERE shipment_id = $1", [
    reading.shipmentId,
  ]);
  const shipment = rows[0];
  if (!shipment) {
    return res.status(404).json({ error: "unknown shipmentId" });
  }

  const recordedAt = new Date(reading.timestamp * 1000);

  await pool.query(
    `INSERT INTO readings (shipment_id, device_id, temp, humidity, vibration, lat, lon, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      reading.shipmentId,
      reading.deviceId,
      reading.temp,
      reading.humidity,
      reading.vibration,
      reading.lat,
      reading.lon,
      recordedAt,
    ]
  );

  if (shipment.status === "Delivered") {
    return res.status(201).json({ stored: true, breach: false, note: "shipment already delivered" });
  }

  const breach = checkThresholds(reading, shipment);
  if (!breach) {
    return res.status(201).json({ stored: true, breach: false });
  }

  const { txHash, blockNumber } = await blockchain.recordBreach({
    shipmentId: reading.shipmentId,
    breachType: breach.breachType,
    measuredValue: breach.measuredValue,
    lat: reading.lat,
    lon: reading.lon,
    timestamp: reading.timestamp,
    deviceId: reading.deviceId,
  });

  await pool.query(
    `INSERT INTO breach_events (shipment_id, breach_type, measured_value, lat, lon, device_id, recorded_at, tx_hash, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      reading.shipmentId,
      breach.breachType,
      breach.measuredValue,
      reading.lat,
      reading.lon,
      reading.deviceId,
      recordedAt,
      txHash,
      blockNumber,
    ]
  );
  await pool.query("UPDATE shipments SET status = 'Breached' WHERE shipment_id = $1", [
    reading.shipmentId,
  ]);

  return res.status(201).json({ stored: true, breach: true, breachType: breach.breachType, txHash, blockNumber });
});

module.exports = router;
