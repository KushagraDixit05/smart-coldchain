import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const EXPLORER_BASE_URL = import.meta.env.VITE_EXPLORER_BASE_URL || "";

const BREACH_COLORS = {
  Temperature: "var(--breach)",
  Humidity: "var(--primary)",
  Vibration: "var(--warning)",
};
const BREACH_HEX = { Temperature: "#dc2626", Humidity: "#2563eb", Vibration: "#d97706" };

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString();
}

function txLink(hash) {
  if (!hash) return null;
  return EXPLORER_BASE_URL ? `${EXPLORER_BASE_URL}/tx/${hash}` : null;
}

function sensorStatus(value, min, max) {
  if (value === undefined || value === null) return { status: "unknown", delta: null };
  if (min !== undefined && value < min) return { status: "low", delta: value - min };
  if (max !== undefined && value > max) return { status: "high", delta: value - max };
  return { status: "normal", delta: null };
}

function SensorCard({ label, value, unit, min, max }) {
  const { status, delta } = sensorStatus(value, min, max);
  const color = status === "normal" ? "var(--success)" : status === "unknown" ? "var(--text-secondary)" : "var(--breach)";
  const statusText =
    status === "normal" ? "Normal" : status === "unknown" ? "No data" : status === "high" ? "Above threshold" : "Below threshold";
  return (
    <div className="sensor-card">
      <div className="sensor-label">{label}</div>
      <div className="sensor-value">
        {value !== undefined && value !== null ? `${Number(value).toFixed(label === "Humidity" ? 0 : 2)}${unit}` : "—"}
      </div>
      <div className="sensor-status" style={{ color }}>
        {delta !== null && (delta > 0 ? "↑ " : "↓ ") + `${Math.abs(delta).toFixed(1)}${unit} `}
        {statusText}
      </div>
    </div>
  );
}

function Chart({ title, data, dataKey, unit, min, max, color }) {
  return (
    <div className="card" style={{ padding: "1.1rem" }}>
      <div className="section-label" style={{ marginBottom: "0.5rem" }}>
        {title} {unit && <span style={{ textTransform: "none", fontWeight: 400 }}>({unit})</span>}
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="recorded_at" tickFormatter={fmtTime} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={fmtTime} />
          {min !== undefined && <ReferenceLine y={min} stroke="#cbd5e1" strokeDasharray="4 4" />}
          {max !== undefined && <ReferenceLine y={max} stroke="#cbd5e1" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function JourneyTimeline({ shipment, firstBreach }) {
  const stages = [
    { label: shipment.origin, sub: "Origin", icon: "✓", time: shipment.created_at, active: true },
    {
      label: "In Transit",
      sub: shipment.status === "Breached" ? "Threshold exceeded" : shipment.status === "Delivered" ? "Completed" : "In progress",
      icon: shipment.status === "Breached" ? "⚠" : shipment.status === "Delivered" ? "✓" : "●",
      time: shipment.status === "Breached" ? firstBreach?.recorded_at : shipment.status === "Delivered" ? null : null,
      active: true,
      breach: shipment.status === "Breached",
    },
    {
      label: shipment.destination,
      sub: "Destination",
      icon: shipment.delivered_at ? "✓" : "○",
      time: shipment.delivered_at,
      active: Boolean(shipment.delivered_at),
    },
  ];

  return (
    <div className="card" style={{ padding: "1.5rem 1.75rem" }}>
      <div className="section-label">Shipment Journey</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: "1.5rem" }}>
        {stages.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: i === 0 ? "left" : i === stages.length - 1 ? "right" : "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: "50%",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#fff",
                background: s.breach ? "var(--breach)" : s.active ? "var(--primary)" : "#cbd5e1",
              }}
            >
              {s.icon}
            </div>
            <div style={{ marginTop: "0.5rem", fontWeight: 700, fontSize: "0.9rem" }}>{s.label}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{s.sub}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
              {s.time ? new Date(s.time).toLocaleTimeString() : "--"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", height: 3, marginTop: "-38px", zIndex: -1, position: "relative", marginBottom: "38px" }}>
        <div style={{ flex: 1, background: "var(--primary)" }} />
        <div style={{ flex: 1, background: shipment.delivered_at ? "var(--primary)" : "#e2e8f0" }} />
      </div>
    </div>
  );
}

export default function ShipmentDetail() {
  const { id } = useParams();
  const [shipment, setShipment] = useState(null);
  const [history, setHistory] = useState(null);
  const [breaches, setBreaches] = useState(null);
  const [error, setError] = useState(null);
  const [delivering, setDelivering] = useState(false);

  function load() {
    api.listShipments().then((all) => setShipment(all.find((s) => s.shipment_id === id)));
    api.getHistory(id).then(setHistory);
    api.getBreaches(id).then(setBreaches);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDeliver() {
    setError(null);
    setDelivering(true);
    try {
      await api.markDelivered(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDelivering(false);
    }
  }

  if (error) return <div style={{ color: "var(--breach)" }}>{error}</div>;
  if (!shipment || !history || !breaches) return <div>Loading...</div>;

  const numericHistory = history.map((r) => ({
    ...r,
    temp: Number(r.temp),
    humidity: Number(r.humidity),
    vibration: Number(r.vibration),
  }));
  const latest = numericHistory[numericHistory.length - 1];

  const mapPoints = breaches.map((b) => ({ ...b, lat: Number(b.lat), lon: Number(b.lon) }));
  const mapCenter = mapPoints.length
    ? [mapPoints[mapPoints.length - 1].lat, mapPoints[mapPoints.length - 1].lon]
    : latest
      ? [Number(latest.lat), Number(latest.lon)]
      : [20, 0];

  const latestBreach = breaches[breaches.length - 1];
  const blockchainRecord = latestBreach
    ? {
        event: `${latestBreach.breach_type.toUpperCase()}_BREACH`,
        txHash: latestBreach.tx_hash,
        blockNumber: latestBreach.block_number,
        time: latestBreach.recorded_at,
      }
    : shipment.tx_hash_created
      ? { event: "SHIPMENT_CREATED", txHash: shipment.tx_hash_created, blockNumber: null, time: shipment.created_at }
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Link to="/shipments" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        ← Shipments
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>
            {shipment.shipment_id} — {shipment.product}
          </h1>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {shipment.origin} → {shipment.destination}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <StatusBadge status={shipment.status} />
          {shipment.status !== "Delivered" && (
            <button onClick={handleDeliver} disabled={delivering}>
              {delivering ? "Marking..." : "Mark Delivered"}
            </button>
          )}
        </div>
      </div>

      <JourneyTimeline shipment={shipment} firstBreach={breaches[0]} />

      <div>
        <div className="section-label">Current Sensor Data</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <SensorCard
            label="Temperature"
            value={latest?.temp}
            unit="°C"
            min={Number(shipment.temp_min)}
            max={Number(shipment.temp_max)}
          />
          <SensorCard
            label="Humidity"
            value={latest?.humidity}
            unit="%"
            min={Number(shipment.humidity_min)}
            max={Number(shipment.humidity_max)}
          />
          <SensorCard label="Vibration" value={latest?.vibration} unit="g" max={Number(shipment.vibration_max)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <Chart
          title="Temperature History"
          data={numericHistory}
          dataKey="temp"
          unit="°C"
          min={Number(shipment.temp_min)}
          max={Number(shipment.temp_max)}
          color="#dc2626"
        />
        <Chart
          title="Humidity History"
          data={numericHistory}
          dataKey="humidity"
          unit="%"
          min={Number(shipment.humidity_min)}
          max={Number(shipment.humidity_max)}
          color="#2563eb"
        />
        <Chart
          title="Vibration History"
          data={numericHistory}
          dataKey="vibration"
          unit="g"
          max={Number(shipment.vibration_max)}
          color="#d97706"
        />
      </div>

      {blockchainRecord && (
        <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
          <div className="section-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "var(--success)" }}>✓</span> Blockchain Record
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              marginTop: "0.75rem",
              fontSize: "0.88rem",
            }}
          >
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Transaction</div>
              {txLink(blockchainRecord.txHash) ? (
                <a href={txLink(blockchainRecord.txHash)} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {blockchainRecord.txHash.slice(0, 10)}...{blockchainRecord.txHash.slice(-4)}
                </a>
              ) : (
                <span style={{ fontWeight: 600 }}>{blockchainRecord.txHash.slice(0, 10)}...</span>
              )}
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Block</div>
              <div style={{ fontWeight: 600 }}>{blockchainRecord.blockNumber ? `#${blockchainRecord.blockNumber}` : "—"}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Event</div>
              <div style={{ fontWeight: 600 }}>{blockchainRecord.event}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Timestamp</div>
              <div style={{ fontWeight: 600 }}>{new Date(blockchainRecord.time).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: "1.1rem" }}>
        <div className="section-label" style={{ marginBottom: "0.5rem" }}>
          Breach Locations
        </div>
        {mapPoints.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>No breaches recorded.</div>
        ) : (
          <MapContainer center={mapCenter} zoom={11} style={{ height: "320px", borderRadius: "10px" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapPoints.map((b) => (
              <CircleMarker
                key={b.id}
                center={[b.lat, b.lon]}
                radius={9}
                pathOptions={{ color: BREACH_HEX[b.breach_type] || "#666", fillOpacity: 0.7 }}
              >
                <Popup>
                  <strong>{b.breach_type}</strong> breach
                  <br />
                  value: {b.measured_value}
                  <br />
                  {new Date(b.recorded_at).toLocaleString()}
                  <br />
                  device: {b.device_id}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">Breach Events (On-Chain)</div>
        {breaches.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", padding: "1.1rem" }}>None.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Location</th>
                <th>Block</th>
                <th>Time</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {breaches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span style={{ color: BREACH_COLORS[b.breach_type], fontWeight: 700 }}>{b.breach_type}</span>
                  </td>
                  <td>{b.measured_value}</td>
                  <td>
                    {Number(b.lat).toFixed(4)}, {Number(b.lon).toFixed(4)}
                  </td>
                  <td>{b.block_number ? `#${b.block_number}` : "—"}</td>
                  <td>{new Date(b.recorded_at).toLocaleString()}</td>
                  <td>
                    {txLink(b.tx_hash) ? (
                      <a href={txLink(b.tx_hash)} target="_blank" rel="noreferrer">
                        {b.tx_hash.slice(0, 10)}...
                      </a>
                    ) : (
                      <span title={b.tx_hash}>{b.tx_hash?.slice(0, 10)}...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
