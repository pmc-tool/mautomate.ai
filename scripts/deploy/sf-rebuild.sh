#!/usr/bin/env bash
# Storefront rebuild + deploy, run as a FILE so the build-detection pattern
# never appears in an invoking process's command line (avoids pgrep self-match).
set -u
cd /home/ratul/brandtodoor/apps/storefront || exit 9

PAT='[.]bin/next build'   # matches the real "node .../.bin/next build", not this script

# Wait up to 12 min for any real concurrent build to finish.
waited=0
while pgrep -f "$PAT" >/dev/null 2>&1; do
  if [ "$waited" -ge 720 ]; then
    echo "SLOT_BUSY_TIMEOUT after ${waited}s; running builds:"
    pgrep -af "$PAT"
    exit 3
  fi
  sleep 5
  waited=$((waited + 5))
done
echo "slot free (waited ${waited}s)"

export NODE_PATH=/home/ratul/brandtodoor/node_modules:/home/ratul/foreverfinds/node_modules
export NODE_OPTIONS=--max-old-space-size=6144
export PATH=/home/ratul/brandtodoor/node_modules/.bin:/home/ratul/foreverfinds/node_modules/.bin:$PATH

echo "=== build start ==="
next build > /tmp/sf-build-final.log 2>&1
BE=$?
echo "BUILD_EXIT=$BE"
grep -E "Compiled successfully|Build error|ENOENT|/404|Generating static" /tmp/sf-build-final.log | head

if [ "$BE" != "0" ]; then
  echo "=== FAIL tail ==="
  tail -16 /tmp/sf-build-final.log
  exit "$BE"
fi

echo "=== postbuild ==="
/home/ratul/bin/sf-postbuild.sh 2>&1 | tail -3
echo "=== restart ==="
pm2 restart b2d-storefront-next >/dev/null 2>&1 && echo restarted
sleep 8
curl -s -o /dev/null -w "health 8601/dashboard: %{http_code}\n" --max-time 15 http://127.0.0.1:8601/dashboard
echo "DONE"
