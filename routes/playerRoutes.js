import express from "express";
import { renderPlayer } from "../controllers/playerController.js";
const router = express.Router();

router.get("/player", renderPlayer);

export default router;
