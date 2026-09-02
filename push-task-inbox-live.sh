#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo yet. Run setup first (see README)."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No GitHub remote yet. Run:"
  echo "  gh repo create task-inbox --public --source=. --remote=origin"
  echo "Then push once: git push -u origin main"
  exit 1
fi

echo "=== Push Task Inbox live (GitHub Pages) ==="
echo

git add -A

if git diff --staged --quiet; then
  echo "No file changes to commit."
else
  echo "Changed files:"
  git diff --staged --stat
  echo
  read -r -p "Commit message [Update task inbox]: " msg
  git commit -m "${msg:-Update task inbox}"
fi

echo
echo "Pushing to GitHub..."
git push origin main

echo
echo "Done — GitHub Pages rebuilds in about a minute."
echo "Live: https://farazified.github.io/task-inbox/"
