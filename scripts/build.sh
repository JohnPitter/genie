#!/usr/bin/env bash
# build.sh — full production build for Genie (Unix/macOS/WSL)
# Usage: ./scripts/build.sh [--no-frontend]
#
# Produces a single binary at ./genie (or ./genie-<os>-<arch> for cross-compiles).
# Requires: Go 1.23+, Node 20+, pnpm

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SKIP_FRONTEND=false
for arg in "$@"; do
  case "$arg" in
    --no-frontend) SKIP_FRONTEND=true ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ── 1. Frontend ──────────────────────────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  echo "==> Building frontend"
  cd apps/web
  pnpm install --frozen-lockfile
  pnpm build
  cd "$ROOT"

  echo "==> Copying frontend to embed dir"
  rm -rf apps/api/cmd/genie/webdist
  mkdir -p apps/api/cmd/genie/webdist
  cp -R apps/web/build/. apps/api/cmd/genie/webdist/
  echo "    $(find apps/api/cmd/genie/webdist -type f | wc -l | tr -d ' ') files copied"
else
  echo "==> Skipping frontend build (--no-frontend)"
fi

# ── 2. Go binary ─────────────────────────────────────────────────────────────
echo "==> Building Go binary"
cd apps/api

VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
GOOS="${GOOS:-}"
GOARCH="${GOARCH:-}"
OUTPUT="${OUTPUT:-genie}"

BUILD_ENV=""
if [ -n "$GOOS" ]; then BUILD_ENV="GOOS=$GOOS "; fi
if [ -n "$GOARCH" ]; then BUILD_ENV="${BUILD_ENV}GOARCH=$GOARCH "; fi

eval "${BUILD_ENV}go build \
  -tags embedweb \
  -ldflags \"-s -w -X main.version=${VERSION}\" \
  -o \"../../${OUTPUT}\" \
  ./cmd/genie"

cd "$ROOT"

# ── 3. Report ─────────────────────────────────────────────────────────────────
BINARY_PATH="./${OUTPUT}"
if [ -f "$BINARY_PATH" ]; then
  SIZE=$(du -h "$BINARY_PATH" | cut -f1)
  echo "==> Done: ${BINARY_PATH} (${SIZE})"
else
  echo "==> Done: ${BINARY_PATH}"
fi
