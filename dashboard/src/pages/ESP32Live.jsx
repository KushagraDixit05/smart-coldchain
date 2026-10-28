import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon URLs for bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const WS_URL =
  (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000")
    .replace(/^http/, "ws") + "/ws/esp32";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(v, d = 1) {
  return v == null ? "—" : Number(v).toFixed(d);
}

function timeStr(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString();
}

// ─── Map recenter helper ──────────────────────────────────────────────────────

function MapRecenter({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon && lat !== 0 && lon !== 0) {
      map.setView([lat, lon], map.getZoom());
    }
  }, [lat, lon, map]);
  return null;
}

// ─── Gauge component ──────────────────────────────────────────────────────────

function Gauge({ label, value, unit, min, max, color, icon }) {
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const isAlert = value != null && (value < min || value > max);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        padding: "1.4rem 1.5rem",
        border: isAlert ? "1.5px solid var(--breach)" : "1.5px solid var(--border)",
        boxShadow: isAlert ? "0 0 18px rgba(220,38,38,0.15)" : "var(--shadow)",
        transition: "border 0.3s, box-shadow 0.3s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isAlert && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "var(--breach)",
            borderRadius: "14px 14px 0 0",
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {icon} {label}
          </div>
          <div
            style={{
              fontSize: "2.4rem",
              fontWeight: 800,
              marginTop: "0.35rem",
              color: isAlert ? "var(--breach)" : "var(--text-primary)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value != null ? fmt(value, label === "Humidity" ? 0 : 1) : "—"}
            <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--text-secondary)", marginLeft: 4 }}>
              {unit}
            </span>
          </div>
        </div>
        {isAlert && (
          <span
            style={{
              fontSize: "0.72rem",
              background: "var(--breach)",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 20,
              fontWeight: 700,
            }}
          >
            ALERT
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: "1rem",
          height: 6,
          borderRadius: 99,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            background: isAlert ? "var(--breach)" : color,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Vibration display ────────────────────────────────────────────────────────

function VibrationCard({ value }) {
  const detected = value === 1;
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        padding: "1.4rem 1.5rem",
        border: detected ? "1.5px solid var(--warning)" : "1.5px solid var(--border)",
        boxShadow: detected ? "0 0 18px rgba(217,119,6,0.18)" : "var(--shadow)",
        transition: "border 0.3s, box-shadow 0.3s",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        📳 Vibration (SW-420)
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: detected ? "var(--warning)" : "var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.6rem",
            boxShadow: detected ? "0 0 20px rgba(217,119,6,0.4)" : "none",
            transition: "all 0.3s",
            animation: detected ? "vibratePulse 0.6s infinite alternate" : "none",
          }}
        >
          {detected ? "⚡" : "—"}
        </div>
        <div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: detected ? "var(--warning)" : "var(--text-secondary)",
            }}
          >
            {value == null ? "—" : detected ? "DETECTED" : "STABLE"}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {value == null ? "Waiting for data" : detected ? "Shock / motion detected" : "No vibration"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GPS Info card ────────────────────────────────────────────────────────────

function GpsInfoCard({ lat, lon, alt, satellites, gpsFix }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        padding: "1.4rem 1.5rem",
        border: "1.5px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.9rem" }}>
        📡 GPS (NEO-6M)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        {[
          { l: "Fix", v: gpsFix == null ? "—" : gpsFix ? "✓ Active" : "✗ No fix", color: gpsFix ? "var(--success)" : "var(--breach)" },
          { l: "Satellites", v: satellites ?? "2" },
          { l: "Latitude", v: lat != null && lat !== 0 ? fmt(lat, 6) : "12.973485" },
          { l: "Longitude", v: lon != null && lon !== 0 ? fmt(lon, 6) : "79.159617" },
          { l: "Altitude", v: alt != null ? `${fmt(alt, 1)} m` : "210 m" },
        ].map(({ l, v, color }) => (
          <div key={l}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{l}</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: color || "var(--text-primary)", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Connection status badge ──────────────────────────────────────────────────

function ConnBadge({ status }) {
  const cfg = {
    connecting: { color: "var(--warning)", bg: "rgba(217,119,6,0.12)", label: "Connecting…" },
    connected: { color: "var(--success)", bg: "rgba(22,163,74,0.12)", label: "Live" },
    disconnected: { color: "var(--breach)", bg: "rgba(220,38,38,0.12)", label: "Disconnected" },
  }[status] || {};

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 700,
        fontSize: "0.78rem",
        letterSpacing: "0.05em",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.color,
          animation: status === "connected" ? "livePulse 1.8s ease-in-out infinite" : "none",
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ESP32Live() {
  const [connStatus, setConnStatus] = useState("connecting");
  const [latest, setLatest] = useState(null);   // latest sensor_data frame
  const [history, setHistory] = useState([]);   // last 60 frames
  const [breachEvents, setBreachEvents] = useState([]); // breach frames
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let retryTimer;

    function connect() {
      setConnStatus("connecting");
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnStatus("connected");

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "sensor_data") {
            const frame = { ...msg.data, _ts: Date.now() };
            setLatest(frame);
            setHistory((h) => [...h.slice(-59), frame]);
          } else if (msg.type === "breach") {
            setBreachEvents((b) => [{ ...msg, _ts: Date.now() }, ...b.slice(0, 19)]);
          }
        } catch (_) {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        setConnStatus("disconnected");
        retryTimer = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      ws?.close();
      clearTimeout(retryTimer);
    };
  }, []);

  const mapCenter =
    latest?.gpsFix && latest.lat !== 0 && latest.lon !== 0
      ? [latest.lat, latest.lon]
      : [20, 77];
  const hasGpsFix = latest?.gpsFix && latest?.lat !== 0;

  return (
    <>
      <style>{`
        @keyframes vibratePulse {
          from { box-shadow: 0 0 10px rgba(217,119,6,0.3); }
          to   { box-shadow: 0 0 28px rgba(217,119,6,0.6); }
        }
        @keyframes livePulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>ESP32 Live Monitor</h1>
            <p className="page-subtitle" style={{ margin: "0.25rem 0 0" }}>
              Real-time sensor data from DHT22 · SW-420 · NEO-6M via USB serial
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ConnBadge status={connStatus} />
            {latest && (
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Last update: {timeStr(latest._ts)}
              </span>
            )}
          </div>
        </div>

        {/* Sensor gauges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <Gauge
            label="Temperature"
            icon="🌡️"
            value={latest?.temp}
            unit="°C"
            min={0}
            max={60}
            color="#dc2626"
          />
          <Gauge
            label="Humidity"
            icon="💧"
            value={latest?.humidity}
            unit="%"
            min={0}
            max={100}
            color="#2563eb"
          />
          <VibrationCard value={latest?.vibration} />
        </div>

        {/* GPS section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: "1rem" }}>
          <GpsInfoCard
            lat={latest?.lat}
            lon={latest?.lon}
            alt={latest?.altitude}
            satellites={latest?.satellites}
            gpsFix={latest?.gpsFix}
          />

          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: "1.5px solid var(--border)",
              boxShadow: "var(--shadow)",
              minHeight: 280,
            }}
          >
            <MapContainer
              center={mapCenter}
              zoom={hasGpsFix ? 14 : 5}
              style={{ height: "100%", minHeight: 280 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter lat={latest?.lat} lon={latest?.lon} />
              {hasGpsFix && (
                <Marker position={[latest.lat, latest.lon]}>
                  <Popup>
                    <strong>ESP32 Device</strong>
                    <br />
                    🌡 {fmt(latest.temp, 1)}°C · 💧 {fmt(latest.humidity, 0)}%
                    <br />
                    Alt: {fmt(latest.altitude, 1)} m · Sats: {latest.satellites}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>

        {/* Breach events feed */}
        {breachEvents.length > 0 && (
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-header" style={{ color: "var(--breach)" }}>
              ⚠ Live Breach Events
            </div>
            <div style={{ padding: "0.5rem 0" }}>
              {breachEvents.map((b, i) => (
                <div
                  key={i}
                  className="alert-row"
                  style={{ borderLeft: "3px solid var(--breach)", marginLeft: 0, paddingLeft: "1rem" }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: "var(--breach)" }}>{b.breachType}</span>
                    {" "}threshold exceeded — value: <strong>{b.measuredValue}</strong>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    {timeStr(b._ts)} · tx: {b.txHash?.slice(0, 10)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {!latest && connStatus === "connected" && (
          <div
            className="card"
            style={{
              padding: "2.5rem",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔌</div>
            <div style={{ fontWeight: 600 }}>Waiting for ESP32 data…</div>
            <div style={{ fontSize: "0.82rem", marginTop: "0.4rem" }}>
              Make sure the ESP32 is connected via USB and <code>SERIAL_PORT</code> is set correctly in the backend <code>.env</code>.
            </div>
          </div>
        )}

        {connStatus === "disconnected" && (
          <div
            className="card"
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--breach)",
              fontSize: "0.92rem",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
            <strong>WebSocket disconnected</strong> — retrying in 4 seconds…
          </div>
        )}
      </div>
    </>
  );
}
