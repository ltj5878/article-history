#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
SERVER_DIR="$ROOT_DIR/server"
PY_BACKEND_DIR="$ROOT_DIR/backend"
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

PY_BACKEND_HOST="${PY_BACKEND_HOST:-127.0.0.1}"
PY_BACKEND_PORT="${PY_BACKEND_PORT:-8000}"
PY_BACKEND_DB_URL="${PY_BACKEND_DB_URL:-sqlite:///$PY_BACKEND_DIR/.data/content.db}"
PY_BACKEND_PID_FILE="$RUN_DIR/python-backend.pid"
PY_BACKEND_LOG_FILE="$LOG_DIR/python-backend.log"
PYTHON_BIN="$PY_BACKEND_DIR/.venv/bin/python"

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
    if curl --noproxy '*' -fs "http://$BACKEND_HOST:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
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

# === Python content backend ===

install_python_backend_deps() {
  if [[ ! -x "$PYTHON_BIN" ]]; then
    log "Creating Python backend virtualenv..."
    python3 -m venv "$PY_BACKEND_DIR/.venv"
  fi
  if ! "$PYTHON_BIN" -c "import fastapi, sqlalchemy, pytest" >/dev/null 2>&1; then
    log "Installing Python backend dependencies..."
    "$PYTHON_BIN" -m pip install -r "$PY_BACKEND_DIR/requirements.txt"
  fi
}

seed_python_backend() {
  if [[ ! -f "$APP_DIR/public/data/books.json" ]]; then
    log "Generating static seed data..."
    (cd "$APP_DIR" && npm run build:data)
  fi
  log "Seeding Python backend database..."
  PYTHONPATH="$PY_BACKEND_DIR" "$PYTHON_BIN" -m api.seed \
    --db-url "$PY_BACKEND_DB_URL" \
    --data-dir "$APP_DIR/public/data"
}

start_python_backend() {
  local pid
  if pid="$(service_running_pid "$PY_BACKEND_PID_FILE" "$PY_BACKEND_PORT")"; then
    log "Python backend already running on http://$PY_BACKEND_HOST:$PY_BACKEND_PORT (pid $pid)"
    printf '%s\n' "$pid" > "$PY_BACKEND_PID_FILE"
    return 0
  fi

  install_python_backend_deps
  seed_python_backend

  log "Starting Python backend on http://$PY_BACKEND_HOST:$PY_BACKEND_PORT"
  (
    cd "$PY_BACKEND_DIR"
    nohup env PYTHONPATH="$PY_BACKEND_DIR" DATABASE_URL="$PY_BACKEND_DB_URL" \
      "$PYTHON_BIN" -m uvicorn api.app:app --host "$PY_BACKEND_HOST" --port "$PY_BACKEND_PORT" \
      < /dev/null > "$PY_BACKEND_LOG_FILE" 2>&1 &
    echo $!
  ) > "$RUN_DIR/.python-backend.pid.tmp"
  pid="$(cat "$RUN_DIR/.python-backend.pid.tmp")"
  rm -f "$RUN_DIR/.python-backend.pid.tmp"
  printf '%s\n' "$pid" > "$PY_BACKEND_PID_FILE"
  disown 2>/dev/null || true
  log "Python backend started (pid $pid, log $PY_BACKEND_LOG_FILE)"

  for _ in {1..30}; do
    if curl --noproxy '*' -fs "http://$PY_BACKEND_HOST:$PY_BACKEND_PORT/api/health" >/dev/null 2>&1; then
      log "Python backend healthy"
      return 0
    fi
    sleep 0.2
  done
  log "Warning: Python backend did not respond to /api/health within 6s — see $PY_BACKEND_LOG_FILE"
}

stop_python_backend() {
  stop_service "Python backend" "$PY_BACKEND_PID_FILE" "$PY_BACKEND_PORT"
}

status_python_backend() {
  local pid
  if pid="$(service_running_pid "$PY_BACKEND_PID_FILE" "$PY_BACKEND_PORT")"; then
    log "Python backend: running on http://$PY_BACKEND_HOST:$PY_BACKEND_PORT (pid $pid)"
  else
    log "Python backend: stopped"
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
  # Frontend reads pre-built static JSON from /data — no backend needed.
  (
    cd "$APP_DIR"
    nohup env VITE_API_BASE_URL="${VITE_API_BASE_URL:-}" \
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

# Default: frontend only — the project now ships pre-built static JSON
# (app/scripts/build-data.mjs runs as a Vite predev hook), so the Express
# backend is no longer needed for normal local development.
start_all() {
  start_frontend
  log ""
  log "经史舆图 启动完成（纯前端模式）"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
  log "  日志: $LOG_DIR/"
  log ""
  log "如需同时启动旧版 Express 后端：./start.sh start-with-backend"
}

start_with_backend() {
  start_backend
  start_frontend
  log ""
  log "经史舆图 启动完成（前端 + 后端）"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
  log "  后端: http://$BACKEND_HOST:$BACKEND_PORT/api"
  log "  日志: $LOG_DIR/"
}

start_with_python_backend() {
  start_python_backend
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://$PY_BACKEND_HOST:$PY_BACKEND_PORT}" start_frontend
  log ""
  log "经史舆图 启动完成（前端 + Python 内容后端）"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
  log "  Python 后端: http://$PY_BACKEND_HOST:$PY_BACKEND_PORT/api"
  log "  日志: $LOG_DIR/"
}

stop_all() {
  stop_frontend || true
  stop_python_backend || true
  stop_backend || true
}

status_all() {
  status_python_backend
  status_backend
  status_frontend
}

usage() {
  cat <<USAGE
Usage: ./start.sh [command]

Commands:
  start                 Start frontend only — the default since the project
                        now reads pre-built static JSON and no longer needs
                        the Express backend.
  start-with-backend    Start both frontend and the legacy Express backend.
  start-with-python     Start Python content backend and frontend configured
                        to read it, with static JSON fallback in the frontend.
  stop                  Stop both (frontend + backend if running).
  restart               Stop both, then run 'start' (frontend only).
  restart-with-backend  Stop both, then run 'start-with-backend'.
  restart-with-python   Stop all, then run 'start-with-python'.
  status                Show running state of both.
  start-backend         Start only the backend.
  start-python-backend  Start only the Python content backend.
  start-frontend        Start only the frontend.
  stop-backend          Stop only the backend.
  stop-python-backend   Stop only the Python content backend.
  stop-frontend         Stop only the frontend.
  logs [be|py|fe]       Tail backend (be), Python backend (py), or frontend (fe);
                        defaults to all.
  help                  Show this message.

Environment overrides:
  FRONTEND_HOST  default: 127.0.0.1
  FRONTEND_PORT  default: 5174
  BACKEND_HOST   default: 127.0.0.1
  BACKEND_PORT   default: 4000
  PY_BACKEND_HOST default: 127.0.0.1
  PY_BACKEND_PORT default: 8000
  PY_BACKEND_DB_URL default: sqlite:///backend/.data/content.db
  VITE_API_BASE_URL default: empty for static-only frontend
USAGE
}

tail_logs() {
  local target="${1:-both}"
  case "$target" in
    be|backend)
      tail -F "$BACKEND_LOG_FILE"
      ;;
    py|python)
      tail -F "$PY_BACKEND_LOG_FILE"
      ;;
    fe|frontend)
      tail -F "$FRONTEND_LOG_FILE"
      ;;
    both|*)
      tail -F "$PY_BACKEND_LOG_FILE" "$BACKEND_LOG_FILE" "$FRONTEND_LOG_FILE"
      ;;
  esac
}

case "${1:-start}" in
  start)
    start_all
    ;;
  start-with-backend)
    start_with_backend
    ;;
  start-with-python)
    start_with_python_backend
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  restart-with-backend)
    stop_all
    start_with_backend
    ;;
  restart-with-python)
    stop_all
    start_with_python_backend
    ;;
  status)
    status_all
    ;;
  start-backend)
    start_backend
    ;;
  start-python-backend)
    start_python_backend
    ;;
  start-frontend)
    start_frontend
    ;;
  stop-backend)
    stop_backend
    ;;
  stop-python-backend)
    stop_python_backend
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
