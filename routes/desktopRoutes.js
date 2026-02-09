import express from "express";

import {
  renderSettings,
  getSettings,
  saveSettings,
} from "../controllers/desktopController.js";

const router = express.Router();
router.get("/settings", renderSettings);
router.get("/settings-data", getSettings);
router.post("/settings-data", saveSettings);

export default router;
