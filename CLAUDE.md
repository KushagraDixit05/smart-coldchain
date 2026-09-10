# bkt — Blockchain-based IoT Supply Chain Monitor

## Purpose

Track products moving through a supply chain and record on a blockchain when
a shipment is damaged in transit — due to temperature excursion (too hot/too
cold), excessive vibration/shock, or abnormal humidity — along with the GPS
location where the damage occurred. Company admins use a dashboard to see
shipment status and, for any breached shipment, exactly where in the supply
line it broke.

Sensor hardware (ESP32 + sensors) is integrated in a later phase. Early
phases use a software simulator that sends the same payload shape a real
device will send, so no code changes are needed when hardware is swapped in.

## Requirements

- Detect four conditions per shipment: temperature out of range, humidity out
  of range, excessive vibration/shock, and GPS location at time of breach.
- Immutably record breach events on a blockchain (shipment id, breach type,
  measured value, GPS coordinates, timestamp, device id).
- Admin dashboard: list shipments, see status (in-transit / breached /
  delivered), view sensor history charts, view breach location on a map,
  view the on-chain transaction for each breach event.
- Company admins are the only actors who can create shipments / see the
  admin dashboard. Devices are the only actors who can submit readings.

## Architecture (source of truth: docs/ARCHITECTURE.md)

- **Smart contract**: Solidity, deployed to Ethereum Sepolia testnet.
  Developed and tested locally against a Hardhat local chain first, then
  deployed to Sepolia. Role-based access: `ADMIN_ROLE` (create shipments,
  mark delivered), `DEVICE_ROLE` (record breach events).
- **Backend**: Node.js + Express + ethers.js. Off-chain PostgreSQL cache
  stores full sensor reading history (for charts) and mirrors on-chain
  breach events (for fast queries). Only breach events + shipment lifecycle
  milestones go on-chain — routine telemetry does not (gas cost).
- **Admin dashboard**: React + Leaflet (map).
- **Device simulator**: Node script standing in for the ESP32 device until
  Phase 5, posting the same JSON shape a real device will send.
- **Hardware (Phase 5)**: ESP32 + DHT22/BME280 (temp/humidity) + MPU6050
  (vibration) + NEO-6M (GPS), over WiFi via HTTPS POST to the backend.

## Implementation Plan (source of truth: docs/IMPLEMENTATION_PLAN.md)

Phased: contract → backend+simulator → dashboard → testnet deployment →
hardware → hardening. See docs/IMPLEMENTATION_PLAN.md for details and
current status. Do not skip ahead to a later phase without checking in.

## Development Rules (project-specific, in addition to workspace CLAUDE.md)

- Never commit `.env` files, private keys, or RPC/API keys. Use `.env` +
  `.env.example` with placeholders only.
- The Solidity contract is the source of truth for breach events. The
  Postgres DB is a cache/read-optimization layer only — it must always be
  re-derivable from on-chain data (don't design features that require data
  which only lives in Postgres).
- Testnet deployment (Sepolia) and any transaction that spends real/testnet
  funds requires explicit confirmation before running.
