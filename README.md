# bkt — Blockchain-based IoT Supply Chain Monitor

Tracks shipments through a supply chain and immutably records on the
Ethereum Sepolia testnet when a shipment is damaged in transit — via
temperature, humidity, or vibration thresholds — along with the GPS
location of the breach. Admins view shipment status and breach locations
on a dashboard.

See `CLAUDE.md` for project rules, `docs/ARCHITECTURE.md` for system design,
and `docs/IMPLEMENTATION_PLAN.md` for the phased build plan and current
status.

## Repo layout

- `contracts/` — Solidity smart contract (Hardhat project)
- `backend/` — Node.js/Express API (Phase 2)
- `dashboard/` — React admin dashboard (Phase 3)
- `simulator/` — device simulator, mimics the ESP32 payload (Phase 2)
- `firmware/` — ESP32 firmware (Phase 5)

## Local dev quickstart (Phases 1-2)

```bash
# 1. Local Postgres (project-local container, port 5433)
docker compose up -d

# 2. Local blockchain (separate terminal, keep running)
cd contracts
npm install
npx hardhat node

# 3. Deploy contract + grant DEVICE_ROLE to a second test account (new terminal)
cd contracts
npx hardhat run scripts/deploy.js --network localhost
CONTRACT_ADDRESS=<from above> DEVICE_ADDRESS=<hardhat account #1 address> \
  npx hardhat run scripts/grant-device-role.js --network localhost

# 4. Backend
cd backend
npm install
cp .env.example .env   # fill in CONTRACT_ADDRESS, ADMIN_PRIVATE_KEY (account #0),
                        # DEVICE_PRIVATE_KEY (account #1) from the hardhat node output
npm run migrate
npm run create-admin -- admin@example.com yourpassword "Your Company"
npm start

# 5. Simulator (new terminal) — create a shipment via POST /admin/shipments first
cd simulator
npm install
cp .env.example .env
npm start

# 6. Dashboard (new terminal)
cd dashboard
npm install
cp .env.example .env
npm run dev   # http://localhost:5173
```

## Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```
