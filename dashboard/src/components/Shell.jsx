import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/shipments", label: "Shipments" },
  { to: "/monitoring", label: "Monitoring" },
  { to: "/blockchain", label: "Blockchain" },
];

export default function Shell({ children }) {
  const { admin, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div>
          <div className="brand-name">TRACELEDGER</div>
          <div className="brand-tagline">Supply Chain Intelligence</div>
        </div>
        <div className="header-right">
          <span>
            {admin?.email} · {admin?.company}
          </span>
          <span className="live-pill">
            <span className="live-dot" /> LIVE
          </span>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <div className="shell-body">
        <nav className="sidebar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
