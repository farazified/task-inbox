#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

chmod +x scripts/ensure-cloud-sync.sh scripts/auto-push-live.sh 2>/dev/null || true
./scripts/ensure-cloud-sync.sh

echo "Task Inbox — auto-sync ON"
echo "  Local:  http://127.0.0.1:5173/"
echo "  Live:   https://farazified.github.io/task-inbox/"
echo "  Tasks sync to GitHub automatically. Code pushes go live on save."
echo "  Press Ctrl+C to stop."
echo

npm run dev &
DEV_PID=$!
./scripts/auto-push-live.sh &
PUSH_PID=$!

cleanup() {
  kill "$DEV_PID" "$PUSH_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$DEV_PID"
