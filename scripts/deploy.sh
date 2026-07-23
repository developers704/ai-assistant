#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/var/www/lindy_ai"
BRANCH="main"

cd "$REPO_DIR"

if [ "$(id -u)" -eq 0 ]; then
  echo "ERROR: deploy must not run as root (would create root-owned files in .git)."
  exit 1
fi

if [ ! -w ".git/objects" ]; then
  echo "ERROR: $(whoami) cannot write to $REPO_DIR/.git/objects"
  echo "Run once on the VPS as root:"
  echo "  sudo chown -R $(whoami):$(whoami) $REPO_DIR"
  exit 1
fi

git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "Deploying commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

mkdir -p .data/reports

npm ci
npm run build
pm2 restart all

# Rebuild sales cache so exclusion-rule bumps apply on VPS (stale .data versions otherwise stick).
echo "Refreshing sales intelligence cache..."
curl -sS -X POST http://127.0.0.1:3000/api/sales/refresh \
  -H "Content-Type: application/json" \
  -d '{"force":true,"clearMemory":true}' \
  || curl -sS -X POST http://127.0.0.1:3001/api/sales/refresh \
  -H "Content-Type: application/json" \
  -d '{"force":true,"clearMemory":true}' \
  || echo "WARN: sales refresh curl failed (app may still lazy-rebuild on next /api/sales)."

echo "Deploy finished at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
