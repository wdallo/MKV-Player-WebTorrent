// Player page controller
export function renderPlayer(req, res) {
  const magnet = req.query.url;
  if (!magnet || !magnet.startsWith("magnet:")) {
    return res.status(400).send("Missing or invalid magnet url param");
  }
  res.render("player", { magnet });
}
