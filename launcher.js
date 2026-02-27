#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || "web"; // Default to web mode

console.log("MKV Video Player Launcher");
console.log("========================");

function printUsage() {
  console.log(`
Usage: node launcher.js [mode]

Modes:
  web       - Start web server only (default)
  electron  - Start Electron desktop app
  dev       - Start in development mode with auto-reload
  help      - Show this help message

Examples:
  node launcher.js                 # Start web server
  node launcher.js web             # Start web server
  node launcher.js electron        # Start Electron app
  node launcher.js dev             # Start in development mode
`);
}

function startWebServer() {
  console.log("\n🚀 Starting web server...");
  console.log("Access the app at: http://localhost:3000");
  console.log("Press Ctrl+C to stop\n");

  const serverProcess = spawn("node", ["app.js"], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env },
  });

  serverProcess.on("error", (err) => {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Server process exited with code ${code}`);
    } else {
      console.log("\n✅ Server stopped gracefully");
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping server...");
    serverProcess.kill("SIGTERM");
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Stopping server...");
    serverProcess.kill("SIGTERM");
  });
}

function startElectronApp() {
  console.log("\n🖥️  Starting Electron desktop app...");
  console.log("The desktop application will open in a moment...\n");

  // Use npm script so npm adds node_modules/.bin to PATH and runs local electron
  const electronProcess = spawn("npm run electron", {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env },
    shell: true,
  });

  electronProcess.on("error", (err) => {
    console.error("❌ Failed to start Electron app:", err.message);
    console.log("💡 Make sure Electron is installed: npm install electron");
    process.exit(1);
  });

  electronProcess.on("exit", (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Electron process exited with code ${code}`);
    } else {
      console.log("\n✅ Electron app closed");
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping Electron app...");
    electronProcess.kill("SIGTERM");
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Stopping Electron app...");
    electronProcess.kill("SIGTERM");
  });
}

function startDevMode() {
  console.log("\n🔧 Starting in development mode...");
  console.log("Features:");
  console.log("  - Auto-reload on file changes");
  console.log("  - Developer tools enabled");
  console.log("  - Enhanced logging\n");

  // Use npm script for dev to ensure environment variables and local binary are used
  const devProcess = spawn("npm run electron-dev", {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env },
    shell: true,
  });

  devProcess.on("error", (err) => {
    console.error("❌ Failed to start development mode:", err.message);
    console.log("💡 Make sure Electron and nodemon are installed:");
    console.log("   npm install electron nodemon");
    process.exit(1);
  });

  devProcess.on("exit", (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Development process exited with code ${code}`);
    } else {
      console.log("\n✅ Development session ended");
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping development mode...");
    devProcess.kill("SIGTERM");
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Stopping development mode...");
    devProcess.kill("SIGTERM");
  });
}

function checkDependencies() {
  // You can add dependency checks here if needed
  return true;
}

// Main execution
try {
  if (!checkDependencies()) {
    process.exit(1);
  }

  switch (mode.toLowerCase()) {
    case "web":
    case "server":
      startWebServer();
      break;

    case "electron":
    case "desktop":
    case "app":
      startElectronApp();
      break;

    case "dev":
    case "development":
      startDevMode();
      break;

    case "help":
    case "--help":
    case "-h":
      printUsage();
      process.exit(0);
      break;

    default:
      console.log(`❌ Unknown mode: ${mode}`);
      printUsage();
      process.exit(1);
  }
} catch (error) {
  console.error("❌ Launcher error:", error.message);
  process.exit(1);
}

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "❌ Unhandled Promise Rejection at:",
    promise,
    "reason:",
    reason,
  );
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});
