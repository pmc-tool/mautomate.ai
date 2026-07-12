#!/usr/bin/env bash
#
# Atomic storefront deploy (mAutomate / brandtodoor).
#
# WHY: the old procedure ran `npx next build` *inside* the live serving
# directory while pm2 was serving from it. `next build` truncates/rewrites
# `.next/` at the start of the build, so the running server lost
# `.next/required-server-files.json` mid-build and every request 500'd for
# the duration (real production outage).
#
# HOW THIS FIXES IT:
#   1. Build into a STAGING dir (`.next-build`) via NEXT_DIST_DIR, which
#      apps/storefront/next.config.js already honours:
#          distDir: process.env.NEXT_DIST_DIR || ".next"
#      The live `.next` is never touched while the build runs. `npm run build`
#      and `next dev` with no env var set keep using `.next` exactly as before.
#   2. Only on a successful build, swap atomically:
#          .next -> .next-prev   (one generation kept for rollback)
#          .next-build -> .next
#      then restart pm2.
#   3. Health-gate the restart; roll back to .next-prev if it never goes green.
#
set -uo pipefail

REPO="/home/ratul/brandtodoor"
APP_DIR="$REPO/apps/storefront"
PM2_APP="b2d-storefront-next"
HEALTH_URL="http://127.0.0.1:8601/dashboard"
LIVE_DIR="$APP_DIR/.next"
STAGE_DIR="$APP_DIR/.next-build"
PREV_DIR="$APP_DIR/.next-prev"

LOCK_DIR="/tmp/b2d-deploy.lock"
LOCK_STALE_SECONDS=900     # 15 min
LOCK_WAIT_SECONDS=30
LOCK_MAX_TRIES=30          # 30 * 30s = ~15 min
HEALTH_TIMEOUT=120

HAVE_LOCK=0

log()  { printf '[deploy-storefront] %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
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
      log "STEP 1/6 deploy lock acquired ($LOCK_DIR)"
      return 0
    fi

    # Stale lock? (mtime older than LOCK_STALE_SECONDS)
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
# CRITICAL: shared hoisted node_modules live under /home/ratul/foreverfinds.
export NODE_PATH=/home/ratul/foreverfinds/node_modules
export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
log "STEP 2/6 build env exported (NODE_PATH=$NODE_PATH)"

cd "$APP_DIR" || fail "cannot cd to $APP_DIR"

# ---------------------------------------------------------------- 3. staged build
rm -rf "$STAGE_DIR"
log "STEP 3/6 building Next.js into staging dir .next-build (live .next untouched)"

# package.json's `build` script is `node scripts/audit-themes.mjs && next build`.
# Keep parity by running the theme audit first, but only as a WARNING - a theme
# lint failure must not be the thing that blocks a production hotfix.
if [ -f "scripts/audit-themes.mjs" ]; then
  node scripts/audit-themes.mjs || log "WARN: theme audit reported issues (continuing)"
fi

# NEXT_DIST_DIR is read by next.config.js -> distDir. Scoped to this command
# only, so it can never leak into `next start` (which must serve from .next).
if ! NEXT_DIST_DIR=".next-build" npx next build; then
  rm -rf "$STAGE_DIR"
  fail "next build exited non-zero - live .next left untouched, nothing deployed"
fi

if [ ! -f "$STAGE_DIR/required-server-files.json" ]; then
  rm -rf "$STAGE_DIR"
  fail "build produced no $STAGE_DIR/required-server-files.json - refusing to swap"
fi
log "build OK - staging output validated"

# ---------------------------------------------------------------- 4. atomic swap
log "STEP 4/6 swapping build in (.next -> .next-prev, .next-build -> .next)"
rm -rf "$PREV_DIR"
if [ -d "$LIVE_DIR" ]; then
  mv "$LIVE_DIR" "$PREV_DIR" || fail "could not move $LIVE_DIR aside"
fi
if ! mv "$STAGE_DIR" "$LIVE_DIR"; then
  # put the old build back immediately
  [ -d "$PREV_DIR" ] && mv "$PREV_DIR" "$LIVE_DIR"
  fail "could not move staged build into place (previous build restored)"
fi

# ---------------------------------------------------------------- 5. restart
# Make sure the staging var never reaches the long-running server process.
unset NEXT_DIST_DIR
log "STEP 5/6 restarting pm2 process $PM2_APP"
pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || log "WARN: pm2 restart returned non-zero, continuing to health check"

# ---------------------------------------------------------------- 6. health gate
health_ok() {
  local waited=0 code
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)
    if [ "$code" = "200" ]; then
      log "health check 200 after ${waited}s ($HEALTH_URL)"
      return 0
    fi
    sleep 3
    waited=$(( waited + 3 ))
    log "  waiting for health... ${waited}s (last=$code)"
  done
  return 1
}

log "STEP 6/6 health check (up to ${HEALTH_TIMEOUT}s): $HEALTH_URL"
if health_ok; then
  log "SUCCESS: storefront deployed and healthy (previous build kept at .next-prev)"
  exit 0
fi

# ---------------------------------------------------------------- rollback
log "health check NEVER returned 200 - ROLLING BACK to .next-prev"
if [ ! -d "$PREV_DIR" ]; then
  fail "no .next-prev to roll back to; storefront is DOWN and needs manual attention"
fi
rm -rf "$APP_DIR/.next-bad"
mv "$LIVE_DIR" "$APP_DIR/.next-bad" 2>/dev/null
mv "$PREV_DIR" "$LIVE_DIR" || fail "ROLLBACK FAILED - storefront is DOWN, manual attention required"
pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1
log "rolled back; re-verifying health"
if health_ok; then
  log "FAILED: new build was unhealthy. Rolled back to previous build, which is now serving (bad build saved at .next-bad)."
  exit 1
fi
fail "new build unhealthy AND rollback did not come back healthy - storefront is DOWN, manual attention required"
