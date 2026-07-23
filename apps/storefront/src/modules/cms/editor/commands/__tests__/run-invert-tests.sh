#!/usr/bin/env bash
# Phase 2A — command registry invert() round-trips + executor history
# semantics. No jest: bundles the TS test with the repo's own esbuild,
# runs with node (same pattern as 1A's run-normalize-tests.sh).
# Run from apps/storefront:
#   bash src/modules/cms/editor/commands/__tests__/run-invert-tests.sh
set -euo pipefail
cd "$(dirname "$0")/../../../../../.."   # → apps/storefront
OUT="${TMPDIR:-/tmp}/cms-editor-commands-invert-test.cjs"
# esbuild is hoisted to the workspace root's node_modules in this repo.
ESBUILD="node_modules/.bin/esbuild"
[ -x "$ESBUILD" ] || ESBUILD="../../node_modules/.bin/esbuild"
# --alias: the registry's import graph reaches ContainerColumnsEditor.tsx,
# which uses the app's @modules/* tsconfig path alias.
"$ESBUILD" \
  src/modules/cms/editor/commands/__tests__/invert.test.ts \
  --bundle --platform=node --format=cjs --log-level=warning \
  --alias:@modules=./src/modules \
  --outfile="$OUT"
node "$OUT"
