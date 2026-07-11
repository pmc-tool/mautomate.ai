# mAutomate Voice Agent

A standalone real-time voice-agent runtime for the mAutomate call center. It
lets a user **talk to an AI agent over Daily WebRTC**: the Medusa backend creates
a Daily room, then calls this service to spawn a Pipecat bot that joins the room
as the second participant, pulls the agent's config from the control plane, and
runs a full speech pipeline (Deepgram STT -> OpenAI LLM -> ElevenLabs TTS) with
VAD and interruption handling.

Config is **pulled**, not pushed: the bot fetches everything (greeting, system
prompt, tools, voice) from `POST /telephony/agent-config` at call time.

## Architecture

```
Medusa backend ── POST /api/pipelines/start ──▶ voice-agent (this service)
                                                     │ spawns BotSession task
                                                     ▼
                                        joins Daily room (DAILY_API_KEY token)
                                                     │
        POST /telephony/agent-config  ◀────────── pulls config
        POST /telephony/tool-execute  ◀────────── on every LLM function call
        POST /telephony/call-ended    ◀────────── at hangup
```

Pipeline (built in `bot.py::_run_pipeline`):

```python
pipeline = Pipeline(
    [
        transport.input(),
        stt,                          # Deepgram, nova-2 (en) / nova-3 (other)
        context_aggregator.user(),
        llm,                          # OpenAI, system_prompt + tools
        tts,                          # ElevenLabs, voice_id from config
        transport.output(),
        context_aggregator.assistant(),
    ]
)
```

VAD: `SileroVADAnalyzer`. Interruptions: `PipelineParams(allow_interruptions=True)`.

## Files

| File                 | Purpose                                                        |
|----------------------|---------------------------------------------------------------|
| `server.py`          | FastAPI app: `/api/pipelines/start`, `/stop`, `/health`.      |
| `bot.py`             | `BotSession` — joins Daily, pulls config, runs the pipeline.  |
| `control_plane.py`   | Client for `/telephony/agent-config|tool-execute|call-ended`. |
| `config.py`          | Env-driven `Settings`.                                         |
| `logging_config.py`  | Structured JSON logging (bridges pipecat's loguru).           |
| `requirements.txt`   | Pinned deps.                                                   |
| `.env.template`      | Every env var.                                                 |

## Endpoints

### `POST /api/pipelines/start`  (header `x-api-key: $VOICE_AGENT_API_KEY`)
```json
{
  "call_id": "cc_123",
  "playbook_id": "cod-confirmation",
  "tenant_id": "ten_1",
  "room_url": "https://your-domain.daily.co/abc123",
  "room_name": "abc123",
  "locale": "bn",
  "order_id": "order_1"        // optional; forwarded to agent-config for merge data
}
```
Returns `200 {"status":"starting","call_id":"cc_123"}` immediately (the bot
joins asynchronously). Duplicate starts for a live `call_id` are a no-op success.

### `POST /api/pipelines/stop`  (header `x-api-key`)
```json
{ "call_id": "cc_123" }
```
Returns `200 {"status":"stopping"|"not_found"}`.

### `GET /health`
`200 {"status":"ok","live_calls":N}`

## Run

```bash
cd /home/ratul/brandtodoor/apps/voice-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.template .env   # then fill in

# run (env loaded by pm2 / your process manager):
uvicorn server:app --host 127.0.0.1 --port $VOICE_AGENT_PORT
```

The backend reaches this service at `VOICE_AGENT_URL` (set that env on the
backend to `http://127.0.0.1:$VOICE_AGENT_PORT`). This web runtime serves
`/api/pipelines/*`; the existing outbound telephony dialer path
(`VOICE_AGENT_URL/calls/outbound`) is a separate concern and is **not** part of
this build.

## Environment

See `.env.template`. Required at boot (service refuses to start without them):
`VOICE_AGENT_API_KEY`, `MEDUSA_BACKEND_URL`, `TELEPHONY_WEBHOOK_SECRET`,
`DAILY_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`.
Optional: `VOICE_AGENT_PORT` (8790), `DAILY_API_URL`, `OPENAI_MODEL` (gpt-4o),
`ELEVENLABS_VOICE_ID`, `VOICE_AGENT_MAX_CALL_SECONDS` (600),
`VOICE_AGENT_BOT_NAME`, `VOICE_AGENT_LOG_LEVEL`, `VOICE_AGENT_GENERATE_SUMMARY`.

## Version notes (IMPORTANT for the lead)

Targeted **pipecat-ai == 0.0.80** (Python 3.11). Pipecat's public API has moved
between minor versions; if you install a different line, re-check:

1. **Service import paths** — `bot.py` uses the namespaced modules
   (`pipecat.services.deepgram.stt`, `pipecat.services.openai.llm`,
   `pipecat.services.elevenlabs.tts`). Older lines used flat
   `pipecat.services.deepgram` etc.
2. **Function-call signature** — the tool handler takes a single
   `FunctionCallParams` (`params.function_name`, `params.arguments`,
   `params.result_callback`), the standard since ~0.0.59. On a pre-0.0.59 line
   the handler signature is positional
   `(function_name, tool_call_id, arguments, llm, context, result_callback)`.
3. **Daily token helper** — `DailyRESTHelper.get_token(room_url, expiry_time=...)`.
   `bot._mint_token` already falls back across signature variants and joins
   without a token if minting fails.
4. **`register_function(None, handler)`** registers a catch-all for every tool.

The **placeholder voice_id** problem: the `cod-confirmation` playbook ships
`voice_id: "bn-female-warm"`, which is not a real ElevenLabs voice. When the
config voice_id doesn't look like a real ElevenLabs id (20-char, no hyphen), the
bot falls back to `ELEVENLABS_VOICE_ID` — **set that env** to a real Bengali /
multilingual ElevenLabs voice, or update the playbook.
```
