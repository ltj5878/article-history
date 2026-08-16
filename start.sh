#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
PY_BACKEND_DIR="$ROOT_DIR/backend"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"

PY_BACKEND_HOST="${PY_BACKEND_HOST:-127.0.0.1}"
PY_BACKEND_PORT="${PY_BACKEND_PORT:-8000}"
PY_BACKEND_DB_URL="${PY_BACKEND_DB_URL:-sqlite:///$PY_BACKEND_DIR/.data/content.db}"
PY_BACKEND_JWT_SECRET="${JWT_SECRET:-dev-only-change-me}"
PY_BACKEND_CORS_ORIGINS="${CORS_ORIGINS:-http://127.0.0.1:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT}"
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

# === Python content backend ===

install_python_backend_deps() {
  if [[ ! -x "$PYTHON_BIN" ]]; then
    log "Creating Python backend virtualenv..."
    python3 -m venv "$PY_BACKEND_DIR/.venv"
  fi
  if ! "$PYTHON_BIN" -c "import fastapi, sqlalchemy, psycopg, jwt, httpx, pwdlib, uvicorn" >/dev/null 2>&1; then
    log "Installing Python backend dependencies..."
    "$PYTHON_BIN" -m pip install -r "$PY_BACKEND_DIR/requirements.txt"
  fi
}

seed_python_backend() {
  # Generate the legacy static seed bundle when it is missing, then seed with
  # --if-empty so an existing (possibly partially-created) SQLite file is not
  # mistaken for a populated database. Once the DB has books it becomes
  # authoritative; build-data prefers DB-driven export.
  if [[ ! -f "$APP_DIR/public/data/books.json" ]]; then
    log "Generating static seed bundle..."
    # Prefer a populated database when one already exists; build-data falls
    # back to the legacy server modules for a fresh checkout.
    (cd "$APP_DIR" && npm run build:data)
  fi
  log "Seeding Python backend database if empty..."
  PYTHONPATH="$PY_BACKEND_DIR" "$PYTHON_BIN" -m api.seed \
    --db-url "$PY_BACKEND_DB_URL" \
    --data-dir "$APP_DIR/public/data" \
    --if-empty
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
      JWT_SECRET="$PY_BACKEND_JWT_SECRET" CORS_ORIGINS="$PY_BACKEND_CORS_ORIGINS" \
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

check_deploy() {
  install_python_backend_deps
  PYTHONPATH="$PY_BACKEND_DIR" "$PYTHON_BIN" -m api.deploy_check
}

export_static() {
  install_python_backend_deps
  PYTHONPATH="$PY_BACKEND_DIR" "$PYTHON_BIN" -m api.export_static \
    --db-url "$PY_BACKEND_DB_URL" \
    --out-dir "$APP_DIR/public/data"
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
  # Default VITE_API_BASE_URL points at the local Python backend so the
  # frontend uses the live API; the static-JSON fallback in client.js still
  # kicks in if the API is unreachable.
  local default_api="http://$PY_BACKEND_HOST:$PY_BACKEND_PORT"
  (
    cd "$APP_DIR"
    nohup env VITE_API_BASE_URL="${VITE_API_BASE_URL-$default_api}" \
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
  start_python_backend
  start_frontend
  log ""
  log "经史舆图 启动完成"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
  log "  Python 后端: http://$PY_BACKEND_HOST:$PY_BACKEND_PORT/api"
  log "  日志: $LOG_DIR/"
}

start_static_only() {
  # Static-only mode for offline / Netlify-style demos. Prefer the local
  # database when it is populated; build-data falls back to legacy modules.
  (cd "$APP_DIR" && npm run build:data)
  VITE_API_BASE_URL="" start_frontend
  log ""
  log "经史舆图 启动完成（纯静态前端）"
  log "  前端: http://$FRONTEND_HOST:$FRONTEND_PORT"
}

stop_all() {
  stop_frontend || true
  stop_python_backend || true
}

status_all() {
  status_python_backend
  status_frontend
}

usage() {
  cat <<USAGE
Usage: ./start.sh [command]

Commands:
  start                 Start Python content backend + frontend (default).
  start-static          Static-only frontend (no backend) using JSON fallback.
  stop                  Stop frontend + Python backend.
  restart               Stop everything, then start.
  status                Show running state.
  start-backend         Start only the Python content backend.
  start-frontend        Start only the frontend.
  stop-backend          Stop only the Python content backend.
  stop-frontend         Stop only the frontend.
  check-deploy          Check deployment-critical backend environment variables.
  export-static         Dump the database to app/public/data fallback artifact.
  logs [py|fe]          Tail Python backend (py) or frontend (fe); defaults to all.
  help                  Show this message.

Environment overrides:
  FRONTEND_HOST     default: 127.0.0.1
  FRONTEND_PORT     default: 5174
  PY_BACKEND_HOST   default: 127.0.0.1
  PY_BACKEND_PORT   default: 8000
  PY_BACKEND_DB_URL default: sqlite:///backend/.data/content.db
  JWT_SECRET        default: dev-only-change-me
  CORS_ORIGINS      default: local frontend origins for the configured port
  VITE_API_BASE_URL default: http://PY_BACKEND_HOST:PY_BACKEND_PORT
USAGE
}

tail_logs() {
  local target="${1:-both}"
  case "$target" in
    py|python|backend|be)
      tail -F "$PY_BACKEND_LOG_FILE"
      ;;
    fe|frontend)
      tail -F "$FRONTEND_LOG_FILE"
      ;;
    both|*)
      tail -F "$PY_BACKEND_LOG_FILE" "$FRONTEND_LOG_FILE"
      ;;
  esac
}

case "${1:-start}" in
  start)
    start_all
    ;;
  start-static)
    start_static_only
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
  start-backend|start-python-backend)
    start_python_backend
    ;;
  start-frontend)
    start_frontend
    ;;
  stop-backend|stop-python-backend)
    stop_python_backend
    ;;
  stop-frontend)
    stop_frontend
    ;;
  check-deploy)
    check_deploy
    ;;
  export-static)
    export_static
    ;;
  logs)
    tail_logs "${2:-both}"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
