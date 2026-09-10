import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const PRODUCT_ICON = { Vaccines: "💉", Insulin: "💉", "Frozen Fish": "🐟", Electronics: "📦" };

function Condition({ shipment }) {
  if (!shipment.latest_reading_at) {
    return <span style={{ color: "var(--text-secondary)" }}>No data yet</span>;
  }
  const breached = shipment.status === "Breached";
  const color = breached ? "var(--breach)" : "var(--success)";
  return (
    <span style={{ color, fontWeight: 600 }}>
      🌡 {Number(shipment.latest_temp).toFixed(1)}°C
    </span>
  );
}

export default function ShipmentList() {
  const [shipments, setShipments] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listShipments()
      .then(setShipments)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Shipments</h1>
          {shipments && (
            <p className="page-subtitle">
              {shipments.length} total · {shipments.filter((s) => s.status !== "Breached").length} healthy ·{" "}
              {shipments.filter((s) => s.status === "Breached").length} breached
            </p>
          )}
        </div>
        <Link to="/shipments/new">
          <button className="primary">+ Create Shipment</button>
        </Link>
      </div>

      {error && <div style={{ color: "var(--breach)" }}>{error}</div>}
      {!shipments && !error && <div>Loading...</div>}

      {shipments && shipments.length === 0 && (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
          No shipments yet. Create one to get started.
        </div>
      )}

      {shipments && shipments.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Product</th>
                <th>Route</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.shipment_id}>
                  <td>
                    <Link to={`/shipments/${encodeURIComponent(s.shipment_id)}`} style={{ fontWeight: 600 }}>
                      {s.shipment_id}
                    </Link>
                  </td>
                  <td>
                    {PRODUCT_ICON[s.product] || "📦"} {s.product}
                  </td>
                  <td>
                    {s.origin} → {s.destination}
                  </td>
                  <td>
                    <Condition shipment={s} />
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
