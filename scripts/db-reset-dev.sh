#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ROOT}/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local. Copy .env.example to .env.local and fill it in." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

"${ROOT}/scripts/assert-dev.sh"

read -r -p 'Type "reset dev" to confirm: ' confirm
if [[ "$confirm" != "reset dev" ]]; then
  echo "Aborted." >&2
  exit 1
fi

npx supabase db reset --linked
