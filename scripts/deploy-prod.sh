#!/usr/bin/env bash
# Deploys migrations and Edge Functions to budget-prod, then links the CLI back to budget-dev.
# There is no production reset.
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
if [[ -z "${SUPABASE_PROD_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROD_PROJECT_REF is not set in .env.local." >&2
  exit 1
fi
if [[ "$SUPABASE_PROD_PROJECT_REF" == "$SUPABASE_DEV_PROJECT_REF" ]]; then
  echo "SUPABASE_PROD_PROJECT_REF matches budget-dev. Refusing to deploy." >&2
  exit 1
fi

echo "Checking budget-dev before anything is deployed..."
"${ROOT}/scripts/assert-dev.sh"
npm run check

echo
echo "Production project ref: ${SUPABASE_PROD_PROJECT_REF}"
echo "This will push migrations and deploy Edge Functions to budget-prod."
echo "There is no reset script for production."
read -r -p 'Type "deploy prod" to continue: ' confirm
if [[ "$confirm" != "deploy prod" ]]; then
  echo "Aborted." >&2
  exit 1
fi

linked_prod=0
relink_dev() {
  local status=$?
  trap - EXIT
  if [[ "$linked_prod" -eq 0 ]]; then
    exit "$status"
  fi
  linked_prod=0
  echo "Relinking the Supabase CLI to budget-dev (${SUPABASE_DEV_PROJECT_REF})..."
  if ! npx supabase link --project-ref "$SUPABASE_DEV_PROJECT_REF"; then
    echo "Could not relink to budget-dev. Run: npx supabase link --project-ref ${SUPABASE_DEV_PROJECT_REF}" >&2
    status=1
  fi
  exit "$status"
}
trap relink_dev EXIT
linked_prod=1

npx supabase link --project-ref "$SUPABASE_PROD_PROJECT_REF"
npx supabase db push

shopt -s nullglob
for dir in "${ROOT}"/supabase/functions/*; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  if [[ "$name" == "_shared" ]]; then
    continue
  fi
  npx supabase functions deploy "$name"
done

cat <<EOF

Deployed to budget-prod (${SUPABASE_PROD_PROJECT_REF}).
Set production function secrets once, from a file that is never committed:

  npx supabase secrets set --env-file supabase/functions/.env.production

APP_URL in that file must be the live domain, with no trailing slash.
The CLI will now link back to budget-dev.
EOF
