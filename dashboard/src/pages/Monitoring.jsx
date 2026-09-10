import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const BREACH_COLOR = { Temperature: "var(--breach)", Humidity: "var(--primary)", Vibration: "var(--warning)" };

function statusColor(status) {
  if (status === "Breached") return "var(--breach)";
  if (status === "Delivered") return "var(--success)";
  return "var(--primary)";
}

export default function Monitoring() {
  const [shipments, setShipments] = useState(null);
  const [breaches, setBreaches] = useState(null);
  const [chainStatus, setChainStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      Promise.all([api.listShipments(), api.getAllBreaches(15), api.getChainStatus()])
        .then(([s, b, c]) => {
          if (cancelled) return;
          setShipments(s);
          setBreaches(b);
          setChainStatus(c);
        })
        .catch((e) => !cancelled && setError(e.message));
    }

    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) return <div style={{ color: "var(--breach)" }}>{error}</div>;
  if (!shipments || !breaches) return <div>Loading...</div>;

  const active = shipments.filter((s) => s.status !== "Delivered");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="page-title">Live Monitoring</h1>
        <span className="live-pill" style={{ background: "var(--success-light)", color: "var(--success)" }}>
          <span className="live-dot" style={{ background: "var(--success)" }} />
          {chainStatus?.devicesOnline ?? 0} DEVICE{chainStatus?.devicesOnline === 1 ? "" : "S"} ONLINE
        </span>
      </div>

      <div>
        <div className="section-label">Active Shipments</div>
        {active.length === 0 ? (
          <div className="card" style={{ padding: "1.5rem", color: "var(--text-secondary)" }}>
            No shipments currently in transit.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {active.map((s) => (
              <Link
                key={s.shipment_id}
                to={`/shipments/${encodeURIComponent(s.shipment_id)}`}
                className="card"
                style={{ padding: "1.1rem 1.25rem", display: "block", color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: statusColor(s.status),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>{s.shipment_id}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                  {s.origin} → {s.destination}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.6rem", color: statusColor(s.status) }}>
                  {s.latest_temp ? `${Number(s.latest_temp).toFixed(1)}°C` : "No data"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">Alert Feed</div>
        {breaches.length === 0 ? (
          <div style={{ padding: "1.25rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            No alerts yet.
          </div>
        ) : (
          breaches.map((b) => (
            <div className="alert-row" key={b.id}>
              <span className="alert-dot" style={{ background: BREACH_COLOR[b.breach_type] || "#999" }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <span style={{ fontWeight: 700 }}>
                    <Link to={`/shipments/${encodeURIComponent(b.shipment_id)}`}>{b.shipment_id}</Link>
                  </span>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>
                    {b.breach_type.toLowerCase()} threshold exceeded ({b.measured_value})
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {new Date(b.recorded_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
