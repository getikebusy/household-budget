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

if [[ -z "${SUPABASE_DEV_DB_URL:-}" ]]; then
  echo "SUPABASE_DEV_DB_URL is not set in .env.local." >&2
  exit 1
fi

shopt -s nullglob
files=("${ROOT}"/supabase/tests/*.sql)
if (( ${#files[@]} == 0 )); then
  echo "No SQL tests found in supabase/tests." >&2
  exit 1
fi

for file in "${files[@]}"; do
  psql "$SUPABASE_DEV_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
done
