import express from "express";
import { renderIndex, renderPlayer } from "../controllers/playerController.js";
const router = express.Router();

router.get("/player", renderPlayer);
router.get("/", renderIndex);

export default router;
