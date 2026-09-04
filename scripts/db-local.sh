#!/usr/bin/env bash
# Project-local throwaway Postgres for machines without Docker.
# Data lives in .pgdata (gitignored). Never touches an installed service.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/.pgdata"
PORT="${PG_LOCAL_PORT:-5433}"
HOST="127.0.0.1"
LOG_FILE="$DATA_DIR/postgres.log"

find_pg_bin() {
  local dir
  if command -v initdb >/dev/null 2>&1; then
    dir="$(dirname "$(command -v initdb)")"
    echo "$dir"
    return 0
  fi
  for dir in /c/Program\ Files/PostgreSQL/*/bin /usr/lib/postgresql/*/bin \
    /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    if [ -x "$dir/initdb" ]; then
      echo "$dir"
      return 0
    fi
  done
  echo ""
}

PG_BIN="$(find_pg_bin)"
if [ -z "$PG_BIN" ]; then
  echo "PostgreSQL binaries not found. Install Postgres or use docker-compose.yml." >&2
  exit 1
fi
export PATH="$PG_BIN:$PATH"

is_running() {
  pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1
}

db_exists() {
  psql -h "$HOST" -p "$PORT" -U postgres -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1
}

ensure_db() {
  if ! db_exists "$1"; then
    createdb -h "$HOST" -p "$PORT" -U postgres "$1"
    echo "created database $1"
  fi
}

up() {
  if [ ! -d "$DATA_DIR" ]; then
    echo "initializing cluster in $DATA_DIR (port $PORT, trust auth)"
    mkdir -p "$DATA_DIR"
    # --locale=C avoids Windows locale names with non-ASCII chars (e.g. Turkish_Turkiye.1254)
    # which initdb rejects; UTF-8 encoding is set explicitly.
    initdb -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
  fi
  if ! is_running; then
    # Redirect so the daemonized server does not hold this shell's stdout open.
    pg_ctl -D "$DATA_DIR" -l "$LOG_FILE" -o "-p $PORT -h $HOST" start >/dev/null 2>&1
  fi
  ensure_db clipping_dev
  ensure_db clipping_test
  echo "local postgres ready at postgres://postgres@$HOST:$PORT (trust auth)"
}

stop() {
  if is_running; then
    pg_ctl -D "$DATA_DIR" stop
  else
    echo "not running"
  fi
}

status() {
  if is_running; then
    echo "running on port $PORT"
  else
    echo "stopped"
  fi
}

case "${1:-up}" in
  up) up ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 [up|stop|status]"; exit 1 ;;
esac
