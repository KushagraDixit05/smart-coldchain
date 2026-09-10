-- Off-chain cache. Source of truth for breach events is the ShipmentRegistry
-- smart contract; these tables mirror it for fast querying plus store full
-- (non-breach) telemetry history for dashboard charts.

CREATE TABLE IF NOT EXISTS admins (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
    id                SERIAL PRIMARY KEY,
    shipment_id       TEXT UNIQUE NOT NULL, -- matches on-chain shipmentId
    product           TEXT NOT NULL,
    origin            TEXT NOT NULL,
    destination       TEXT NOT NULL,
    temp_min          NUMERIC NOT NULL, -- degrees C
    temp_max          NUMERIC NOT NULL,
    humidity_min      NUMERIC NOT NULL, -- percent
    humidity_max      NUMERIC NOT NULL,
    vibration_max     NUMERIC NOT NULL,
    status            TEXT NOT NULL DEFAULT 'InTransit'
                          CHECK (status IN ('InTransit', 'Breached', 'Delivered')),
    tx_hash_created   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at      TIMESTAMPTZ
);

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS readings (
    id           BIGSERIAL PRIMARY KEY,
    shipment_id  TEXT NOT NULL REFERENCES shipments(shipment_id),
    device_id    TEXT NOT NULL,
    temp         NUMERIC NOT NULL,
    humidity     NUMERIC NOT NULL,
    vibration    NUMERIC NOT NULL,
    lat          NUMERIC NOT NULL,
    lon          NUMERIC NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_shipment_time
    ON readings (shipment_id, recorded_at);

CREATE TABLE IF NOT EXISTS breach_events (
    id             BIGSERIAL PRIMARY KEY,
    shipment_id    TEXT NOT NULL REFERENCES shipments(shipment_id),
    breach_type    TEXT NOT NULL CHECK (breach_type IN ('Temperature', 'Humidity', 'Vibration')),
    measured_value NUMERIC NOT NULL,
    lat            NUMERIC NOT NULL,
    lon            NUMERIC NOT NULL,
    device_id      TEXT NOT NULL,
    recorded_at    TIMESTAMPTZ NOT NULL,
    tx_hash        TEXT,
    block_number   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_breach_events_shipment
    ON breach_events (shipment_id, recorded_at);

ALTER TABLE breach_events ADD COLUMN IF NOT EXISTS block_number BIGINT;
