#!/usr/bin/env bash
# Phase 1 / seat 1A — normalizeDocument + facadeOf assert suite.
# No jest: bundles the TS test with the repo's own esbuild, runs with node.
# Run from apps/storefront:
#   bash src/modules/cms/document/__tests__/run-normalize-tests.sh
set -euo pipefail
cd "$(dirname "$0")/../../../../.."   # → apps/storefront
OUT="${TMPDIR:-/tmp}/cms-document-normalize-test.cjs"
# esbuild is hoisted to the workspace root's node_modules in this repo.
ESBUILD="node_modules/.bin/esbuild"
[ -x "$ESBUILD" ] || ESBUILD="../../node_modules/.bin/esbuild"
"$ESBUILD" \
  src/modules/cms/document/__tests__/normalize.test.ts \
  --bundle --platform=node --format=cjs --log-level=warning \
  --outfile="$OUT"
node "$OUT"
