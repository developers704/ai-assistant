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

npm ci
npm run build
pm2 restart all
