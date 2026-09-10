import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api";

function decodeJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("bkt_token"));

  const admin = useMemo(() => (token ? decodeJwtPayload(token) : null), [token]);

  async function login(email, password) {
    const { token: newToken } = await api.login(email, password);
    localStorage.setItem("bkt_token", newToken);
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem("bkt_token");
    setToken(null);
  }

  const value = { token, admin, isAuthenticated: Boolean(token), login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
