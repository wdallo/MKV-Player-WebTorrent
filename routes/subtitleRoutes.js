import express from "express";
import {
  streamAssSubtitles,
  streamVttSubtitles,
} from "../controllers/subtitleController.js";
const router = express.Router();

router.get("/subtitles", streamAssSubtitles);
router.get("/subtitles.vtt", streamVttSubtitles);

export default router;
