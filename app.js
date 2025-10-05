import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import videoRoutes from "./routes/videoRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import subtitleRoutes from "./routes/subtitleRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import { destroyTorrent } from "./services/torrentService.js";

const app = express();
app.use(cors());

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Mount routes
app.use(playerRoutes);
app.use(videoRoutes);
app.use(statusRoutes);
app.use(subtitleRoutes);

// Goodbye route
app.get("/goodbye", (req, res) => {
  const magnet = req.query.url;
  destroyTorrent(magnet);
  res.status(200).send("Torrent destroyed");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
