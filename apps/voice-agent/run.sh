#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
set -a; . ./.env; set +a
exec uvicorn server:app --host 127.0.0.1 --port "${VOICE_AGENT_PORT:-8790}"
