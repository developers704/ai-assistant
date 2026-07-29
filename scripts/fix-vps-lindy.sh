#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/var/www/lindy_ai"

# Free 3001 leftovers from diagnostics
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

pm2 delete lindy-ai 2>/dev/null || true

# VPS package.json start is plain `next start` (defaults to 3000).
# ai-valliani already owns 3000 — must pass -p 3001 explicitly.
pm2 start npm --name lindy-ai --cwd "$REPO_DIR" -- start -- -H 0.0.0.0 -p 3001
pm2 save
sleep 6

pm2 list
ss -tlnp | grep -E ':3000 |:3001 ' || true
curl -sI http://127.0.0.1:3001/sales | head -8
curl -sI http://127.0.0.1:3001/calculator | head -8
pm2 describe lindy-ai | grep -E 'status|restarts|uptime|exec cwd|script args|unstable' || true
echo DONE
