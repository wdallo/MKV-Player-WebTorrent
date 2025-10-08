import express from "express";
import { goodbye, streamVideo } from "../controllers/videoController.js";

const router = express.Router();

router.get("/video", streamVideo);
router.get("/goodbye", goodbye);

export default router;
