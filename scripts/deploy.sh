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

# Clean previous build so clients never request missing chunk hashes.
rm -rf .next

npm ci
npm run build

# Reload ONLY this app after .next is fully written.
# NEVER use `pm2 restart all` — other apps (docusign / ai-valliani on :3000) share this PM2.
# package.json start is plain `next start` (defaults to 3000) — always pass -p 3001.
if pm2 describe lindy-ai >/dev/null 2>&1; then
  pm2 delete lindy-ai
fi
# Drop orphans that would cause EADDRINUSE / dual-PM2 chunk mismatches
fuser -k 3001/tcp 2>/dev/null || true
sleep 1
pm2 start npm --name lindy-ai --cwd "$REPO_DIR" -- start -- -H 0.0.0.0 -p 3001
pm2 save

# Sales rebuild is heavy — do it in the background so login/open stay responsive after deploy.
echo "Scheduling background sales cache refresh (45s delay)..."
(
  sleep 45
  curl -sS -m 300 -X POST http://127.0.0.1:3001/api/sales/refresh \
    -H "Content-Type: application/json" \
    -d '{"force":true,"clearMemory":true}' \
    || echo "WARN: sales refresh curl failed (app may still lazy-rebuild on next /api/sales)."
) >/tmp/lindy-sales-refresh.log 2>&1 &

echo "Deploy finished at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Commit on disk: $(git rev-parse --short HEAD)"
echo "Note: sales cache refresh runs in background — first login should stay fast."
