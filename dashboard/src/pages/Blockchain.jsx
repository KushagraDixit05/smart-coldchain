import { useEffect, useState } from "react";
import { api } from "../api";

const EXPLORER_BASE_URL = import.meta.env.VITE_EXPLORER_BASE_URL || "";

const NETWORK_LABELS = {
  sepolia: "Sepolia Testnet",
  hardhat: "Local Hardhat Network",
  localhost: "Local Hardhat Network",
};

function txLink(hash) {
  if (!hash) return null;
  return EXPLORER_BASE_URL ? `${EXPLORER_BASE_URL}/tx/${hash}` : null;
}

export default function Blockchain() {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getChainStatus().then(setStatus).catch((e) => setError(e.message));
    api.getAllBreaches(100).then(setEvents).catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--breach)" }}>{error}</div>;
  if (!status || !events) return <div>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h1 className="page-title">Blockchain Activity</h1>
        <p className="page-subtitle">
          Contract{" "}
          {EXPLORER_BASE_URL ? (
            <a href={`${EXPLORER_BASE_URL}/address/${status.contractAddress}`} target="_blank" rel="noreferrer">
              {status.contractAddress}
            </a>
          ) : (
            status.contractAddress
          )}
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="pulse-live" />
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{NETWORK_LABELS[status.name] || status.name}</span>
          </div>
          <div className="stat-label">Network (chain id {status.chainId})</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">#{status.latestBlock}</div>
          <div className="stat-label">Latest Block</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{status.contractTransactions}</div>
          <div className="stat-label">Contract Transactions</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.4fr 1fr" : "1fr", gap: "1.25rem" }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header">Events</div>
          {events.length === 0 ? (
            <div style={{ padding: "1.25rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              No on-chain breach events yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Shipment</th>
                  <th>Block</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    style={{ cursor: "pointer", background: selected?.id === e.id ? "var(--primary-light)" : undefined }}
                  >
                    <td style={{ fontWeight: 600 }}>{e.breach_type.toUpperCase()}_BREACH</td>
                    <td>{e.shipment_id}</td>
                    <td>{e.block_number ? `#${e.block_number}` : "—"}</td>
                    <td>{new Date(e.recorded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="card" style={{ padding: "1.25rem 1.5rem", alignSelf: "start" }}>
            <div className="section-label">Event Detail</div>
            <dl style={{ display: "flex", flexDirection: "column", gap: "0.9rem", margin: "1rem 0 0", fontSize: "0.88rem" }}>
              <div>
                <dt style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Transaction Hash</dt>
                <dd style={{ margin: "0.2rem 0 0", wordBreak: "break-all", fontWeight: 600 }}>
                  {txLink(selected.tx_hash) ? (
                    <a href={txLink(selected.tx_hash)} target="_blank" rel="noreferrer">
                      {selected.tx_hash}
                    </a>
                  ) : (
                    selected.tx_hash
                  )}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Block</dt>
                <dd style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>
                  {selected.block_number ? `#${selected.block_number}` : "—"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Event</dt>
                <dd style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>{selected.breach_type.toUpperCase()}_BREACH</dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Shipment</dt>
                <dd style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>
                  {selected.shipment_id} ({selected.product})
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Recorded</dt>
                <dd style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>{new Date(selected.recorded_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
