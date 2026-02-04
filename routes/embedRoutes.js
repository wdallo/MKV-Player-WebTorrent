import express from "express";
const router = express.Router();

router.get("/embed", (req, res) => {
  const url = req.query.url || "";

  // Check if it's a torrent site browsing request
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    res.render("browser", { url });
  } else {
    res.render("embed", { url });
  }
});

export default router;
