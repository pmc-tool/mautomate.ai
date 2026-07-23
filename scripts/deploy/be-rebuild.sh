#!/usr/bin/env bash
# Backend build + deploy. Follows the hard-won recipe:
#  - export NODE_PATH/PATH BEFORE pm2 --update-env (else PATH gets stripped -> 127)
#  - medusa build exit=1 with TS2307 is COSMETIC (swc emits JS); judge by health
#  - the build WIPES .medusa/server/.env -> restore from the canonical apps/backend/.env
#  - backend health takes ~60-90s; storefronts survive via stale-tenant-config
set -u
BE=/home/ratul/brandtodoor/apps/backend
cd "$BE" || exit 9
export NODE_PATH=/home/ratul/foreverfinds/node_modules
export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
export NODE_OPTIONS=--max-old-space-size=6144

if pgrep -f "medusa build" >/dev/null 2>&1; then
  echo "BACKEND BUILD ALREADY RUNNING — aborting to avoid collision"
  pgrep -af "medusa build"
  exit 3
fi

echo "=== medusa build ==="
medusa build > /tmp/be-build.log 2>&1
echo "BUILD_EXIT=$?"
echo "--- real errors (non-TS2307) ---"
grep -E "error|Error" /tmp/be-build.log | grep -v "TS2307" | head -15 || echo "(none besides cosmetic TS2307)"
echo "--- tail ---"; tail -4 /tmp/be-build.log

if [ ! -d "$BE/.medusa/server" ]; then
  echo "FATAL: .medusa/server not produced — NOT restarting (backend stays on old build)"
  exit 4
fi
# CRITICAL: restore the env the build wiped, from the canonical file.
if [ -f "$BE/.env" ]; then
  cp "$BE/.env" "$BE/.medusa/server/.env" && echo "env restored"
else
  echo "WARN: canonical apps/backend/.env missing — NOT restarting"; exit 5
fi

echo "=== restart backend ==="
pm2 restart b2d-backend --update-env >/dev/null 2>&1 && echo "restarted"
for i in $(seq 1 20); do
  sleep 8
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:9500/health)
  echo "health=$c"
  [ "$c" = "200" ] && { echo "BACKEND_HEALTHY"; exit 0; }
done
echo "BACKEND NOT HEALTHY after ~160s — check /tmp/be-build.log and pm2 logs"
exit 6
