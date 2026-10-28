const http = require("http");
const { WebSocketServer } = require("ws");
const app = require("./app");
const serialBridge = require("./services/serialBridge");

const port = process.env.PORT || 4000;

// ── HTTP + WS server ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/esp32" });

// Registry of live WebSocket clients
const wsClients = new Set();
serialBridge.setWsClients(wsClients);

wss.on("connection", (ws) => {
  wsClients.add(ws);
  console.log(`[ws] client connected  (total: ${wsClients.size})`);

  ws.on("close", () => {
    wsClients.delete(ws);
    console.log(`[ws] client disconnected (total: ${wsClients.size})`);
  });
  ws.on("error", () => wsClients.delete(ws));
});

// ── Start serial bridge (no-op if SERIAL_PORT env is absent) ─────────────────
serialBridge.start();

server.listen(port, () => {
  console.log(`bkt backend listening on port ${port}`);
  console.log(`WebSocket endpoint: ws://127.0.0.1:${port}/ws/esp32`);
});
