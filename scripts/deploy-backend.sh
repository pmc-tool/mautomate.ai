#!/usr/bin/env bash
#
# Backend deploy (mAutomate / brandtodoor), same lock + health-gate pattern as
# deploy-storefront.sh.
#
# IMPORTANT `medusa build` QUIRK (do not "fix" this):
#   The build exits 1 with COSMETIC TypeScript errors:
#       TS2307: Cannot find module '@medusajs/framework/...'
#   swc still transpiles and emits the JS, so the output in .medusa/server is
#   complete and correct. Therefore we DO NOT treat a non-zero exit as failure.
#   Success is judged by:
#     (a) the build output dir .medusa/server was actually refreshed (its
#         entrypoint is newer than the moment we started the build), and
#     (b) after `pm2 restart b2d-backend --update-env`, http://127.0.0.1:9500/health
#         returns 200 within 120s.
#
# There is no rollback here (medusa build rewrites .medusa in place); if health
# never returns we report the failure loudly and leave it for a human.
#
set -uo pipefail

REPO="/home/ratul/brandtodoor"
APP_DIR="$REPO/apps/backend"
PM2_APP="b2d-backend"
HEALTH_URL="http://127.0.0.1:9500/health"
BUILD_OUT="$APP_DIR/.medusa/server"

LOCK_DIR="/tmp/b2d-deploy.lock"
LOCK_STALE_SECONDS=900     # 15 min
LOCK_WAIT_SECONDS=30
LOCK_MAX_TRIES=30          # ~15 min
HEALTH_TIMEOUT=120

HAVE_LOCK=0

log()  { printf '[deploy-backend] %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { log "FAILED: $*"; exit 1; }

cleanup() {
  if [ "$HAVE_LOCK" = "1" ]; then
    rmdir "$LOCK_DIR" 2>/dev/null && log "lock released"
  fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- 1. lock
acquire_lock() {
  local try=1
  while [ "$try" -le "$LOCK_MAX_TRIES" ]; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      HAVE_LOCK=1
      log "STEP 1/5 deploy lock acquired ($LOCK_DIR)"
      return 0
    fi

    local lock_mtime now age
    lock_mtime=$(stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0)
    now=$(date +%s)
    age=$(( now - lock_mtime ))
    if [ "$lock_mtime" != "0" ] && [ "$age" -gt "$LOCK_STALE_SECONDS" ]; then
      log "stale lock detected (age ${age}s > ${LOCK_STALE_SECONDS}s) - removing"
      rmdir "$LOCK_DIR" 2>/dev/null || rm -rf "$LOCK_DIR"
      continue
    fi

    log "another deploy holds the lock (age ${age}s); retry $try/$LOCK_MAX_TRIES in ${LOCK_WAIT_SECONDS}s"
    sleep "$LOCK_WAIT_SECONDS"
    try=$(( try + 1 ))
  done
  fail "could not acquire deploy lock after ~15 minutes"
}
acquire_lock

# ---------------------------------------------------------------- 2. env
export NODE_PATH=/home/ratul/foreverfinds/node_modules
export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
log "STEP 2/5 build env exported (NODE_PATH=$NODE_PATH)"

cd "$APP_DIR" || fail "cannot cd to $APP_DIR"

# ---------------------------------------------------------------- 3. build
BUILD_STARTED_MARKER="$(mktemp /tmp/b2d-build-marker.XXXXXX)"
log "STEP 3/5 running 'medusa build' (non-zero exit from cosmetic TS2307 is EXPECTED and ignored)"

medusa build
BUILD_EXIT=$?

log "medusa build exit code: $BUILD_EXIT (not used as the success signal)"

# Success signal (a): was the output actually refreshed?
ENTRY=""
for candidate in "$BUILD_OUT/index.js" "$BUILD_OUT/package.json" "$BUILD_OUT/medusa-config.js"; do
  if [ -f "$candidate" ]; then ENTRY="$candidate"; break; fi
done

if [ -z "$ENTRY" ]; then
  rm -f "$BUILD_STARTED_MARKER"
  fail "no build output found in $BUILD_OUT - the build genuinely failed, NOT restarting $PM2_APP"
fi

if [ "$ENTRY" -nt "$BUILD_STARTED_MARKER" ]; then
  log "build output refreshed ($ENTRY is newer than build start) - treating build as SUCCESS"
else
  rm -f "$BUILD_STARTED_MARKER"
  fail "build output in $BUILD_OUT is STALE (not rewritten by this build) - NOT restarting $PM2_APP"
fi
rm -f "$BUILD_STARTED_MARKER"

# ---------------------------------------------------------------- 4. restart
log "STEP 4/5 restarting pm2 process $PM2_APP"
pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || log "WARN: pm2 restart returned non-zero, continuing to health check"

# ---------------------------------------------------------------- 5. health gate
log "STEP 5/5 health check (up to ${HEALTH_TIMEOUT}s): $HEALTH_URL"
waited=0
while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)
  if [ "$code" = "200" ]; then
    log "health check 200 after ${waited}s"
    log "SUCCESS: backend deployed and healthy"
    exit 0
  fi
  sleep 3
  waited=$(( waited + 3 ))
  log "  waiting for health... ${waited}s (last=$code)"
done

log "last 30 lines of pm2 logs for $PM2_APP:"
pm2 logs "$PM2_APP" --lines 30 --nostream 2>/dev/null || true
fail "$HEALTH_URL never returned 200 within ${HEALTH_TIMEOUT}s. Backend is NOT healthy (no rollback is possible for the backend build - inspect pm2 logs above and fix forward)."
