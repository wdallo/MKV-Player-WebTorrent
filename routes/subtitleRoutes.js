import express from "express";
import {
  streamAssSubtitles,
  streamVttSubtitles,
  listSubtitleTracks,
} from "../controllers/subtitleController.js";
const router = express.Router();

router.get("/subtitles", streamAssSubtitles);
router.get("/subtitles.vtt", streamVttSubtitles);
router.get("/subtitle-tracks", listSubtitleTracks);

export default router;
