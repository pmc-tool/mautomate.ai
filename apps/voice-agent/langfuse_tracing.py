"""
Guarded Langfuse tracing for the voice pipeline (super-admin LLM cost visibility).

Design goals — this module is ADDITIVE and ISOLATED:
  * If LANGFUSE_ENABLED != "1" or keys are missing, every entry point is a
    no-op. Nothing is imported that isn't needed, nothing raises.
  * NO tracing error may ever propagate into the call pipeline. Every public
    function and every langfuse call is wrapped in try/except and, at worst,
    logs at debug/warning and returns. Both Pixi voice and the Ava call
    center run through the same process, so a bug here must never affect a call.

What it records (per CALL, keyed by call_id):
  * a langfuse TRACE named "voice.call" with metadata
    { tenant_id, playbook_id (jarvis / ava / ...), locale, provider, model }
    and tags ["voice", "playbook:<id>"] so super-admin can separate Pixi
    vs Ava spend.
  * one GENERATION per LLM completion/turn, capturing model + token usage
    (prompt/completion/total) and LLM time-to-first-byte as latency, sourced
    from pipecat's own metrics frames (enable_metrics / enable_usage_metrics
    are already on). Cost is derived by Langfuse from model + tokens.

The per-turn data is collected via a pipecat Observer (LangfuseMetricsObserver)
attached to the PipelineTask — observers only OBSERVE frames, they never modify
the pipeline, so turn-taking / STT / TTS / tool-calling are untouched.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from logging_config import get_logger

log = get_logger("voice.langfuse")

_ENABLED: bool = False
_CLIENT: Any = None


def init() -> None:
    """Initialise the module-level Langfuse client from the environment.

    Call once at process startup (server lifespan). Fully guarded: any problem
    leaves tracing disabled and the voice-agent otherwise unaffected.
    """
    global _ENABLED, _CLIENT
    try:
        if os.environ.get("LANGFUSE_ENABLED", "") != "1":
            log.info("langfuse tracing disabled (LANGFUSE_ENABLED != 1)")
            return
        public_key = os.environ.get("LANGFUSE_PUBLIC_KEY", "") or ""
        secret_key = os.environ.get("LANGFUSE_SECRET_KEY", "") or ""
        host = os.environ.get("LANGFUSE_HOST", "") or "http://127.0.0.1:3010"
        if not public_key or not secret_key:
            log.warning("langfuse enabled but keys missing; tracing stays off")
            return
        from langfuse import Langfuse

        _CLIENT = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
            # Never let telemetry noise or a slow ingest endpoint hurt a call.
            threads=1,
            flush_at=1,
            timeout=5,
            sdk_integration="mautomate-voice-agent",
        )
        _ENABLED = True
        log.info("langfuse tracing initialized", extra={"host": host})
    except Exception as exc:  # noqa: BLE001
        _ENABLED = False
        _CLIENT = None
        log.warning("langfuse init failed; tracing off", extra={"error": str(exc)[:200]})


def enabled() -> bool:
    return bool(_ENABLED and _CLIENT is not None)


class CallTrace:
    """Thin, always-safe wrapper around a langfuse trace for one call.

    Holds the real trace object, or None when tracing is off / failed — callers
    never need to branch, they just call log_generation()/end() unconditionally.
    """

    def __init__(
        self,
        trace: Any,
        meta: Dict[str, Any],
        llm_pricing: Optional[Dict[str, Any]] = None,
    ):
        self._trace = trace
        self._meta = meta or {}
        # Optional explicit LLM token pricing (with prompt-cache discount). When
        # `apply` is truthy the per-turn LLM cost is computed here and attached
        # as the generation's `cost_details`, so the cache discount is reflected
        # regardless of the Langfuse model price table. Empty/None => fall back
        # to Langfuse's own model-based pricing (unchanged behaviour). Only the
        # Pixi/Novita path enables this; Ava/OpenAI are untouched.
        self._llm_pricing = llm_pricing or {}
        self._turn = 0
        # Accumulators filled by the observer over the life of the call and read
        # back at finalization to price TTS. `_tts_chars` is the MEASURED count
        # of characters the TTS service synthesized (sum of TTSTextFrame text);
        # `_bot_speaking_s` is a fallback used to ESTIMATE characters only when
        # no TTSTextFrame was seen (e.g. an unexpected TTS path). Both are pure
        # observations and never influence the call.
        self._tts_chars = 0
        self._bot_speaking_s = 0.0

    def add_tts_chars(self, n: int) -> None:
        """Observer hook: add measured synthesized characters. Never raises."""
        try:
            if n and n > 0:
                self._tts_chars += int(n)
        except Exception:  # noqa: BLE001
            pass

    def add_bot_speaking_s(self, seconds: float) -> None:
        """Observer hook: add a bot-speaking interval (fallback char estimate)."""
        try:
            if seconds and seconds > 0:
                self._bot_speaking_s += float(seconds)
        except Exception:  # noqa: BLE001
            pass

    def active(self) -> bool:
        return self._trace is not None

    def _price_llm_turn(
        self,
        *,
        prompt_tokens: Optional[int],
        completion_tokens: Optional[int],
        cached_tokens: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        """Compute the cache-discounted USD cost for one LLM turn.

        Returns a dict {input, output, total, cached_tokens, uncached_input,
        cache_source} when explicit pricing is enabled for this trace, else
        None (caller then leaves LLM pricing to Langfuse's model table — the
        prior behaviour, used for the Ava / OpenAI paths). Never raises.

        Cache handling:
          * If a REAL cached-token count is available (pipecat surfaces it for
            some providers), it is used directly — the accurate path.
          * Otherwise, when `approximate_cache` is on (Novita auto-caches the
            stable prefix), turns AFTER the first are assumed to hit the cache
            for up to `prefix_tokens` tokens. Turn 1 pays full rate (nothing is
            cached yet). This is a documented APPROXIMATION.
        """
        p = self._llm_pricing
        if not p or not p.get("apply"):
            return None
        if prompt_tokens is None or completion_tokens is None:
            return None
        try:
            inp = max(0, int(prompt_tokens))
            out = max(0, int(completion_tokens))
            cached = 0
            cache_source = "none"
            if cached_tokens is not None and int(cached_tokens) > 0:
                cached = min(inp, int(cached_tokens))
                cache_source = "real"
            elif p.get("approximate_cache") and self._turn >= 2:
                cached = min(inp, int(p.get("prefix_tokens") or 0))
                cache_source = "approx"
            uncached = max(0, inp - cached)

            in_rate = float(p.get("input_per_1m") or 0.0) / 1_000_000.0
            ca_rate = float(p.get("cached_per_1m") or 0.0) / 1_000_000.0
            ou_rate = float(p.get("output_per_1m") or 0.0) / 1_000_000.0

            input_cost = uncached * in_rate + cached * ca_rate
            output_cost = out * ou_rate
            return {
                "input": input_cost,
                "output": output_cost,
                "total": input_cost + output_cost,
                "cached_tokens": cached,
                "uncached_input": uncached,
                "cache_source": cache_source,
            }
        except Exception:  # noqa: BLE001
            return None

    def log_generation(
        self,
        *,
        model: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        total_tokens: Optional[int] = None,
        cached_tokens: Optional[int] = None,
        cache_creation_tokens: Optional[int] = None,
        latency_s: Optional[float] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record one LLM completion under this call's trace. Never raises."""
        if self._trace is None:
            return
        try:
            self._turn += 1
            usage_details: Dict[str, int] = {}
            if prompt_tokens is not None:
                usage_details["input"] = int(prompt_tokens)
            if completion_tokens is not None:
                usage_details["output"] = int(completion_tokens)
            if total_tokens is not None:
                usage_details["total"] = int(total_tokens)

            md = dict(self._meta)
            if latency_s is not None:
                md["latency_s"] = round(float(latency_s), 4)
            if extra:
                md.update(extra)

            # Cache-discounted explicit pricing (Pixi/Novita only). When it
            # returns a cost, attach it as cost_details so the discount lands on
            # the trace total; otherwise leave LLM pricing to Langfuse's model
            # table exactly as before (Ava/OpenAI unchanged).
            cost_details = self._price_llm_turn(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cached_tokens=cached_tokens,
            )
            gen_kwargs: Dict[str, Any] = {}
            if cost_details is not None:
                md["cached_input_tokens"] = cost_details["cached_tokens"]
                md["uncached_input_tokens"] = cost_details["uncached_input"]
                md["cache_source"] = cost_details["cache_source"]
                gen_kwargs["cost_details"] = {
                    "input": cost_details["input"],
                    "output": cost_details["output"],
                    "total": cost_details["total"],
                }
            elif cached_tokens is not None:
                # No explicit pricing for this path, but record the observed
                # cache hit for transparency (does not change cost).
                md["cached_input_tokens"] = int(cached_tokens)

            start_time = None
            end_time = None
            if latency_s is not None:
                try:
                    end_time = datetime.now(timezone.utc)
                    start_time = end_time - timedelta(seconds=float(latency_s))
                except Exception:  # noqa: BLE001
                    start_time = end_time = None

            gen = self._trace.generation(
                name=f"turn-{self._turn}",
                model=model or self._meta.get("model"),
                usage_details=usage_details or None,
                metadata=md,
                start_time=start_time,
                end_time=end_time,
                **gen_kwargs,
            )
            try:
                gen.end()
            except Exception:  # noqa: BLE001
                pass
        except Exception as exc:  # noqa: BLE001
            log.debug("langfuse generation log failed", extra={"error": str(exc)[:160]})

    def log_cost(
        self,
        *,
        name: str,
        model: str,
        usd: float,
        component: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Attach a fixed-USD cost observation to this call's trace.

        Uses a Langfuse *generation* with `cost_details={"total": usd}` — the
        langfuse 2.60.10 mechanism for a MANUAL observation cost. The value
        surfaces as the observation's `calculatedTotalCost` and rolls into the
        trace `totalCost`, so it appears in the super-admin AI Usage & Cost page
        by-model (model=<name>) and by-feature (metadata.component) breakdowns.
        Tagged with tenant_id + playbook so Pixi vs Ava spend stays separable.
        Never raises.
        """
        if self._trace is None:
            return
        try:
            md = dict(self._meta)
            md["component"] = component
            if extra:
                md.update(extra)
            gen = self._trace.generation(
                name=name,
                model=model,
                metadata=md,
                cost_details={"input": 0.0, "output": 0.0, "total": float(usd)},
            )
            try:
                gen.end()
            except Exception:  # noqa: BLE001
                pass
        except Exception as exc:  # noqa: BLE001
            log.debug("langfuse cost log failed", extra={"error": str(exc)[:160]})

    def finalize_costs(self, cost_ctx: Optional[Dict[str, Any]]) -> None:
        """Compute + attach the non-LLM voice cost components (STT/TTS/transport).

        Fully guarded: any problem is swallowed so call teardown is unaffected.
        `cost_ctx` is assembled by bot.py at call end; see _report_ended.
        """
        if self._trace is None or not cost_ctx:
            return
        try:
            duration_s = float(cost_ctx.get("duration_seconds") or 0.0)
            duration_min = max(0.0, duration_s) / 60.0
            provider = (cost_ctx.get("voice_provider") or "").lower()
            transport_kind = (cost_ctx.get("voice_transport") or "").lower()
            realtime = bool(cost_ctx.get("realtime"))
            rates = cost_ctx.get("rates") or {}
            playbook = self._meta.get("playbook_id")

            # --- STT (Deepgram, per minute of audio) --------------------------
            # Skipped for the speech-to-speech realtime path: there is no
            # separate STT service there (audio goes straight into the S2S
            # model, whose cost is already the LLM generation).
            if not realtime and duration_min > 0:
                stt_rate = float(rates.get("stt_per_min") or 0.0)
                self.log_cost(
                    name="stt.deepgram",
                    model="deepgram-nova",
                    usd=duration_min * stt_rate,
                    component="stt",
                    extra={
                        "duration_min": round(duration_min, 4),
                        "rate_usd_per_min": stt_rate,
                        "playbook": playbook,
                    },
                )

            # --- TTS (per character) ------------------------------------------
            # Piper (self-hosted) = $0. Deepgram Aura-2 and ElevenLabs are per
            # character. Characters are MEASURED from TTSTextFrame; if none were
            # seen we fall back to an ESTIMATE from bot-speaking time (~14
            # chars/sec) and flag it. Skipped for realtime (no TTS service).
            if not realtime:
                chars = int(self._tts_chars)
                estimated = False
                if chars <= 0 and self._bot_speaking_s > 0:
                    chars = int(round(self._bot_speaking_s * 14.0))
                    estimated = True
                if provider == "piper":
                    self.log_cost(
                        name="tts.piper",
                        model="piper",
                        usd=0.0,
                        component="tts",
                        extra={
                            "chars": chars,
                            "estimated": estimated,
                            "note": "self-hosted, no per-char cost",
                            "playbook": playbook,
                        },
                    )
                elif provider == "deepgram":
                    rate = float(rates.get("aura_per_1k") or 0.0)
                    self.log_cost(
                        name="tts.aura-2",
                        model="deepgram-aura-2",
                        usd=(chars / 1000.0) * rate,
                        component="tts",
                        extra={
                            "chars": chars,
                            "estimated": estimated,
                            "rate_usd_per_1k_chars": rate,
                            "playbook": playbook,
                        },
                    )
                else:
                    # Default / "elevenlabs" (Ava and the ultimate fallback).
                    rate = float(rates.get("eleven_per_1k") or 0.0)
                    self.log_cost(
                        name="tts.elevenlabs",
                        model="elevenlabs",
                        usd=(chars / 1000.0) * rate,
                        component="tts",
                        extra={
                            "chars": chars,
                            "estimated": estimated,
                            "rate_usd_per_1k_chars": rate,
                            "playbook": playbook,
                        },
                    )

            # --- Transport ----------------------------------------------------
            # Daily = per participant-minute, assume 2 (bot + user). Twilio /
            # Vonage carry their own carrier cost billed by the carrier, which
            # is out of scope here — we log a 0-cost marker rather than fake it.
            if transport_kind == "daily" and duration_min > 0:
                daily_rate = float(rates.get("daily_per_participant_min") or 0.0)
                self.log_cost(
                    name="transport.daily",
                    model="daily",
                    usd=duration_min * 2.0 * daily_rate,
                    component="transport",
                    extra={
                        "duration_min": round(duration_min, 4),
                        "participants": 2,
                        "rate_usd_per_participant_min": daily_rate,
                        "playbook": playbook,
                    },
                )
            elif transport_kind in ("twilio", "vonage"):
                self.log_cost(
                    name=f"transport.{transport_kind}",
                    model=transport_kind,
                    usd=0.0,
                    component="transport",
                    extra={
                        "note": "carrier cost billed by carrier; out of scope",
                        "duration_min": round(duration_min, 4),
                        "playbook": playbook,
                    },
                )
        except Exception as exc:  # noqa: BLE001
            log.debug("langfuse cost finalize failed", extra={"error": str(exc)[:160]})

    def end(
        self,
        reason: Optional[str] = None,
        *,
        cost_ctx: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Finalise the trace (best-effort) and flush. Never raises.

        When `cost_ctx` is provided, the non-LLM voice cost components (STT,
        TTS, transport) are computed and attached BEFORE the flush so they land
        on the same trace as the LLM generations.
        """
        if self._trace is None:
            return
        try:
            self.finalize_costs(cost_ctx)
        except Exception:  # noqa: BLE001
            pass
        try:
            self._trace.update(output={"ended_reason": reason, "turns": self._turn})
        except Exception:  # noqa: BLE001
            pass
        flush()


def start_call_trace(
    *,
    call_id: str,
    tenant_id: str,
    playbook_id: Optional[str],
    locale: Optional[str],
    provider: Optional[str],
    model: Optional[str],
    llm_pricing: Optional[Dict[str, Any]] = None,
) -> CallTrace:
    """Create the per-call trace. Returns an inert CallTrace when tracing off."""
    meta: Dict[str, Any] = {
        "tenant_id": tenant_id,
        "playbook_id": playbook_id,
        "locale": locale,
        "provider": provider,
        "model": model,
    }
    if not enabled():
        return CallTrace(None, meta, llm_pricing)
    try:
        trace = _CLIENT.trace(
            id=call_id,
            name="voice.call",
            session_id=tenant_id or None,
            metadata=meta,
            tags=["voice", f"playbook:{playbook_id or 'unknown'}"],
        )
        return CallTrace(trace, meta, llm_pricing)
    except Exception as exc:  # noqa: BLE001
        log.warning("langfuse trace start failed", extra={"error": str(exc)[:160]})
        return CallTrace(None, meta, llm_pricing)


def make_observers(call_trace: Optional[CallTrace]) -> List[Any]:
    """Build the pipecat observer list that streams LLM metrics into the trace.

    Returns [] whenever tracing is off — the PipelineTask then gets no extra
    observers and behaves exactly as before. pipecat imports are lazy so this
    module stays cheap to import at server boot.
    """
    if call_trace is None or not call_trace.active():
        return []
    try:
        from pipecat.observers.base_observer import BaseObserver
        from pipecat.frames.frames import (
            MetricsFrame,
            TTSTextFrame,
            BotStartedSpeakingFrame,
            BotStoppedSpeakingFrame,
        )
        from pipecat.metrics.metrics import (
            LLMUsageMetricsData,
            TTFBMetricsData,
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("pipecat observer classes unavailable", extra={"error": str(exc)[:160]})
        return []

    class LangfuseMetricsObserver(BaseObserver):
        """Observes pipecat metrics frames and logs an LLM generation per turn.

        Pure observer: it reads frames and never mutates or blocks them, so it
        cannot influence turn-taking, STT, TTS, or tool-calling for Pixi OR
        Ava. Every callback body is wrapped so a tracing error is swallowed.

        Also passively tallies the characters the TTS service synthesized (via
        TTSTextFrame) and the bot-speaking wall time (via BotStarted/Stopped
        speaking) onto the CallTrace, so TTS cost can be priced at call end.
        """

        def __init__(self, ct: CallTrace):
            super().__init__()
            self._ct = ct
            self._last_llm_ttfb: Optional[float] = None
            self._bot_speaking_since: Optional[float] = None
            # De-dup guard. on_push_frame fires once per PROCESSOR HOP, so the
            # SAME frame object is observed many times as it propagates down the
            # pipeline. Without this, one real LLM turn (one MetricsFrame) was
            # logged once per hop (~6x), inflating LLM cost ~6x; TTS characters
            # were double-counted the same way. Frame ids (obj_id) are globally
            # unique and monotonic, so processing each id at most once collapses
            # every frame back to a single observation. Bounded per call.
            self._seen_frame_ids: set = set()

        def _first_time(self, frame: Any) -> bool:
            """True the FIRST time this exact frame is seen, False on re-hops."""
            fid = getattr(frame, "id", None)
            if fid is None:
                return True  # cannot de-dup; fall back to old behaviour
            if fid in self._seen_frame_ids:
                return False
            self._seen_frame_ids.add(fid)
            # Bound memory on long calls. Ids never repeat, and a frame is only
            # re-observed within a short hop window, so clearing is safe.
            if len(self._seen_frame_ids) > 8192:
                self._seen_frame_ids.clear()
                self._seen_frame_ids.add(fid)
            return True

        async def on_push_frame(self, data: Any) -> None:  # noqa: ANN401
            try:
                frame = getattr(data, "frame", None)
                if frame is None:
                    return
                # Measured TTS characters: TTSTextFrame is emitted only by TTS
                # services with the exact text sent for synthesis (= billable
                # characters), never by the LLM (which emits LLMTextFrame).
                if isinstance(frame, TTSTextFrame):
                    if not self._first_time(frame):
                        return
                    self._ct.add_tts_chars(len(getattr(frame, "text", "") or ""))
                    return
                # Fallback signal for a TTS char ESTIMATE when no TTSTextFrame
                # is seen: accumulate bot-speaking wall time.
                if isinstance(frame, BotStartedSpeakingFrame):
                    if not self._first_time(frame):
                        return
                    import time as _t

                    self._bot_speaking_since = _t.monotonic()
                    return
                if isinstance(frame, BotStoppedSpeakingFrame):
                    if not self._first_time(frame):
                        return
                    import time as _t

                    if self._bot_speaking_since is not None:
                        self._ct.add_bot_speaking_s(
                            _t.monotonic() - self._bot_speaking_since
                        )
                        self._bot_speaking_since = None
                    return
                if not isinstance(frame, MetricsFrame):
                    return
                # Process each unique MetricsFrame exactly once — this is the
                # core fix for the ~6x LLM-turn over-count.
                if not self._first_time(frame):
                    return
                for metric in getattr(frame, "data", None) or []:
                    if isinstance(metric, TTFBMetricsData):
                        proc = str(getattr(metric, "processor", "") or "")
                        if "LLM" in proc:
                            self._last_llm_ttfb = getattr(metric, "value", None)
                    elif isinstance(metric, LLMUsageMetricsData):
                        tokens = getattr(metric, "value", None)
                        # cache_read_input_tokens is populated by pipecat for
                        # providers that surface it (Anthropic/Google). The
                        # OpenAI-wire path (Novita/Kimi, Groq) leaves it None —
                        # CallTrace then applies the documented prefix-cache
                        # approximation. Either way, never raises.
                        self._ct.log_generation(
                            model=getattr(metric, "model", None),
                            prompt_tokens=getattr(tokens, "prompt_tokens", None),
                            completion_tokens=getattr(tokens, "completion_tokens", None),
                            total_tokens=getattr(tokens, "total_tokens", None),
                            cached_tokens=getattr(
                                tokens, "cache_read_input_tokens", None
                            ),
                            cache_creation_tokens=getattr(
                                tokens, "cache_creation_input_tokens", None
                            ),
                            latency_s=self._last_llm_ttfb,
                            extra={"processor": getattr(metric, "processor", None)},
                        )
                        self._last_llm_ttfb = None
            except Exception:  # noqa: BLE001 - tracing must never break a call
                pass

    try:
        return [LangfuseMetricsObserver(call_trace)]
    except Exception as exc:  # noqa: BLE001
        log.debug("langfuse observer init failed", extra={"error": str(exc)[:160]})
        return []


def flush() -> None:
    """Flush buffered events to Langfuse. Never raises."""
    if not enabled():
        return
    try:
        _CLIENT.flush()
    except Exception:  # noqa: BLE001
        pass
