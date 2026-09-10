import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div
        style={{
          flex: "0 0 40%",
          minWidth: "320px",
          background: "var(--sidebar)",
          color: "#fff",
          padding: "3rem 3rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem", letterSpacing: "0.02em" }}>TRACELEDGER</div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: "0.25rem",
            }}
          >
            Supply Chain Intelligence
          </div>
        </div>

        <div>
          <div style={{ width: "40px", height: "3px", background: "var(--primary)", marginBottom: "1.5rem" }} />
          <p style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.35, margin: 0 }}>
            Monitor every shipment.
            <br />
            Verify every event.
            <br />
            Trust every record.
          </p>
        </div>

        <div style={{ fontSize: "0.8rem", color: "#94a3b8", letterSpacing: "0.03em" }}>
          IoT&nbsp;&nbsp;·&nbsp;&nbsp;Blockchain&nbsp;&nbsp;·&nbsp;&nbsp;Real-time
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <form onSubmit={handleSubmit} style={{ width: "320px", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Welcome back</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.35rem" }}>
              Sign in to your account
            </p>
          </div>

          <label className="form-label">
            Email
            <input
              type="email"
              required
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="form-label">
            Password
            <input
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div style={{ color: "var(--breach)", fontSize: "0.85rem" }}>{error}</div>}

          <button type="submit" className="primary" disabled={submitting} style={{ padding: "0.65rem" }}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
