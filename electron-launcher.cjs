const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=== MKV Player Server Launcher ===");
console.log("Starting MKV Player server...");
console.log("Current working directory:", __dirname);
console.log("Process cwd:", process.cwd());
console.log("Process platform:", process.platform);
console.log("Node version:", process.version);

// Check if app.js exists
const appPath = path.join(__dirname, "app.js");
console.log("Looking for app.js at:", appPath);
console.log("app.js exists:", fs.existsSync(appPath));

// List files in current directory for debugging
console.log("Files in current directory:");
try {
  const files = fs.readdirSync(__dirname);
  console.log(files);
} catch (err) {
  console.error("Error reading directory:", err);
}

// Check package.json
const packagePath = path.join(__dirname, "package.json");
console.log("package.json exists:", fs.existsSync(packagePath));
if (fs.existsSync(packagePath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    console.log("Package type:", pkg.type);
  } catch (err) {
    console.error("Error reading package.json:", err);
  }
}

// Check for node_modules
const nodeModulesPath = path.join(__dirname, "node_modules");
console.log("node_modules exists:", fs.existsSync(nodeModulesPath));

if (!fs.existsSync(appPath)) {
  console.error("CRITICAL: app.js not found!");
  process.exit(1);
}

// Start the server directly since package.json has "type": "module"
console.log("=== Starting Node.js Server Process ===");
const serverProcess = spawn(process.execPath, ["--trace-warnings", "app.js"], {
  cwd: __dirname,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3000",
  },
});

console.log("Server process PID:", serverProcess.pid);
console.log("Server process started successfully");

serverProcess.on("error", (err) => {
  console.error("[ERROR] Server process error:", err);
  console.error("Error details:", {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    path: err.path,
  });
});

serverProcess.on("exit", (code, signal) => {
  console.log(
    `[INFO] Server process exited with code ${code} and signal ${signal}`
  );
  if (code !== 0 && code !== null) {
    console.error("[ERROR] Server process exited with non-zero code");
    process.exit(code);
  }
});

serverProcess.on("spawn", () => {
  console.log("[INFO] Server process spawned successfully");
});

// Graceful shutdown handling
const cleanup = () => {
  console.log("[INFO] Shutting down server...");
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (!serverProcess.killed) {
        console.log("[WARN] Force killing server process");
        serverProcess.kill("SIGKILL");
      }
    }, 5000);
  }
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
