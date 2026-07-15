/**
 * HIROS Dev Server Runner - Bulletproof Edition
 *
 * A simple restart-loop script that ensures the Next.js dev server stays alive.
 * More reliable than PM2 for Next.js because:
 * 1. On crash, it kills ALL processes on port 3000 (including orphans)
 * 2. Waits for the port to be fully released before restarting
 * 3. No process tree issues - clean slate every restart
 *
 * Usage: node scripts/dev-runner.js
 * (Managed by PM2 for daemonization + auto-start)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execSync } = require("child_process");
const path = require("path");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Always resolve PROJECT_DIR from this file's location, never trust CWD
const PROJECT_DIR = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3000;
const MAX_RESTARTS = 50;
const RESTART_WINDOW = 3600000; // 1 hour window
const RESTART_DELAY = 5000;    // 5s between restarts

const restartTimes = [];
let shuttingDown = false;

/**
 * Windows: find the PID listening on a given port using netstat.
 * Returns PID string or null.
 */
function getPidOnPortWindows(port) {
  try {
    const output = execSync(
      `netstat -ano | findstr :${port}`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const lines = output.trim().split("\n").filter(l => l.includes("LISTENING"));
    if (lines.length === 0) return null;
    const parts = lines[0].trim().split(/\s+/);
    return parts[parts.length - 1];
  } catch {
    return null;
  }
}

/**
 * Windows: kill process on the given port using taskkill.
 */
async function killPortUsersWindows() {
  try {
    const pid = getPidOnPortWindows(PORT);
    if (!pid) return false;
    console.log(`[HIROS] Killing process on port ${PORT}: PID ${pid}`);
    try {
      execSync(`taskkill /F /PID ${pid} 2>nul`, { encoding: "utf-8" });
    } catch { /* ignore */ }
    await sleep(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unix: kill ALL processes listening on the given port using lsof.
 * Returns true if any processes were killed.
 */
async function killPortUsersUnix() {
  try {
    const pids = execSync(
      `lsof -ti :${PORT} 2>/dev/null || true`,
      { encoding: "utf-8" }
    ).trim();

    if (!pids) return false;

    console.log(`[HIROS] Killing processes on port ${PORT}: ${pids.replace(/\n/g, " ")}`);

    try {
      execSync(`echo "${pids}" | xargs kill -15 2>/dev/null || true`, { encoding: "utf-8" });
    } catch { /* ignore */ }

    await sleep(2000);

    try {
      const survivors = execSync(
        `lsof -ti :${PORT} 2>/dev/null || true`,
        { encoding: "utf-8" }
      ).trim();
      if (survivors) {
        console.log(`[HIROS] Force-killing survivors: ${survivors.replace(/\n/g, " ")}`);
        execSync(`echo "${survivors}" | xargs kill -9 2>/dev/null || true`, { encoding: "utf-8" });
      }
    } catch { /* ignore */ }

    await sleep(3000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill ALL processes listening on PORT, platform-aware.
 */
async function killPortUsers() {
  if (process.platform === "win32") {
    return killPortUsersWindows();
  }
  return killPortUsersUnix();
}

/**
 * Check if port is free, platform-aware.
 */
async function isPortFree() {
  if (process.platform === "win32") {
    return getPidOnPortWindows(PORT) === null;
  }
  try {
    const result = execSync(
      `lsof -ti :${PORT} 2>/dev/null || true`,
      { encoding: "utf-8" }
    ).trim();
    return result === "";
  } catch {
    return true;
  }
}

/**
 * Count restarts in the current window
 */
function countRecentRestarts() {
  const cutoff = Date.now() - RESTART_WINDOW;
  while (restartTimes.length > 0 && restartTimes[0] < cutoff) {
    restartTimes.shift();
  }
  return restartTimes.length;
}

/**
 * Load .env from PROJECT_DIR so DATABASE_URL etc. are always set correctly,
 * even if the parent shell has stale values.
 */
function loadDotEnv() {
  const fs = require("fs");
  const envPath = path.join(PROJECT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
  console.log(`[HIROS] Loaded .env from ${envPath}`);
}

/**
 * Start the Next.js dev server and wait for it to exit.
 * Returns the exit code.
 */
function startServer() {
  return new Promise((resolve) => {
    console.log(`[HIROS] Starting Next.js dev server on port ${PORT}...`);

    const child = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "dev", "-p", String(PORT)],
      {
        cwd: PROJECT_DIR,
        stdio: "inherit",
        env: { ...process.env, PORT: String(PORT), NODE_ENV: "development" },
      }
    );

    child.on("error", (err) => {
      console.error(`[HIROS] Failed to start:`, err.message);
      resolve(1);
    });

    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        resolve(0);
        return;
      }

      if (code === 0) {
        console.log(`[HIROS] Server stopped normally`);
        resolve(0);
      } else {
        console.error(`[HIROS] Server crashed (code=${code}, signal=${signal})`);
        resolve(code || 1);
      }
    });
  });
}

/**
 * Main restart loop
 */
async function main() {
  console.log(`[HIROS] Dev server runner started (PROJECT_DIR=${PROJECT_DIR})`);

  loadDotEnv();

  while (!shuttingDown) {
    await killPortUsers();

    let waitCount = 0;
    while (!(await isPortFree()) && waitCount < 10) {
      console.log(`[HIROS] Port ${PORT} still in use, waiting... (${waitCount + 1}/10)`);
      await sleep(2000);
      await killPortUsers();
      waitCount++;
    }

    if (!(await isPortFree())) {
      console.error(`[HIROS] Port ${PORT} still occupied after 10 cleanup attempts. Giving up.`);
      process.exit(1);
    }

    if (countRecentRestarts() >= MAX_RESTARTS) {
      console.error(`[HIROS] Too many restarts (${MAX_RESTARTS}) in the last hour. Stopping.`);
      process.exit(1);
    }

    const exitCode = await startServer();

    if (exitCode === 0 || shuttingDown) {
      break;
    }

    restartTimes.push(Date.now());
    const recentRestarts = countRecentRestarts();
    console.log(`[HIROS] Restart #${recentRestarts}/${MAX_RESTARTS} in ${RESTART_DELAY / 1000}s...`);

    await sleep(RESTART_DELAY);
  }

  console.log(`[HIROS] Dev server runner exiting`);
  process.exit(0);
}

function handleShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[HIROS] Received ${signal}, shutting down...`);

  killPortUsers().then(() => {
    setTimeout(() => {
      console.log("[HIROS] Exiting");
      process.exit(0);
    }, 3000);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGHUP", () => handleShutdown("SIGHUP"));

process.on("uncaughtException", (err) => {
  console.error("[HIROS] Uncaught exception:", err);
  killPortUsers().then(() => process.exit(1));
});

main();
