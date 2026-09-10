# Architecture

## Overview

```
 [Sensor Node]                [Backend API]              [PostgreSQL]
 ESP32 + DHT22/BME280   HTTP    Node.js/Express            off-chain
 + MPU6050 + NEO-6M    ----->   - validate reading   <---> cache:
 (Phase 5)                      - check thresholds          - readings
                                 - if breach: call            (full history)
 [Device Simulator]             contract.recordBreach()    - shipments
 Node script, same       |      - if normal: store          - breach events
 JSON payload shape      |        reading in DB             (mirror of chain)
 (Phases 1-4)            v
                         [Smart Contract]  ---deployed to--->  Sepolia
                         Solidity, roles:                      testnet
                         ADMIN_ROLE, DEVICE_ROLE
                                 ^
                                 | read (ethers.js)
                                 |
                         [Backend API] ---REST---> [Admin Dashboard]
                                                     React + Leaflet
                                                     - shipment list
                                                     - sensor charts
                                                     - breach map
                                                     - JWT admin login
```

## Why only breach events go on-chain

Writing every sensor reading to Sepolia would be slow and cost gas per
reading. Instead:
- Every reading is stored off-chain in Postgres (fast, free, full history —
  used for the dashboard's time-series charts).
- Only meaningful events are written to the smart contract: shipment
  creation, a threshold breach (temp/humidity/vibration out of range, with
  GPS + timestamp), and shipment delivery. These are the events that need
  tamper-evidence/immutability for the supply-chain audit trail.
- Postgres is a **cache**, not the source of truth. Breach history shown on
  the dashboard must be reconstructable from the chain alone (Postgres just
  makes querying it fast and adds the full non-breach telemetry for
  context/charts).

## Smart contract (Solidity)

`ShipmentRegistry.sol`:
- `createShipment(id, product, origin, destination, tempMin, tempMax, humidityMin, humidityMax, vibrationMax)` — `ADMIN_ROLE` only.
- `recordBreach(shipmentId, breachType, measuredValue, lat, lon, timestamp, deviceId)` — `DEVICE_ROLE` only. Emits `BreachRecorded`.
- `markDelivered(shipmentId)` — `ADMIN_ROLE` only.
- `getShipment(id)`, `getBreaches(id)` — public view functions.
- Roles managed via OpenZeppelin `AccessControl`.

## Backend API (Node.js/Express)

Endpoints:
- `POST /api/readings` — device/simulator submits a reading `{deviceId, shipmentId, temp, humidity, vibration, lat, lon, timestamp}`. Backend checks against the shipment's thresholds (fetched from chain/cache). Always stores in Postgres; if out of range, also calls `recordBreach` on-chain.
- `POST /admin/login` — returns JWT.
- `POST /admin/shipments` — admin creates a shipment (calls `createShipment` on-chain).
- `GET /admin/shipments` — list, with status derived from chain/cache.
- `GET /admin/shipments/:id/history` — full reading history from Postgres (for charts).
- `GET /admin/shipments/:id/breaches` — breach events, read from chain (or cache, cross-checked against chain).

## Data model (PostgreSQL)

- `admins(id, email, password_hash, company)`
- `shipments(id, product, origin, destination, thresholds..., status, tx_hash_created)`
- `readings(id, shipment_id, device_id, temp, humidity, vibration, lat, lon, recorded_at)`
- `breach_events(id, shipment_id, breach_type, measured_value, lat, lon, recorded_at, tx_hash)`

## Device payload shape (shared by simulator and real hardware)

```json
{
  "deviceId": "esp32-01",
  "shipmentId": "SHP-1001",
  "temp": 22.4,
  "humidity": 55.1,
  "vibration": 0.12,
  "lat": 28.6139,
  "lon": 77.2090,
  "timestamp": 1757500000
}
```
This exact shape is what Phase 2's simulator sends and what Phase 5's ESP32
firmware will send — no backend changes needed when hardware is swapped in.

## Environment notes

- This machine runs Node 18.19.1. Hardhat 3.x requires Node 22+, so
  `contracts/` is pinned to **Hardhat 2.x** (`@nomicfoundation/hardhat-toolbox@^5`),
  which fully supports Node 18. Revisit this pin if the dev machine's Node
  version is upgraded later.
- Solidity compiled with `viaIR: true` (the contract's `getShipment`/
  `createShipment` functions hit the default compiler's "stack too deep"
  limit without it).
- Local dev Postgres runs in a **project-local Docker container**
  (`docker-compose.yml` at repo root, port 5433, named volume), not the
  system-wide `postgresql.service` on port 5432 — that instance had no
  usable role for this user and creating one requires interactive sudo.
  This keeps the project fully self-contained: `docker compose up -d`
  brings up the DB, nothing else on the machine is touched. Sepolia
  deployment (Phase 4) is unaffected by this — it doesn't use Postgres.
- Local end-to-end dev loop: `npx hardhat node` (contracts/) for a local
  chain, deploy + grant `DEVICE_ROLE` to a second test account
  (`scripts/grant-device-role.js`), point `backend/.env` at it
  (`RPC_URL=http://127.0.0.1:8545`), `npm run migrate` + `npm run create-admin`,
  start the backend, then run `simulator/` against it. Restarting the local
  Hardhat node wipes on-chain state (a fresh chain each time) while the
  Postgres cache persists — if you restart the node, clear the
  `shipments`/`readings`/`breach_events` tables (they're just a cache) and
  recreate shipments through the API so cache and chain stay consistent.
- Dashboard: `npm create vite@5.5.0` (not the latest `create-vite`, which
  requires Node 22+ and fails on this machine's Node 18). `react-leaflet@4`
  pinned for the same reason its v5 requires React 19.

## Sepolia deployment (Phase 4)

- Contract address: `0x0160697212eE63deBF678041768Ef9D7719d6286`
  (`sepolia.etherscan.io/address/0x0160697212eE63deBF678041768Ef9D7719d6286`)
- Two dedicated testnet-only wallets (never used elsewhere): admin/deployer
  and device, generated locally with `ethers.Wallet.createRandom()` — see
  `contracts/.sepolia-wallets.txt` (gitignored, testnet keys only, no real
  value).
- RPC: Alchemy Sepolia endpoint (user's account).
- To redeploy/reset on Sepolia: re-run `scripts/deploy.js --network sepolia`,
  re-grant `DEVICE_ROLE` via `scripts/grant-device-role.js --network sepolia`
  with the new address, and update `CONTRACT_ADDRESS` in `backend/.env`. As
  with local dev, clear the Postgres cache tables first so they don't point
  at a stale contract.

## Status

Living document — update as phases complete or decisions change.
