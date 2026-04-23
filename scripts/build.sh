#!/usr/bin/env bash
# build.sh — full production build for Genie (Unix/macOS/WSL)
# Usage: ./scripts/build.sh [--api-only] [--web-only]
#
# Builds the TypeScript API (tsup → dist/) and the SvelteKit frontend (build/).
# Requires: Node 22+, pnpm

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_ONLY=false
WEB_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --api-only) API_ONLY=true ;;
    --web-only) WEB_ONLY=true ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ── 1. Frontend ──────────────────────────────────────────────────────────────
if [ "$API_ONLY" = false ]; then
  echo "==> Building frontend (SvelteKit)"
  cd apps/web
  pnpm build
  cd "$ROOT"
  echo "    Output: apps/web/build/"
fi

# ── 2. API ───────────────────────────────────────────────────────────────────
if [ "$WEB_ONLY" = false ]; then
  echo "==> Building API (tsup)"
  cd apps/api
  pnpm build
  cd "$ROOT"
  echo "    Output: apps/api/dist/"
fi

echo "==> Done"
