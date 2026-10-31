#!/usr/bin/env bash
# Runs the pgTAP tests in drizzle/tests. Each file rolls back after itself.
# Point DATABASE_URL_UNPOOLED at a Neon branch to test a branch instead of .env.
set -euo pipefail

cd "$(dirname "$0")/.."

url="${DATABASE_URL_UNPOOLED:-$(grep '^DATABASE_URL_UNPOOLED=' .env | cut -d= -f2- | sed -E 's/^"//; s/"$//')}"
status=0

for file in drizzle/tests/*_test.sql; do
  echo "# $file"
  output="$(psql "$url" -XAtq -v ON_ERROR_STOP=1 -f "$file" 2>&1)" || status=1
  echo "$output"
  grep -qE '^not ok|^# Looks like' <<<"$output" && status=1
done

exit "$status"
