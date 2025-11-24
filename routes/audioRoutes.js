import express from "express";
import {
  listAudioTracks,
  streamAudioTrack,
  getAudioTimingOffset,
} from "../controllers/audioController.js";

const router = express.Router();

router.get("/audio-tracks", listAudioTracks);
router.get("/audio", streamAudioTrack);
router.get("/audio-timing", getAudioTimingOffset);

export default router;
