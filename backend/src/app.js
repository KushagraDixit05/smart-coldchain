require("dotenv").config();
const express = require("express");
const cors = require("cors");

const readingsRoutes = require("./routes/readings");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api", readingsRoutes);
app.use("/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

module.exports = app;
