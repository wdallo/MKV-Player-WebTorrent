import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { promisify } from "util";

import videoRoutes from "./routes/videoRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import subtitleRoutes from "./routes/subtitleRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import { destroyTorrent } from "./services/torrentService.js";

const app = express();
app.use(cors());
app.use(compression());

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Mount routes
app.use(playerRoutes);
app.use(videoRoutes);
app.use(statusRoutes);
app.use(subtitleRoutes);

app.get("/sysinfo", (req, res) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  res.render("sysinfo", {
    memory: mem,
    cpu: cpu,
    uptime: process.uptime(),
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
  });
});

const rm = promisify(fs.rm);

// Goodbye route
app.get("/goodbye", async (req, res) => {
  const magnet = req.query.url;
  // destroyTorrent should return the path to the downloaded folder or file
  const torrentPath = destroyTorrent(magnet);
  if (torrentPath) {
    try {
      await rm(torrentPath, { recursive: true, force: true });
      res.status(200).send("Torrent destroyed and files deleted");
    } catch (err) {
      console.error("Failed to delete files:", err);
      res.status(500).send("Torrent destroyed, but failed to delete files");
    }
  } else {
    res.status(200).send("Torrent destroyed (no files to delete)");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
