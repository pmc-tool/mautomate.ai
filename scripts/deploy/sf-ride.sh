#!/usr/bin/env bash
# RIDE-ONLY storefront recovery: never starts its own build (so it can never
# orphan one). It waits for whatever build is in flight to finish, then restarts
# the storefront onto the completed .next and health-checks. If the build tree
# stays incomplete with no build running for a while, it reports and exits so a
# human decides (rather than spawning a competing build).
set -u
SF=/home/ratul/mautomate/apps/storefront
D="$SF/.next"
PAT='[.]bin/next build'

complete() {
  [ -f "$D/BUILD_ID" ] && [ -f "$D/prerender-manifest.json" ] && \
  [ -f "$D/routes-manifest.json" ] && [ -f "$D/build-manifest.json" ]
}

idle_incomplete=0
for i in $(seq 1 120); do   # ~20 min max
  if pgrep -f "$PAT" >/dev/null 2>&1; then
    echo "[$i] build in flight — waiting"
    idle_incomplete=0
    sleep 10; continue
  fi

  if complete; then
    echo "[$i] .next complete + no build running — restarting"
    /home/ratul/bin/sf-postbuild.sh >/dev/null 2>&1
    pm2 restart mautomate-storefront >/dev/null 2>&1
    ok=0
    for j in 1 2 3 4 5 6 7 8; do
      sleep 5
      c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 http://127.0.0.1:8601/dashboard)
      echo "  health=$c"
      if [ "$c" = "200" ]; then ok=1; break; fi
      # if a new build wiped .next mid-boot, bail out of the health wait early
      if ! complete; then echo "  .next wiped again mid-boot"; break; fi
    done
    [ "$ok" = "1" ] && { echo "RECOVERED"; exit 0; }
    echo "[$i] not healthy yet; will re-evaluate"
    sleep 4; continue
  fi

  # no build running and .next incomplete
  idle_incomplete=$((idle_incomplete + 1))
  echo "[$i] .next incomplete and NO build running (idle $idle_incomplete)"
  if [ "$idle_incomplete" -ge 6 ]; then
    echo "STUCK: .next incomplete with nobody building for ~1min — needs a build"
    exit 4
  fi
  sleep 10
done
echo "TIMEOUT after ~20min"
exit 3
