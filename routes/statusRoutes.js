import express from "express";
import { getStatus, getSysInfo } from "../controllers/statusController.js";
const router = express.Router();

router.get("/status", getStatus);
router.get("/sysinfo", getSysInfo);

export default router;
