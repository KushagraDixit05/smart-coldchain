import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso) {
  if (!iso) return "—";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const BREACH_COLOR = { Temperature: "var(--breach)", Humidity: "var(--primary)", Vibration: "var(--warning)" };

export default function Dashboard() {
  const { admin } = useAuth();
  const [shipments, setShipments] = useState(null);
  const [breaches, setBreaches] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listShipments().then(setShipments).catch((e) => setError(e.message));
    api.getAllBreaches(5).then(setBreaches).catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--breach)" }}>{error}</div>;
  if (!shipments || !breaches) return <div>Loading...</div>;

  const total = shipments.length;
  const breachedCount = shipments.filter((s) => s.status === "Breached").length;
  const healthyCount = total - breachedCount;

  const withReadings = shipments.filter((s) => s.latest_reading_at);
  const mostRecent = withReadings.sort(
    (a, b) => new Date(b.latest_reading_at) - new Date(a.latest_reading_at)
  )[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title">
          {greeting()}, {admin?.email?.split("@")[0] || "Admin"}
        </h1>
        <p className="page-subtitle">Here's the current state of your supply chain.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Shipments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {healthyCount}
          </div>
          <div className="stat-label">Healthy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--breach)" }}>
            {breachedCount}
          </div>
          <div className="stat-label">Breached</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1.25rem" }}>
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Live Sensor Monitor</span>
            {mostRecent && <span className="pulse-live" title="Receiving data" />}
          </div>
          <div style={{ padding: "1.25rem" }}>
            {!mostRecent ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>No sensor data received yet.</div>
            ) : (
              <>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.9rem" }}>
                  <Link to={`/shipments/${encodeURIComponent(mostRecent.shipment_id)}`}>
                    {mostRecent.shipment_id}
                  </Link>{" "}
                  · {mostRecent.product}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.9rem" }}>
                  <div>
                    <div className="sensor-label">Temperature</div>
                    <div className="sensor-value">{Number(mostRecent.latest_temp).toFixed(1)}°C</div>
                  </div>
                  <div>
                    <div className="sensor-label">Humidity</div>
                    <div className="sensor-value">{Number(mostRecent.latest_humidity).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="sensor-label">Vibration</div>
                    <div className="sensor-value">{Number(mostRecent.latest_vibration).toFixed(2)}g</div>
                  </div>
                </div>
                <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "var(--success)", fontWeight: 600 }}>
                  ● Receiving data · updated {timeAgo(mostRecent.latest_reading_at)}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Recent Alerts</div>
          {breaches.length === 0 ? (
            <div style={{ padding: "1.25rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              No breach events yet.
            </div>
          ) : (
            breaches.map((b) => (
              <div className="alert-row" key={b.id}>
                <span className="alert-dot" style={{ background: BREACH_COLOR[b.breach_type] || "#999" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                    <Link to={`/shipments/${encodeURIComponent(b.shipment_id)}`}>{b.shipment_id}</Link>{" "}
                    <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
                      {b.breach_type.toLowerCase()} threshold exceeded
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                    {new Date(b.recorded_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
