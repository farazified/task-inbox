#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null; then
  echo "GitHub CLI (gh) is required."
  exit 1
fi

TOKEN="$(gh auth token)"
cat > .env.local <<EOF
VITE_GITHUB_TOKEN=$TOKEN
EOF

echo "Wrote .env.local with your GitHub token for local sync."
echo
echo "Optional — enable edits from your phone on the live site:"
echo "  https://farazified.github.io/task-inbox/?saveToken=$TOKEN"
echo
echo "Remove saveToken from the URL after it loads once."
