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

REF_FILE="${ROOT}/supabase/.temp/project-ref"
if [[ ! -f "$REF_FILE" ]]; then
  echo "No linked project found at supabase/.temp/project-ref. Run supabase link against budget-dev first." >&2
  exit 1
fi

linked="$(tr -d '[:space:]' < "$REF_FILE")"
if [[ "$linked" != "$SUPABASE_DEV_PROJECT_REF" ]]; then
  echo "Linked project ref is '${linked}', expected SUPABASE_DEV_PROJECT_REF='${SUPABASE_DEV_PROJECT_REF}'." >&2
  echo "Aborting so budget-prod is not changed." >&2
  exit 1
fi
