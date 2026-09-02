#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

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
