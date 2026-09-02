#!/usr/bin/env bash
# Writes .env.local with GitHub token for automatic cloud sync (no output of token).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ -f "$ENV_FILE" ]] && grep -q '^VITE_GITHUB_TOKEN=' "$ENV_FILE"; then
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  exit 0
fi

TOKEN="$(gh auth token 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  exit 0
fi

printf 'VITE_GITHUB_TOKEN=%s\n' "$TOKEN" > "$ENV_FILE"
