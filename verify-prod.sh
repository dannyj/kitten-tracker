#!/usr/bin/env bash
#
# verify-prod.sh — run the e2e suite against a production-parity build.
#
# Why this exists: bugs like the datetime-local timezone regression only appear
# when the server's timezone differs from the browser's. Plain `next dev` on
# your laptop runs both in the same zone, so that whole class slips through. This
# harness reproduces production's config — the standalone Docker build, server in
# UTC — and drives it with the browser in a *different* zone, so TZ-sensitive
# bugs surface automatically.
#
# What it does, per target:
#   1. (once) build the standalone output and stage static/public/drizzle into it
#   2. fresh throwaway SQLite DB in a temp dir (never touches ./data)
#   3. boot `node server.js` with TZ=UTC — instrumentation.ts auto-migrates + seeds
#   4. run the matching seed-step*.cjs (synthetic data — no prod data, ever)
#   5. create the test users the e2e expects
#   6. run the e2e with the browser pinned to a non-UTC zone (CLIENT_TZ)
#   7. tear the server + temp DB down
#
# Usage:
#   ./verify-prod.sh                 # default: the rev1 weight-flow regression
#   ./verify-prod.sh all             # every target
#   ./verify-prod.sh step4 rev1      # a specific subset
#   ./verify-prod.sh --no-build all  # reuse the last build
#   CLIENT_TZ=Pacific/Auckland ./verify-prod.sh all   # exaggerate the offset
#
set -euo pipefail

cd "$(dirname "$0")"

PORT=3100
SERVER_TZ="${SERVER_TZ:-UTC}"          # matches the Docker container (prod)
CLIENT_TZ="${CLIENT_TZ:-Europe/London}" # browser zone; must differ from SERVER_TZ
ADMIN_USER=danny;  ADMIN_PASS=local-test-password-123
VIEWER_USER=viewer; VIEWER_PASS=viewer-test-pass-99
STANDALONE=.next/standalone

# target -> seed file ("" means the e2e builds its own data through the UI)
seed_for() {
  case "$1" in
    rev1)  echo "seed-step3.cjs" ;;
    step2) echo "" ;;
    step3) echo "seed-step3.cjs" ;;
    step4) echo "seed-step4.cjs" ;;
    step5) echo "seed-step5.cjs" ;;
    step6) echo "seed-step6.cjs" ;;
    step7) echo "seed-step3.cjs" ;;
    rev3)  echo "seed-rev3.cjs" ;;
    *) echo "__unknown__" ;;
  esac
}
ALL_TARGETS=(step2 step3 step4 step5 step6 step7 rev1 rev3)

# ---- args -------------------------------------------------------------------
BUILD=1
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --client-tz=*) CLIENT_TZ="${arg#*=}" ;;
    all) TARGETS=("${ALL_TARGETS[@]}") ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    *) TARGETS+=("$arg") ;;
  esac
done
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(rev1)

if [ "$SERVER_TZ" = "$CLIENT_TZ" ]; then
  echo "refusing to run: SERVER_TZ and CLIENT_TZ are both '$SERVER_TZ' — no offset to test." >&2
  exit 2
fi

SECRET="$(openssl rand -hex 32)"
SERVER_PID=""
TMP=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  [ -n "$TMP" ] && rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT

# ---- build once -------------------------------------------------------------
if [ "$BUILD" -eq 1 ]; then
  echo "▶ building standalone…"
  rm -rf .next 2>/dev/null || rm -rf .next  # retry: macOS can flake ENOTEMPTY once
  npx next build >/tmp/verify-prod-build.log 2>&1 || { echo "build failed — see /tmp/verify-prod-build.log"; exit 1; }
fi
[ -f "$STANDALONE/server.js" ] || { echo "no $STANDALONE/server.js — run without --no-build first."; exit 1; }
# Stage the bits Next's tracer doesn't copy (mirrors the Dockerfile).
rm -rf "$STANDALONE/.next/static"; cp -r .next/static "$STANDALONE/.next/static"
cp -r public "$STANDALONE/public" 2>/dev/null || true
rm -rf "$STANDALONE/drizzle"; cp -r drizzle "$STANDALONE/drizzle"

# ---- per-target run ---------------------------------------------------------
start_server() {  # $1 = db path, $2 = photos dir
  ( cd "$STANDALONE" && TZ="$SERVER_TZ" PORT="$PORT" HOSTNAME=127.0.0.1 \
      SESSION_SECRET="$SECRET" DATABASE_PATH="$1" PHOTOS_PATH="$2" \
      node server.js ) >/tmp/verify-prod-server.log 2>&1 &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null || true  # silence job-control "Terminated" on kill
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok"'; then return 0; fi
    sleep 0.5
  done
  echo "server did not become healthy — see /tmp/verify-prod-server.log"; return 1
}

stop_server() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  SERVER_PID=""
}

run_one() {  # $1 = target
  local target="$1" seed db photos
  seed="$(seed_for "$target")"
  [ "$seed" = "__unknown__" ] && { echo "  ✗ unknown target '$target'"; return 1; }
  [ -f "e2e-$target.mjs" ] || { echo "  ✗ no e2e-$target.mjs"; return 1; }

  TMP="$(mktemp -d "/tmp/verify-prod.$target.XXXXXX")"
  db="$TMP/kittens.db"; photos="$TMP/photos"; mkdir -p "$photos"

  echo "── $target  (seed: ${seed:-none}, server=$SERVER_TZ, browser=$CLIENT_TZ)"
  start_server "$db" "$photos" || { stop_server; rm -rf "$TMP"; TMP=""; return 1; }

  [ -n "$seed" ] && DATABASE_PATH="$db" node "$seed" >/dev/null
  printf '%s' "$ADMIN_PASS"  | DATABASE_PATH="$db" node scripts/create-user.cjs --username "$ADMIN_USER"  --role admin  >/dev/null
  printf '%s' "$VIEWER_PASS" | DATABASE_PATH="$db" node scripts/create-user.cjs --username "$VIEWER_USER" --role viewer >/dev/null

  local rc=0
  TZ="$CLIENT_TZ" node "e2e-$target.mjs" || rc=$?

  stop_server
  rm -rf "$TMP"; TMP=""
  return $rc
}

pass=(); fail=()
for t in "${TARGETS[@]}"; do
  if run_one "$t"; then pass+=("$t"); else fail+=("$t"); fi
done

echo
echo "════ verify-prod summary (server=$SERVER_TZ / browser=$CLIENT_TZ) ════"
[ ${#pass[@]} -gt 0 ] && echo "  PASS: ${pass[*]}"
[ ${#fail[@]} -gt 0 ] && echo "  FAIL: ${fail[*]}"
[ ${#fail[@]} -eq 0 ] && echo "  ✓ all green" || true
exit "${#fail[@]}"
