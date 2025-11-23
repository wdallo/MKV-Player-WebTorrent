import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const url = req.query.url || "";
  res.render("embed", { url });
});

export default router;
