import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const FIELDS = [
  { name: "shipmentId", label: "Shipment ID", type: "text" },
  { name: "product", label: "Product", type: "text" },
  { name: "origin", label: "Origin", type: "text" },
  { name: "destination", label: "Destination", type: "text" },
  { name: "tempMin", label: "Min temperature (°C)", type: "number" },
  { name: "tempMax", label: "Max temperature (°C)", type: "number" },
  { name: "humidityMin", label: "Min humidity (%)", type: "number" },
  { name: "humidityMax", label: "Max humidity (%)", type: "number" },
  { name: "vibrationMax", label: "Max vibration", type: "number" },
];

const DEFAULTS = {
  shipmentId: "",
  product: "",
  origin: "",
  destination: "",
  tempMin: -5,
  tempMax: 8,
  humidityMin: 20,
  humidityMax: 60,
  vibrationMax: 5,
};

export default function NewShipment() {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULTS);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(name, type, value) {
    setForm((f) => ({ ...f, [name]: type === "number" ? Number(value) : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createShipment(form);
      navigate(`/shipments/${encodeURIComponent(form.shipmentId)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h1 className="page-title">New Shipment</h1>
      <form onSubmit={handleSubmit} className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {FIELDS.map(({ name, label, type }) => (
          <label key={name} className="form-label">
            {label}
            <input
              type={type}
              step={type === "number" ? "any" : undefined}
              required
              value={form[name]}
              onChange={(e) => update(name, type, e.target.value)}
              className="form-input"
            />
          </label>
        ))}
        {error && <div style={{ color: "var(--breach)", fontSize: "0.85rem" }}>{error}</div>}
        <button type="submit" className="primary" disabled={submitting} style={{ padding: "0.6rem" }}>
          {submitting ? "Creating on-chain..." : "Create shipment"}
        </button>
      </form>
    </div>
  );
}
