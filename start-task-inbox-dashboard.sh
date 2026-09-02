#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Starting Task Inbox dashboard at http://127.0.0.1:5173/"
echo "Press Ctrl+C to stop."
echo

npm run serve
