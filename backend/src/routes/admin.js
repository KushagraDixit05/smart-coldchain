const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../db/pool");
const { requireAdmin } = require("../middleware/auth");
const blockchain = require("../services/blockchain");

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload" });
  }
  const { email, password } = parsed.data;

  const { rows } = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = jwt.sign(
    { adminId: admin.id, email: admin.email, company: admin.company },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.json({ token });
});

const createShipmentSchema = z.object({
  shipmentId: z.string().min(1),
  product: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  tempMin: z.number(),
  tempMax: z.number(),
  humidityMin: z.number(),
  humidityMax: z.number(),
  vibrationMax: z.number(),
});

router.post("/shipments", requireAdmin, async (req, res) => {
  const parsed = createShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
  }
  const s = parsed.data;

  const { rows: existing } = await pool.query("SELECT 1 FROM shipments WHERE shipment_id = $1", [
    s.shipmentId,
  ]);
  if (existing.length > 0) {
    return res.status(409).json({ error: "shipment already exists" });
  }

  const txHash = await blockchain.createShipment(s);

  await pool.query(
    `INSERT INTO shipments
       (shipment_id, product, origin, destination, temp_min, temp_max, humidity_min, humidity_max, vibration_max, tx_hash_created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      s.shipmentId,
      s.product,
      s.origin,
      s.destination,
      s.tempMin,
      s.tempMax,
      s.humidityMin,
      s.humidityMax,
      s.vibrationMax,
      txHash,
    ]
  );

  res.status(201).json({ shipmentId: s.shipmentId, txHash });
});

router.get("/shipments", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, r.temp AS latest_temp, r.humidity AS latest_humidity, r.vibration AS latest_vibration,
            r.recorded_at AS latest_reading_at
     FROM shipments s
     LEFT JOIN LATERAL (
       SELECT temp, humidity, vibration, recorded_at
       FROM readings
       WHERE readings.shipment_id = s.shipment_id
       ORDER BY recorded_at DESC
       LIMIT 1
     ) r ON true
     ORDER BY s.created_at DESC`
  );
  res.json(rows);
});

router.get("/shipments/:id/history", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM readings WHERE shipment_id = $1 ORDER BY recorded_at ASC",
    [req.params.id]
  );
  res.json(rows);
});

router.get("/shipments/:id/breaches", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM breach_events WHERE shipment_id = $1 ORDER BY recorded_at ASC",
    [req.params.id]
  );
  res.json(rows);
});

router.post("/shipments/:id/deliver", requireAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT 1 FROM shipments WHERE shipment_id = $1", [
    req.params.id,
  ]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "unknown shipment" });
  }

  const txHash = await blockchain.markDelivered(req.params.id);
  await pool.query("UPDATE shipments SET status = 'Delivered', delivered_at = now() WHERE shipment_id = $1", [
    req.params.id,
  ]);
  res.json({ shipmentId: req.params.id, txHash });
});

// GET /admin/breaches — recent breach events across all shipments, for the
// dashboard's "recent alerts" and the blockchain ledger page.
router.get("/breaches", requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await pool.query(
    `SELECT b.*, s.product
     FROM breach_events b
     JOIN shipments s ON s.shipment_id = b.shipment_id
     ORDER BY b.recorded_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

// GET /admin/chain-status — live network info plus app-derived activity
// metrics (not claiming to be full network-wide stats, just this app's).
router.get("/chain-status", requireAdmin, async (req, res) => {
  const [network, txCounts, onlineDevices] = await Promise.all([
    blockchain.getNetworkInfo(),
    pool.query(
      `SELECT
         (SELECT count(*) FROM shipments WHERE tx_hash_created IS NOT NULL) +
         (SELECT count(*) FROM breach_events) AS total`
    ),
    pool.query(
      `SELECT count(DISTINCT device_id) FROM readings WHERE recorded_at > now() - interval '5 minutes'`
    ),
  ]);

  res.json({
    ...network,
    contractTransactions: Number(txCounts.rows[0].total),
    devicesOnline: Number(onlineDevices.rows[0].count),
  });
});

module.exports = router;
