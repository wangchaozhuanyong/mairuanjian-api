#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

run() {
  echo
  echo "==> $*"
  "$@"
}

run npm run check
run npm run prod:config:example
run npm run acceptance:business
run npm run acceptance:security

if [[ "${ACCEPTANCE_KEEP_DATA:-0}" != "1" ]]; then
  run npm run clean:dev-data -- --yes
fi

echo
echo "==> npm run backup:postgres (local Docker PostgreSQL)"
BACKUP_OUTPUT="$(
  COMPOSE_FILE=docker-compose.yml \
    ENV_FILE=.env \
    POSTGRES_DB=apple_business \
    POSTGRES_USER=postgres \
    BACKUP_DIR=backups/postgres/local \
    npm run backup:postgres
)"
printf '%s\n' "${BACKUP_OUTPUT}"

BACKUP_FILE="$(printf '%s\n' "${BACKUP_OUTPUT}" | awk -F'Backup written to ' '/Backup written to /{print $2}' | tail -1)"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Could not find generated backup file from backup output." >&2
  exit 1
fi

run env \
  COMPOSE_FILE=docker-compose.yml \
  ENV_FILE=.env \
  POSTGRES_USER=postgres \
  npm run restore:verify -- "${BACKUP_FILE}"

if [[ -f ".env.production" ]]; then
  echo
  echo "==> npm run prod:env:check"
  if npm run prod:env:check; then
    PROD_ENV_GATE="passed"
  else
    PROD_ENV_GATE="pending"
    if [[ "${REQUIRE_PROD_ENV:-0}" == "1" ]]; then
      echo "Production env check is required because REQUIRE_PROD_ENV=1." >&2
      exit 1
    fi

    echo
    echo "Production env check did not pass."
    echo "Continuing local launch acceptance and treating production env as an external/manual gate."
    echo "Set REQUIRE_PROD_ENV=1 for staging or production-equivalent release validation."
  fi
else
  PROD_ENV_GATE="missing"
  echo
  echo "==> npm run prod:env:check skipped"
  echo "Missing .env.production. Fill real production values before formal deployment."
fi

if [[ "${REQUIRE_PROD_ENV:-0}" == "1" || "${REQUIRE_MANUAL_GATES:-0}" == "1" ]]; then
  run npm run launch:gates:strict
  MANUAL_GATES_STATUS="passed"
else
  run npm run launch:gates
  MANUAL_GATES_STATUS="checked-non-strict"
fi

run npm run git:readiness

cat <<EOF

Local launch acceptance passed.

External/manual gates still required before production:
- Confirm initial Git commit and push.
- In semi_auto mode, Telegram can stay empty for first deployment; fill Bot Token and Chat ID later in /system/notifications, then send a real test message.
- Fill .env.production with real domain and production secrets, then run REQUIRE_PROD_ENV=1 npm run acceptance:launch.

Production env gate status: ${PROD_ENV_GATE}.
Manual gates status: ${MANUAL_GATES_STATUS}.
EOF
