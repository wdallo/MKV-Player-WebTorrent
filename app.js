import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

// Import security middleware
import {
  rateLimiter,
  securityHeaders,
  securityLogger,
  errorHandler,
} from "./utils/security.js";

import videoRoutes from "./routes/videoRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import subtitleRoutes from "./routes/subtitleRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import embedRoutes from "./routes/embedRoutes.js";

const app = express();

// Apply security middleware first
app.use(securityHeaders);
app.use(rateLimiter);
app.use(securityLogger);

app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
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
app.use(audioRoutes);
app.use(statusRoutes);
app.use(subtitleRoutes);
app.use(embedRoutes);

// Add error handling middleware last
app.use(errorHandler);

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process in production
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process in production
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
