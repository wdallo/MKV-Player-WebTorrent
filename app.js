import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import videoRoutes from "./routes/videoRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import subtitleRoutes from "./routes/subtitleRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
