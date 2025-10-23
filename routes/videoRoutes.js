import express from "express";
import {
  goodbye,
  streamVideo,
  cleanLocalStorage,
} from "../controllers/videoController.js";

const router = express.Router();

router.get("/video", streamVideo);
router.post("/goodbye", goodbye);
router.post("/clean-localstorage", cleanLocalStorage);

export default router;
