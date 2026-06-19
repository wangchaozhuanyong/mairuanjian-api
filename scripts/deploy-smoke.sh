#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "Checking admin: ${BASE_URL}"
curl --fail --silent --show-error "${BASE_URL}/" >/dev/null

echo "Checking API live health"
curl --fail --silent --show-error "${BASE_URL}/api/health/live" >/dev/null

echo "Checking API ready health"
curl --fail --silent --show-error "${BASE_URL}/api/health/ready" >/dev/null

echo "Production smoke check passed."
