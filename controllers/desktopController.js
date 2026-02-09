import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "../configs/all.config.js");

export async function getSettings(req, res) {
  try {
    // Dynamic import requires file:// URL
    const configModule = await import("file://" + configPath);
    res.json({
      PLAYER_CONFIG: configModule.PLAYER_CONFIG,
      PERF_CONFIG: configModule.PERF_CONFIG,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load config" });
  }
}

export function renderSettings(req, res) {
  // Render the player EJS view, passing the magnet link, title, and version
  res.render("settings", {
    pageTitle: "MKV Player - Settings",
    appVersion: process.env.npm_package_version || "dev",
  });
}

export async function saveSettings(req, res) {
  try {
    const { PLAYER_CONFIG, PERF_CONFIG, RESET_DEFAULTS } = req.body;
    const backupPath = configPath + ".bak";

    // Restore defaults if requested
    if (RESET_DEFAULTS) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath);
        return res.json({ success: true, restored: true });
      } else {
        return res.status(500).json({ error: "No backup found to restore." });
      }
    }

    // Make backup if not exists
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(configPath, backupPath);
    }

    let original = fs.readFileSync(configPath, "utf-8");

    // Helper: update config block in JS format
    function updateConfigBlock(orig, blockName, updates) {
      // Tikslus regex: nuo { iki };
      // Leisti tarpus, komentarus, ir bet kokį formatavimą
      const blockRegex = new RegExp(
        `export\\s+const\\s+${blockName}\\s*=\\s*\\{([\\s\\S]*?)\\};`,
        "m",
      );
      const match = orig.match(blockRegex);
      if (!match) {
        throw new Error(`${blockName} block not found in config file.`);
      }
      let blockStr = match[1];
      let existingObj = {};
      try {
        let cleaned = blockStr
          .replace(/\/\*.*?\*\//gs, "")
          .replace(/\/\/.*$/gm, "")
          .replace(/([a-zA-Z0-9_]+):/g, '"$1":');
        // Pašalinti paskutinį kablelį (bet kurioje vietoje prieš pabaigą)
        cleaned = cleaned.replace(/,\s*$/gm, "");
        // Split į laukus ir sudėti kablelius tik tarp laukų
        const lines = cleaned.split(/\n+/).filter((l) => l.trim().length > 0);
        const jsonBlock =
          "{\n" +
          lines.map((l, i) => (i === 0 ? "  " + l : "  ," + l)).join("\n") +
          "\n}";
        // fs.writeFileSync(
        //   path.join(__dirname, "../debug-cleaned.txt"),
        //   jsonBlock,
        //   "utf-8",
        // );
        existingObj = JSON.parse(jsonBlock);
      } catch (e) {
        throw new Error(`Failed to parse ${blockName} block.`);
      }
      // Tik atnaujinti nurodytus laukus, likusius palikti
      Object.assign(existingObj, updates);
      // Build JS block (not JSON)
      let newBlock = "{\n";
      for (const [key, value] of Object.entries(existingObj)) {
        let valStr;
        if (typeof value === "string") {
          valStr = `"${value.replace(/\\"/g, '"')}"`;
        } else if (typeof value === "boolean" || typeof value === "number") {
          valStr = value;
        } else {
          valStr = JSON.stringify(value);
        }
        newBlock += `  ${key}: ${valStr},\n`;
      }
      // Pridėti kablelį prie paskutinio laukelio
      newBlock = newBlock.replace(/(\n\s*[^,]+:[^,]+)(\n\s*})/, "$1,\n$2");
      // Užtikrinti, kad blokas baigtųsi }\n
      if (!newBlock.trim().endsWith("}")) {
        newBlock = newBlock.trim() + "\n}";
      }
      return orig.replace(
        blockRegex,
        `export const ${blockName} = ${newBlock};`,
      );
    }

    // Update blocks if present
    if (PLAYER_CONFIG) {
      original = updateConfigBlock(original, "PLAYER_CONFIG", PLAYER_CONFIG);
    }
    if (PERF_CONFIG) {
      original = updateConfigBlock(original, "PERF_CONFIG", PERF_CONFIG);
    }

    // Write back to file
    fs.writeFileSync(configPath, original, "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to save config" });
  }
}
