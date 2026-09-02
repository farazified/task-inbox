#!/usr/bin/env bash
# Auto-commit and push code changes to GitHub (GitHub Pages rebuilds automatically).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WATCH_PATHS=(
  src
  public
  index.html
  package.json
  package-lock.json
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  netlify.toml
)

IGNORE='public/data/inbox.json|node_modules|dist|\.env'

push_if_dirty() {
  git add "${WATCH_PATHS[@]}" 2>/dev/null || true
  if git diff --staged --quiet; then
    return 0
  fi
  git commit -m "Auto-update task inbox"
  git push origin main
  echo "[auto-push] Live site updating…"
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  exit 0
fi

gh auth setup-git 2>/dev/null || true

if command -v fswatch >/dev/null 2>&1; then
  echo "[auto-push] Watching for changes (fswatch)…"
  fswatch -o "${WATCH_PATHS[@]}" 2>/dev/null | while read -r _; do
    sleep 3
    push_if_dirty || true
  done
else
  echo "[auto-push] Watching for changes (every 20s)…"
  while true; do
    sleep 20
    push_if_dirty || true
  done
fi
