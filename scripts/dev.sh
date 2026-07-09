#!/usr/bin/env bash
# =============================================================================
# HIROS Dev Server Manager — Permanent Fix Edition v2
# =============================================================================
# Robust Next.js dev-server manager with:
#   • Dynamic PROJECT_DIR (no hardcoded paths — works wherever the repo lives)
#   • PM2-based crash recovery (with local node_modules/.bin/pm2)
#   • Automatic stale-process / port cleanup before every start
#   • Health-check loop with timeout
#   • Log rotation (auto-truncate > 5MB)
#   • Fallback: if PM2 is unavailable, drops to nohup + restart loop
#
# Usage:
#   ./scripts/dev.sh start     - Start the server (kills stale processes first)
#   ./scripts/dev.sh stop      - Stop the server gracefully
#   ./scripts/dev.sh restart   - Restart the server
#   ./scripts/dev.sh status    - Check server status
#   ./scripts/dev.sh logs      - Tail server logs
#   ./scripts/dev.sh health    - Run a health check
#   ./scripts/dev.sh nuke      - Kill ALL processes on port 3000 and reset
# =============================================================================

set -euo pipefail

# ── Resolve PROJECT_DIR dynamically (the parent dir of this script's dir) ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${HIROS_PORT:-3000}"
APP_NAME="rcc-hiros"
LOG_FILE="$PROJECT_DIR/dev.log"
HEALTH_URL="http://localhost:$PORT"
MAX_WAIT_SECONDS=60

# ── Ensure .env is loaded (shell-inherited DATABASE_URL is overridden) ──
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_DIR/.env"
  set +a
fi

# ── Resolve PM2 path (project-local first, then global, then npx) ──
PM2=""
if [[ -x "$PROJECT_DIR/node_modules/.bin/pm2" ]]; then
  PM2="$PROJECT_DIR/node_modules/.bin/pm2"
elif command -v pm2 &>/dev/null; then
  PM2="pm2"
else
  PM2="npx --yes pm2"
fi

pm2() { command $PM2 "$@"; }

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[HIROS]${NC} $*"; }
warn() { echo -e "${YELLOW}[HIROS]${NC} $*"; }
err()  { echo -e "${RED}[HIROS]${NC} $*" >&2; }
info() { echo -e "${CYAN}[HIROS]${NC} $*"; }

# --- Process Management ---

# Find PIDs using port 3000 (excluding chrome/innocent browsers)
get_port_pids() {
  lsof -ti :$PORT 2>/dev/null | head -20 || true
}

# Find Next.js node processes
get_next_pids() {
  pgrep -f "next dev" 2>/dev/null || true
}

# Kill stale processes on port 3000
kill_stale_processes() {
  local pids
  pids=$(get_port_pids)
  if [[ -n "$pids" ]]; then
    warn "Found stale processes on port $PORT: $pids"
    echo "$pids" | xargs kill -15 2>/dev/null || true
    sleep 2

    # Force kill any survivors
    pids=$(get_port_pids)
    if [[ -n "$pids" ]]; then
      warn "Force-killing surviving processes: $pids"
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
    log "Stale processes cleaned up"
  else
    info "No stale processes on port $PORT"
  fi
}

# Stop PM2 process
stop_pm2() {
  if pm2 describe "$APP_NAME" &>/dev/null; then
    log "Stopping PM2 process '$APP_NAME'..."
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pm2 delete "$APP_NAME" 2>/dev/null || true
    sleep 1
  fi
}

# Full nuke - kill everything related to the dev server
cmd_nuke() {
  err "NUKING all dev server processes..."
  stop_pm2

  local next_pids
  next_pids=$(get_next_pids)
  if [[ -n "$next_pids" ]]; then
    warn "Killing Next.js processes: $next_pids"
    echo "$next_pids" | xargs kill -9 2>/dev/null || true
  fi

  kill_stale_processes
  log "Nuke complete. All processes terminated."
}

# --- Health Check ---

health_check() {
  local attempt=1
  local max_attempts=3

  while [[ $attempt -le $max_attempts ]]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

    if [[ "$http_code" =~ ^[2-3] ]]; then
      log "Health check PASSED (HTTP $http_code) on attempt $attempt"
      return 0
    fi
    info "Health check attempt $attempt/$max_attempts failed (HTTP $http_code)"
    sleep 2
    ((attempt++))
  done

  err "Health check FAILED after $max_attempts attempts"
  return 1
}

# Wait for server to become healthy
wait_for_healthy() {
  local elapsed=0
  while [[ $elapsed -lt $MAX_WAIT_SECONDS ]]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

    if [[ "$http_code" =~ ^[2-3] ]]; then
      log "Server is healthy! (HTTP $http_code after ${elapsed}s)"
      return 0
    fi

    sleep 2
    ((elapsed += 2))
    printf "."
  done

  echo ""
  warn "Server started but health check didn't pass within ${MAX_WAIT_SECONDS}s"
  warn "The server may still be compiling. Check logs: bun run dev:logs"
  return 1
}

# --- Ecosystem config generation (so paths are always correct) ---

ensure_ecosystem_config() {
  local ec_file="$PROJECT_DIR/ecosystem.config.js"
  cat > "$ec_file" <<EOF
module.exports = {
  apps: [
    {
      name: "$APP_NAME",
      script: "scripts/dev-runner.js",
      cwd: "$PROJECT_DIR",
      env: {
        PORT: "$PORT",
        NODE_ENV: "development",
      },
      // ── Crash Recovery ──
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      min_uptime: "10s",
      unstable_restarts: 15,

      // ── Memory Management ──
      max_memory_restart: "1500M",

      // ── Graceful Shutdown ──
      kill_timeout: 10000,
      listen_timeout: 30000,

      // ── Logging ──
      error_file: "$LOG_FILE",
      out_file: "$LOG_FILE",
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // ── No watch (Next.js has its own HMR) ──
      watch: false,

      // ── Single Instance ──
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
EOF
}

# --- Fallback runner (no PM2 required) ---
# Spawns dev-runner.js directly in the background with nohup, ensuring
# the server keeps running even if PM2 is unavailable.
fallback_nohup_start() {
  log "PM2 unavailable — falling back to nohup + dev-runner.js"
  mkdir -p "$PROJECT_DIR/.zscripts"
  local pidfile="$PROJECT_DIR/.zscripts/dev.pid"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    warn "Existing fallback runner (PID $(cat "$pidfile")) still alive — leaving it alone"
    return 0
  fi
  nohup node "$PROJECT_DIR/scripts/dev-runner.js" >> "$LOG_FILE" 2>&1 &
  echo $! > "$pidfile"
  disown $! 2>/dev/null || true
  log "Fallback runner started (PID $(cat "$pidfile"))"
}

# --- Main Commands ---

cmd_start() {
  log "Starting HIROS dev server (PROJECT_DIR=$PROJECT_DIR, PORT=$PORT)..."

  # Step 0: Ensure node_modules exist (survives session wipes)
  if [[ ! -x "$PROJECT_DIR/node_modules/.bin/next" ]]; then
    warn "node_modules missing — running bun install..."
    cd "$PROJECT_DIR"
    bun install --no-optional 2>&1 | tail -3
    DATABASE_URL="file:$PROJECT_DIR/db/custom.db" bunx prisma generate 2>&1 | tail -2
    log "Dependencies installed."
  fi

  # Step 1: Clean up stale processes
  kill_stale_processes

  # Step 2: Stop existing PM2 process if any
  stop_pm2

  # Step 3: Truncate log file if too large (>5MB)
  if [[ -f "$LOG_FILE" ]]; then
    local log_size
    log_size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [[ $log_size -gt 5242880 ]]; then
      warn "Log file is large ($(( log_size / 1024 / 1024 ))MB), truncating..."
      tail -100 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
  fi

  # Step 4: Regenerate ecosystem.config.js with the correct PROJECT_DIR
  ensure_ecosystem_config

  # Step 5: Start via PM2 (or fall back to nohup)
  if command -v node &>/dev/null && [[ -f "$PROJECT_DIR/scripts/dev-runner.js" ]]; then
    if [[ -x "$PROJECT_DIR/node_modules/.bin/pm2" ]] || command -v pm2 &>/dev/null; then
      log "Starting PM2 process '$APP_NAME'..."
      pm2 start "$PROJECT_DIR/ecosystem.config.js" --silent
      pm2 save 2>/dev/null || true
    else
      fallback_nohup_start
    fi
  else
    err "Cannot start: node or scripts/dev-runner.js missing"
    return 1
  fi

  # Step 6: Wait for health
  info "Waiting for server to be ready..."
  wait_for_healthy || warn "Health check failed — server may still be compiling. Check logs."

  # Step 7: Show status
  echo ""
  if [[ -x "$PROJECT_DIR/node_modules/.bin/pm2" ]] || command -v pm2 &>/dev/null; then
    pm2 list 2>/dev/null || true
  fi
  echo ""
  log "Dev server running on port $PORT"
  log "Logs: bun run dev:logs"
  log "Status: bun run dev:status"
}

cmd_stop() {
  log "Stopping HIROS dev server..."
  stop_pm2

  # Also kill fallback runner if active
  local pidfile="$PROJECT_DIR/.zscripts/dev.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      warn "Killing fallback runner PID $pid"
      kill -15 "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi

  kill_stale_processes
  log "Server stopped"
}

cmd_restart() {
  log "Restarting HIROS dev server..."
  cmd_stop
  sleep 1
  cmd_start
}

cmd_status() {
  info "PM2 Status:"
  pm2 list 2>/dev/null || warn "PM2 not running"
  echo ""
  info "Port $PORT:"
  local pids
  pids=$(get_port_pids)
  if [[ -n "$pids" ]]; then
    log "Processes on port $PORT: $pids"
  else
    warn "No processes on port $PORT"
  fi
  echo ""
  info "Health Check:"
  health_check
}

cmd_logs() {
  if pm2 describe "$APP_NAME" &>/dev/null; then
    pm2 logs "$APP_NAME" --lines 50
  else
    warn "PM2 process not found — tailing $LOG_FILE instead"
    tail -n 50 -f "$LOG_FILE"
  fi
}

cmd_health() {
  health_check
}

# --- Main ---

case "${1:-}" in
  start)   cmd_start   ;;
  stop)    cmd_stop    ;;
  restart) cmd_restart ;;
  status)  cmd_status  ;;
  logs)    cmd_logs    ;;
  health)  cmd_health  ;;
  nuke)    cmd_nuke    ;;
  *)
    echo "HIROS Dev Server Manager"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs|health|nuke}"
    echo ""
    echo "  start    - Start the server (cleans stale processes first)"
    echo "  stop     - Stop the server gracefully"
    echo "  restart  - Restart the server"
    echo "  status   - Check server & PM2 status"
    echo "  logs     - Tail server logs"
    echo "  health   - Run a health check"
    echo "  nuke     - Kill ALL processes and reset (use if stuck)"
    exit 1
    ;;
esac
