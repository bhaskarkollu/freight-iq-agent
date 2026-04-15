#!/usr/bin/env bash
set -e

detect_compose() {
  if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    echo "podman compose"
    return
  fi
  if command -v podman-compose >/dev/null 2>&1; then
    echo "podman-compose"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  return 1
}

COMPOSE=$(detect_compose) || {
  echo "No supported compose tool found."
  exit 1
}

echo "Stopping FreightAI Angular containers…"
${COMPOSE} down
echo "All containers stopped."
