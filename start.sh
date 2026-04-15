#!/usr/bin/env bash
set -e

BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
ORANGE='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}▸ $1${NC}"; }
ok()     { echo -e "${GREEN}  ✓ $1${NC}"; }
warn()   { echo -e "${ORANGE}  ⚠ $1${NC}"; }
err()    { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

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

echo -e "\n${BOLD}FreightAI Angular — Invoice Intelligence Platform${NC}"
echo -e "──────────────────────────────────────────────────"

header "Checking prerequisites"
COMPOSE=$(detect_compose) || err "No supported compose tool found — install Podman or Docker with compose support"
ENGINE=${COMPOSE%% *}

if [ "$COMPOSE" = "podman-compose" ]; then
  ok "Compose: $(podman-compose version 2>/dev/null | head -1)"
elif [ "$COMPOSE" = "docker-compose" ]; then
  ok "Compose: $(docker-compose version 2>/dev/null | head -1)"
else
  ok "Engine: $($ENGINE --version | head -1)"
  ok "Compose: $($ENGINE compose version 2>/dev/null | head -1)"
fi

header "Stopping existing containers"
$COMPOSE down --remove-orphans 2>/dev/null && ok "Cleaned up" || true

header "Building images & starting containers"
$COMPOSE up --build -d

header "Waiting for FastAPI backend"
MAX=60; COUNT=0
until curl -sf http://localhost:8000/health >/dev/null 2>&1; do
  COUNT=$((COUNT+1))
  [ "$COUNT" -ge "$MAX" ] && warn "API timeout — check: $COMPOSE logs api" && break
  echo -n "."; sleep 1
done
ok "API is healthy"

header "Smoke test (30 invoices)"
RESULT=$(curl -sf -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"show all invoices"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total_count'])" 2>/dev/null || echo "0")
[ "$RESULT" = "30" ] && ok "30 invoices loaded" || warn "Got $RESULT (expected 30)"

echo ""
echo -e "${BOLD}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}  FreightAI Angular is running!${NC}"
echo -e "${BOLD}──────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}Angular UI:${NC}   http://localhost:4200"
echo -e "  ${BOLD}API:${NC}          http://localhost:8000"
echo -e "  ${BOLD}API Docs:${NC}     http://localhost:8000/docs"
echo -e "  ${BOLD}Health:${NC}       http://localhost:8000/health"
echo ""
echo -e "  ${BOLD}NLP query examples:${NC}"
echo -e "  ${CYAN}  'show all invoices'${NC}"
echo -e "  ${CYAN}  'overdue invoices for Acme Logistics'${NC}"
echo -e "  ${CYAN}  'paid invoices over \$10,000'${NC}"
echo -e "  ${CYAN}  'disputed in Q2'${NC}"
echo -e "  ${CYAN}  'summary format pending'${NC}"
echo ""
echo -e "  Stop: ./stop.sh   |   Logs: $COMPOSE logs -f"
echo ""
