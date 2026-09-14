#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# app/ lives inside the focus-system monorepo. GitHub Pages still publishes from
# farazified/task-inbox — do not silently push (or no-op) against the wrong root.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repo." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  cat >&2 <<'EOF'
No git remote "origin" on this monorepo.

Day-to-day code: focus-system/app
Live Pages repo:  ../task-inbox  → https://github.com/farazified/task-inbox

Either add a Pages remote here, or push from the sibling task-inbox clone.
EOF
  exit 1
fi

./scripts/ensure-cloud-sync.sh
npm run publish:tasks 2>/dev/null || true

git add -A
if git diff --staged --quiet; then
  echo "Nothing to push."
  exit 0
fi

git commit -m "Update task inbox"
git push origin main
echo "Live: https://farazified.github.io/task-inbox/"
