#!/usr/bin/env bash
# Blocks until a TCP host:port is accepting connections. Used by container
# entrypoints/CI to wait on Postgres/Redis before starting a dependent app.
set -euo pipefail

host_port="$1"
shift
host="${host_port%%:*}"
port="${host_port##*:}"
timeout="${WAIT_TIMEOUT:-60}"

elapsed=0
until (echo > "/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$timeout" ]; then
    echo "Timed out waiting for ${host}:${port}" >&2
    exit 1
  fi
  sleep 1
done

exec "$@"
