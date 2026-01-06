import express from "express";
import { getStatus, getSysInfo } from "../controllers/statusController.js";
const router = express.Router();

// Health check endpoint for server status
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/status", getStatus);
router.get("/sysinfo", getSysInfo);

export default router;
