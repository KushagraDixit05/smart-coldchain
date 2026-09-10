const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

function getToken() {
  return localStorage.getItem("bkt_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

export const api = {
  login: (email, password) => request("/admin/login", { method: "POST", body: { email, password }, auth: false }),
  listShipments: () => request("/admin/shipments"),
  createShipment: (payload) => request("/admin/shipments", { method: "POST", body: payload }),
  getHistory: (id) => request(`/admin/shipments/${encodeURIComponent(id)}/history`),
  getBreaches: (id) => request(`/admin/shipments/${encodeURIComponent(id)}/breaches`),
  markDelivered: (id) => request(`/admin/shipments/${encodeURIComponent(id)}/deliver`, { method: "POST" }),
  getAllBreaches: (limit = 50) => request(`/admin/breaches?limit=${limit}`),
  getChainStatus: () => request("/admin/chain-status"),
};

export { getToken };
