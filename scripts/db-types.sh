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

if [[ -z "${SUPABASE_DEV_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_DEV_PROJECT_REF is not set in .env.local." >&2
  exit 1
fi

npx supabase gen types typescript --project-id "$SUPABASE_DEV_PROJECT_REF" --schema public > "${ROOT}/src/types/database.ts"
