# Implementation Plan

Status legend: [ ] not started · [~] in progress · [x] done

## Phase 0 — Project Scaffolding & Docs
- [x] CLAUDE.md, docs/ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md
- [x] git init, .gitignore, README.md
- [x] Repo layout: `contracts/` created now; `backend/`, `dashboard/`, `simulator/`, `firmware/` created in their respective phases

## Phase 1 — Smart Contract [x] done
- [x] Hardhat project in `contracts/` (Hardhat 2.x — this machine runs Node 18; Hardhat 3 requires Node 22+)
- [x] `ShipmentRegistry.sol` (create shipment, record breach, mark delivered, role-based access via OpenZeppelin AccessControl)
- [x] Unit tests (Hardhat/Chai): access control, threshold edge cases, event emission — 11/11 passing
- [x] Deploy script for local Hardhat network (`scripts/deploy.js`)
- [x] Manual smoke test against local node — deployed successfully
- **Exit criteria**: contract deployed locally, all tests passing, admin can create a shipment and a device-role account can record a breach. ✅ met.

## Phase 2 — Backend API + Device Simulator [x] done
- [x] Postgres schema + migrations (`admins`, `shipments`, `readings`, `breach_events`) — running via project-local Docker container (`docker-compose.yml`, port 5433), since the system-wide Postgres had no usable role and no passwordless sudo to create one
- [x] Express API: `/api/readings`, `/admin/login`, `/admin/shipments` (POST/GET), `/admin/shipments/:id/history`, `/admin/shipments/:id/breaches`, `/admin/shipments/:id/deliver`
- [x] Threshold check logic + ethers.js integration (calls contract on local Hardhat node)
- [x] JWT auth middleware for `/admin/*`
- [x] Device simulator script (`simulator/`) generating normal + occasional breach readings, posting to `/api/readings` — same JSON payload shape Phase 5 firmware will send
- [x] Integration test: simulator run -> breach appears on-chain and in Postgres
- **Exit criteria**: running the simulator against the local backend produces correct DB rows and on-chain breach events end-to-end. ✅ met — 15 readings stored, 5 breaches (Temperature/Humidity/Vibration all exercised) recorded identically on-chain and in the DB cache, shipment status flipped to Breached.

## Phase 3 — Admin Dashboard [x] done
- [x] React app scaffold (Vite — pinned `create-vite@5.5.0`/Vite 5, since the latest Vite CLI requires Node 22+), JWT login flow
- [x] Shipment list view (status badges) + "New Shipment" form (writes on-chain via backend)
- [x] Shipment detail: sensor history charts (temp/humidity/vibration over time, Recharts, with threshold reference lines)
- [x] Breach map (Leaflet, `react-leaflet@4` — v5 requires React 19) showing GPS pin(s) where breaches occurred, color-coded by breach type
- [x] Breach events table with tx hash; linked to a block explorer when `VITE_EXPLORER_BASE_URL` is set (Phase 4, Sepolia), shown as plain text locally
- [x] "Mark Delivered" action
- **Exit criteria**: admin can log in, see all shipments, drill into one, and see breach location(s) on a map. ✅ met — verified in an actual browser (Claude in Chrome): login, shipment list, shipment detail with populated charts/map/breach table, creating a new shipment (writes on-chain + redirects to its detail page), and marking a shipment delivered all worked end-to-end with zero console errors.

## Phase 4 — Sepolia Testnet Deployment [x] done
- [x] Generated two fresh testnet-only wallets locally (admin/deployer + device) — never used elsewhere, saved to `contracts/.sepolia-wallets.txt` (gitignored)
- [x] User funded the admin wallet via a Sepolia faucet (0.05 ETH) and provided an Alchemy Sepolia RPC URL
- [x] Transferred 0.01 ETH admin -> device wallet (so the device wallet can pay its own gas)
- [x] Deployed `ShipmentRegistry` to Sepolia: `0x0160697212eE63deBF678041768Ef9D7719d6286`
- [x] Granted `DEVICE_ROLE` to the device wallet on the deployed contract
- [x] Pointed `backend/.env` and `dashboard/.env` (`VITE_EXPLORER_BASE_URL`) at Sepolia
- [x] Re-ran Phase 2/3 end-to-end tests against testnet: created a shipment, ran the simulator, 6 breach events recorded on-chain
- **Exit criteria**: full flow (simulator -> backend -> Sepolia -> dashboard) works against the real testnet, breach tx visible on Etherscan. ✅ met — verified one tx's receipt directly via RPC (status success, block 11673358), and confirmed in the dashboard (browser-tested) that all 6 breach tx links correctly resolve to `sepolia.etherscan.io/tx/<hash>`.
- Remaining testnet balances after this phase: admin ~0.038 ETH, device ~0.009 ETH — plenty for further testing.

## Phase 5 — Hardware Integration
- [ ] ESP32 firmware (`firmware/`, Arduino/PlatformIO): read DHT22/BME280, MPU6050, NEO-6M GPS
- [ ] Firmware posts the same JSON payload shape as the simulator to `/api/readings` over WiFi
- [ ] Bench test: verify real sensor readings flow through to dashboard and breaches trigger correctly (e.g. physically shake the board to trigger vibration breach)
- [ ] Retire/replace the simulator for live demos (keep it for dev/testing)
- **Exit criteria**: physical device readings appear on the dashboard and a manually-triggered breach (e.g. heat gun, shake, cold spray) shows up correctly with GPS location.

## Phase 6 — Hardening / Stretch (optional, revisit after Phase 5)
- [ ] Email/SMS alerts on breach
- [ ] Multi-company support (admins scoped to their own company's shipments)
- [ ] Historical analytics (breach frequency by route/carrier)
- [ ] Production hosting for backend + dashboard

## Dashboard Redesign (post-Phase 4, pre-Phase 5)
- [x] Rebranded to "TraceLedger" — dark navy sidebar shell (Dashboard/Shipments/Monitoring/Blockchain nav), color system (primary blue, success/warning/breach semantic colors), Inter typeface.
- [x] New Dashboard home page: greeting, shipment stat cards (total/healthy/breached), live sensor monitor card (most-recently-updated shipment's latest reading), recent alerts feed.
- [x] Shipments list: stat summary line + "Condition" column (latest temperature reading, color-coded).
- [x] Shipment detail: journey timeline (origin → in transit → destination, with real timestamps incl. new `delivered_at`), sensor status cards (value + threshold delta), restyled charts, a "Blockchain Record" card surfacing the latest on-chain event (tx hash/block/event/timestamp).
- [x] New Monitoring page: active-shipment cards + a live alert feed, polling every 6s; "N devices online" derived from devices with a reading in the last 5 minutes (real query, not fabricated).
- [x] New Blockchain ledger page: live network/chain-id/latest-block (read via `provider.getNetwork()`/`getBlockNumber()`), a contract-transactions count (derived from DB: shipment-creation + breach txs), a global events table with a click-through detail panel.
- [x] Split-screen login page redesign.
- Backend additions to support real (non-fabricated) data for the above: `delivered_at` on shipments, `block_number` on breach_events (captured from the tx receipt), `GET /admin/breaches` (global feed), `GET /admin/chain-status`, and `GET /admin/shipments` now joins each shipment's latest reading.
- Verified in an actual browser against live Sepolia data: all four pages, login, and the event detail panel — zero console errors.

## Notes
- Each phase should be reviewed before starting the next.
- Phase 4 (testnet) and any step involving real/testnet funds or keys requires explicit confirmation first.
