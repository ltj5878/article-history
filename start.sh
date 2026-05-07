#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
SERVER_DIR="$ROOT_DIR/server"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
BACKEND_LOG_FILE="$LOG_DIR/backend.log"

mkdir -p "$RUN_DIR" "$LOG_DIR"

log() {
  printf '%s\n' "$*"
}

pid_is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    tr -d '[:space:]' < "$file"
  fi
  return 0
}

port_pid() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

# === Generic process helpers parameterised on (label, dir, host, port, pid_file, log_file, run_cmd) ===

service_running_pid() {
  local pid_file="$1" port="$2"
  local pid
  pid="$(read_pid_file "$pid_file")"
  if pid_is_running "$pid"; then
    printf '%s\n' "$pid"
    return 0
  fi

  pid="$(port_pid "$port")"
  if [[ -n "$pid" ]] && pid_is_running "$pid"; then
    printf '%s\n' "$pid"
    return 0
  fi

  return 1
}

stop_service() {
  local label="$1" pid_file="$2" port="$3"
  local pid
  pid="$(read_pid_file "$pid_file")"

  if pid_is_running "$pid"; then
    log "Stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! pid_is_running "$pid"; then
        break
      fi
      sleep 0.2
    done
    if pid_is_running "$pid"; then
      log "$label did not exit after SIGTERM; leaving it running (pid $pid)"
      return 1
    fi
    rm -f "$pid_file"
    return 0
  fi

  pid="$(port_pid "$port")"
  if [[ -n "$pid" ]] && pid_is_running "$pid"; then
    log "Stopping process listening on port $port (pid $pid)"
    kill "$pid" 2>/dev/null || true
    rm -f "$pid_file"
    return 0
  fi

  rm -f "$pid_file"
  log "$label is not running"
}

# === Backend ===

install_backend_deps() {
  if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
    log "Installing backend dependencies..."
    (cd "$SERVER_DIR" && npm install)
  fi
}

start_backend() {
  local pid
  if pid="$(service_running_pid "$BACKEND_PID_FILE" "$BACKEND_PORT")"; then
    log "Backend already running on http://$BACKEND_HOST:$BACKEND_PORT (pid $pid)"
    printf '%s\n' "$pid" > "$BACKEND_PID_FILE"
    return 0
  fi

  install_backend_deps

  log "Starting backend on http://$BACKEND_HOST:$BACKEND_PORT"
  # Detach: nohup + disown + redirect all 3 streams so the child can survive
  # the parent shell exiting and won't keep the terminal busy.
  (
    cd "$SERVER_DIR"
    nohup env PORT="$BACKEND_PORT" node index.js < /dev/null > "$BACKEND_LOG_FILE" 2>&1 &
    echo $!
  ) > "$RUN_DIR/.backend.pid.tmp"
  pid="$(cat "$RUN_DIR/.backend.pid.tmp")"
  rm -f "$RUN_DIR/.backend.pid.tmp"
  printf '%s\n' "$pid" > "$BACKEND_PID_FILE"
  disown 2>/dev/null || true
  log "Backend started (pid $pid, log $BACKEND_LOG_FILE)"

  # Wait briefly for health check to pass so the frontend doesn't see a cold backend
  for _ in {1..30}; do
    if curl -fs "http://$BACKEND_HOST:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
      log "Backend healthy"
      return 0
    fi
    sleep 0.2
  done
  log "Warning: backend did not respond to /api/health within 6s — see $BACKEND_LOG_FILE"
}

stop_backend() {
  stop_service "Backend" "$BACKEND_PID_FILE" "$BACKEND_PORT"
}

status_backend() {
  local pid
  if pid="$(service_running_pid "$BACKEND_PID_FILE" "$BACKEND_PORT")"; then
    log "Backend:  running on http://$BACKEND_HOST:$BACKEND_PORT (pid $pid)"
  else
    log "Backend:  stopped"
  fi
}

# === Frontend ===

install_frontend_deps() {
  if [[ ! -d "$APP_DIR/node_modules" ]]; then
    log "Installing frontend dependencies..."
    (cd "$APP_DIR" && npm install)
  fi
}

start_frontend() {
  local pid
  if pid="$(service_running_pid "$FRONTEND_PID_FILE" "$FRONTEND_PORT")"; then
    log "Frontend already running on http://$FRONTEND_HOST:$FRONTEND_PORT (pid $pid)"
    printf '%s\n' "$pid" > "$FRONTEND_PID_FILE"
    return 0
  fi

  install_frontend_deps

  log "Starting frontend on http://$FRONTEND_HOST:$FRONTEND_PORT"
  # Detach: nohup + disown + redirect all 3 streams (npm run dev keeps the
  # terminal busy if stdin isn't closed; vite's dev server stdout otherwise
  # buffers through the parent shell and looks like a hang).
  (
    cd "$APP_DIR"
    nohup env VITE_API_BASE="http://$BACKEND_HOST:$BACKEND_PORT/api" \
      npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
      < /dev/null > "$FRONTEND_LOG_FILE" 2>&1 &
    echo $!
  ) > "$RUN_DIR/.frontend.pid.tmp"
  pid="$(cat "$RUN_DIR/.frontend.pid.tmp")"
  rm -f "$RUN_DIR/.frontend.pid.tmp"
  printf '%s\n' "$pid" > "$FRONTEND_PID_FILE"
  disown 2>/dev/null || true
  log "Frontend started (pid $pid, log $FRONTEND_LOG_FILE)"
}

stop_frontend() {
  stop_service "Frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"
}

status_frontend() {
  local pid
  if pid="$(service_running_pid "$FRONTEND_PID_FILE" "$FRONTEND_PORT")"; then
    log "Frontend: running on http://$FRONTEND_HOST:$FRONTEND_PORT (pid $pid)"
  else
    log "Frontend: stopped"
  fi
}

# === Combined commands ===

start_all() {
  start_backend
  start_frontend
  log ""
  log "经史舆图 启动完成"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
  log "  后端: http://$BACKEND_HOST:$BACKEND_PORT/api"
  log "  日志: $LOG_DIR/"
}

stop_all() {
  stop_frontend || true
  stop_backend || true
}

status_all() {
  status_backend
  status_frontend
}

usage() {
  cat <<USAGE
Usage: ./start.sh [command]

Commands:
  start              Start backend + frontend (default)
  stop               Stop both
  restart            Stop then start both
  status             Show running state of both
  start-backend      Start only the backend
  start-frontend     Start only the frontend
  stop-backend       Stop only the backend
  stop-frontend      Stop only the frontend
  logs [be|fe]       Tail backend (be) or frontend (fe) log; defaults to both
  help               Show this message

Environment overrides:
  FRONTEND_HOST  default: 127.0.0.1
  FRONTEND_PORT  default: 5174
  BACKEND_HOST   default: 127.0.0.1
  BACKEND_PORT   default: 4000
USAGE
}

tail_logs() {
  local target="${1:-both}"
  case "$target" in
    be|backend)
      tail -F "$BACKEND_LOG_FILE"
      ;;
    fe|frontend)
      tail -F "$FRONTEND_LOG_FILE"
      ;;
    both|*)
      tail -F "$BACKEND_LOG_FILE" "$FRONTEND_LOG_FILE"
      ;;
  esac
}

case "${1:-start}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  start-backend)
    start_backend
    ;;
  start-frontend)
    start_frontend
    ;;
  stop-backend)
    stop_backend
    ;;
  stop-frontend)
    stop_frontend
    ;;
  logs)
    tail_logs "${2:-both}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
