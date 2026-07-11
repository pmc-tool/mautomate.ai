"""
mAutomate voice-agent runtime — FastAPI control surface.

A long-running service the Medusa backend calls to start/stop a web voice call.
It is deliberately thin: it authenticates the request, spawns a per-call
`BotSession` as a fire-and-forget asyncio task, and returns 200 immediately. All
real work (join Daily, pull config, run the Pipecat pipeline, report ended)
happens inside the task so the HTTP call never blocks on media.

Endpoints
  POST /api/pipelines/start   (x-api-key)  -> spawn a bot, 200 fast
  POST /api/pipelines/stop    (x-api-key)  -> end a live session
  GET  /health                             -> 200

Isolation: each bot task is wrapped so one failing call can never crash the
server. Graceful shutdown cancels every live call and lets each report ended.

Run:
  uvicorn server:app --host 127.0.0.1 --port $VOICE_AGENT_PORT
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket
from fastapi.responses import JSONResponse

from bot import BotSession, StartParams
from config import ConfigError, Settings
from logging_config import configure_logging, get_logger

# --- boot ---------------------------------------------------------------------

try:
    SETTINGS = Settings.load()
except ConfigError as exc:
    # Configure minimal logging so the failure is emitted as one JSON line, then
    # re-raise so the process exits non-zero (pm2 will surface it).
    configure_logging("INFO")
    get_logger("voice.server").error("boot failed", extra={"error": str(exc)})
    raise

configure_logging(SETTINGS.log_level)
log = get_logger("voice.server")

# Live sessions keyed by call_id, plus the asyncio.Task driving each.
SESSIONS: Dict[str, BotSession] = {}
TASKS: Dict[str, asyncio.Task] = {}


# --- lifecycle ----------------------------------------------------------------


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info(
        "voice-agent starting",
        extra={
            "port": SETTINGS.port,
            "backend_url": SETTINGS.backend_url,
            "openai_model": SETTINGS.openai_model,
        },
    )
    yield
    # Graceful shutdown: end every live call and wait briefly for reports.
    log.info("voice-agent shutting down", extra={"live_calls": len(SESSIONS)})
    for session in list(SESSIONS.values()):
        try:
            await session.stop("server_shutdown")
        except Exception as exc:  # noqa: BLE001
            log.warning("shutdown stop failed", extra={"error": str(exc)})
    pending = [t for t in TASKS.values() if not t.done()]
    if pending:
        await asyncio.wait(pending, timeout=15)


app = FastAPI(title="mAutomate Voice Agent", lifespan=lifespan)


# --- helpers ------------------------------------------------------------------


def _auth(x_api_key: Optional[str]) -> None:
    if not x_api_key or x_api_key != SETTINGS.api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


async def _drive(session: BotSession) -> None:
    """
    Run one call to completion with full isolation. Whatever happens, the
    session is removed from the registry at the end so it cannot leak.
    """
    cid = session.call_id
    try:
        await session.run()
    except asyncio.CancelledError:
        log.info("call task cancelled", extra={"call_id": cid})
    except Exception as exc:  # noqa: BLE001 - never let one call crash the server
        log.error(
            "unhandled error in call task",
            extra={"call_id": cid, "error": str(exc)},
            exc_info=True,
        )
    finally:
        SESSIONS.pop(cid, None)
        TASKS.pop(cid, None)
        log.info("call task finished", extra={"call_id": cid, "live_calls": len(SESSIONS)})


# --- routes -------------------------------------------------------------------


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "live_calls": len(SESSIONS)})


@app.post("/api/pipelines/start")
async def start_pipeline(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
) -> JSONResponse:
    _auth(x_api_key)

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    call_id = (body.get("call_id") or "").strip()
    playbook_id = (body.get("playbook_id") or "").strip()
    tenant_id = (body.get("tenant_id") or "").strip()
    room_url = (body.get("room_url") or "").strip()

    missing = [
        name
        for name, val in (
            ("call_id", call_id),
            ("playbook_id", playbook_id),
            ("tenant_id", tenant_id),
            ("room_url", room_url),
        )
        if not val
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field(s): {', '.join(missing)}",
        )

    if call_id in SESSIONS:
        # Idempotent: a duplicate start for a live call is a no-op success.
        log.info("duplicate start ignored", extra={"call_id": call_id})
        return JSONResponse({"status": "already_running", "call_id": call_id})

    params = StartParams(
        call_id=call_id,
        playbook_id=playbook_id,
        tenant_id=tenant_id,
        room_url=room_url,
        room_name=(body.get("room_name") or None),
        locale=(body.get("locale") or None),
        order_id=(body.get("order_id") or None),
    )

    session = BotSession(params, SETTINGS)
    SESSIONS[call_id] = session
    task = asyncio.create_task(_drive(session))
    TASKS[call_id] = task

    log.info(
        "pipeline start accepted",
        extra={
            "call_id": call_id,
            "playbook_id": playbook_id,
            "tenant_id": tenant_id,
            "room_name": params.room_name,
        },
    )
    # Fire-and-forget: return 200 fast, the bot joins the room asynchronously.
    return JSONResponse({"status": "starting", "call_id": call_id})


@app.post("/api/pipelines/stop")
async def stop_pipeline(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
) -> JSONResponse:
    _auth(x_api_key)

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    call_id = (body.get("call_id") or "").strip()
    if not call_id:
        raise HTTPException(status_code=400, detail="Missing required field: call_id")

    session = SESSIONS.get(call_id)
    if not session:
        return JSONResponse({"status": "not_found", "call_id": call_id})

    log.info("pipeline stop requested", extra={"call_id": call_id})
    await session.stop("stop_requested")
    return JSONResponse({"status": "stopping", "call_id": call_id})


@app.websocket("/twilio/{call_sid}")
async def twilio_stream(websocket: WebSocket, call_sid: str) -> None:
    """
    Inbound-phone media stream. Twilio connects here (URL from the voice
    webhook's TwiML). The FIRST messages are Twilio's "connected" then "start"
    events; the "start" event carries our custom Parameters (tenant_id,
    playbook_id, call_id) set by the backend voice webhook — the caller cannot
    influence them, so the tenant/agent is trusted server-set data.
    """
    await websocket.accept()
    import json as _json

    tenant_id = ""
    playbook_id = ""
    stream_sid = ""
    started = False
    # Read framing messages until we get "start" (bounded so a bad peer can't hang us).
    for _ in range(10):
        try:
            raw = await websocket.receive_text()
        except Exception:  # noqa: BLE001
            break
        try:
            msg = _json.loads(raw)
        except Exception:  # noqa: BLE001
            continue
        if msg.get("event") == "start":
            start = msg.get("start", {})
            stream_sid = start.get("streamSid") or msg.get("streamSid") or ""
            params = start.get("customParameters", {}) or {}
            tenant_id = params.get("tenant_id", "") or ""
            playbook_id = params.get("playbook_id", "") or ""
            started = True
            break

    if not started or not tenant_id:
        log.warning("twilio stream without a valid start/tenant; closing",
                    extra={"call_sid": call_sid})
        await websocket.close(code=1008)
        return

    params = StartParams(
        call_id=call_sid,
        playbook_id=playbook_id or "",
        tenant_id=tenant_id,
        room_url="",
        room_name=None,
        locale=None,
        order_id=None,
    )
    session = BotSession(params, SETTINGS)
    SESSIONS[call_sid] = session
    log.info("twilio stream accepted", extra={
        "call_sid": call_sid, "tenant_id": tenant_id, "playbook_id": playbook_id,
        "stream_sid": stream_sid, "live_calls": len(SESSIONS)})
    try:
        await session.run_twilio_stream(websocket, stream_sid)
    except Exception as exc:  # noqa: BLE001
        log.error("twilio session crashed", extra={"call_sid": call_sid,
                  "error": str(exc)}, exc_info=True)
    finally:
        SESSIONS.pop(call_sid, None)
        log.info("twilio session finished",
                 extra={"call_sid": call_sid, "live_calls": len(SESSIONS)})
