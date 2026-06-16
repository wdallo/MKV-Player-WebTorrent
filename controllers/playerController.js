// Player page controller

// Renders the player page for a given magnet link
export function renderPlayer(req, res) {
  const magnet = req.query.url;
  // Validate the magnet link parameter
  if (!magnet || !magnet.startsWith("magnet:")) {
    return res.status(400).send("Missing or invalid magnet url param");
  }
  // Render the player EJS view, passing the magnet link, title, and version
  res.render("player", {
    magnet,
    pageTitle: "MKV Player - Player",
    appVersion:
      process.env.APP_VERSION || process.env.npm_package_version || "dev",
  });
}
export function renderIndex(req, res) {
  res.render("index", {
    pageTitle: "MKV Player - Enter Magnet",
    appVersion:
      process.env.APP_VERSION || process.env.npm_package_version || "dev",
  });
}
