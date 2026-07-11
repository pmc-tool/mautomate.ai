#!/usr/bin/env bash
# WAL archive command for PostgreSQL primary -> MinIO (brandtodoor-backups/wal/)
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export MC_CONFIG_DIR="$HOME/.mc"

FILE="$1"
BASENAME="$(basename "$FILE")"
# Always use the same alias configured during setup
mc cp "$FILE" "b2d-backup/brandtodoor-backups/wal/${BASENAME}" >/dev/null
