import express from "express";
const router = express.Router();

router.get("/embed", (req, res) => {
  const url = req.query.url || "";

  res.render("embed", { url });
});

export default router;
