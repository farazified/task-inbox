#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

chmod +x scripts/ensure-cloud-sync.sh
./scripts/ensure-cloud-sync.sh

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI first: brew install gh && gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

TOKEN="$(gh auth token)"
gh secret set INBOX_GITHUB_TOKEN --body "$TOKEN" --repo farazified/task-inbox 2>/dev/null || \
  gh secret set INBOX_GITHUB_TOKEN --body "$TOKEN"

echo "Done — live site can now sync tasks automatically."
echo "Restart your dashboard: ./start-task-inbox-dashboard.command"
