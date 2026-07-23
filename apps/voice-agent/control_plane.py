"""
Control-plane client — the ONLY module that talks to the Medusa backend's
`/telephony/*` webhooks. Config is PULLED, actions and end-of-call are PUSHED.

All three endpoints sit behind the coarse `x-telephony-secret` gate
(`requireTelephonySecret` in the backend's `src/api/middlewares.ts`). We attach
that header to every request.

Contracts matched EXACTLY against the backend source:

  POST /telephony/agent-config
    req : { call_id?, call_task_id?, order_id?, playbook_id?, tenant_id?, locale? }
    res : { playbook_id, version, locale, first_message, system_prompt,
            tools: [{ type:"function", function:{ name, description, parameters }}],
            voice: { provider, voice_id, language },
            guardrails: { max_turns, max_clarify, save_offer_once,
                          recording_disclosure },
            disposition_set: string[], dtmf_map: { <digit>: <intent> } }
    404 { type:"not_found", message } when the playbook id is unknown.

  POST /telephony/tool-execute   (ALWAYS 200; errors in-band)
    req : { call_id, tenant_id, tool_name, arguments }
    res : { result?, action?, error? }

  POST /telephony/call-ended     (NO-THROW; always 200)
    req : { call_id, tenant_id, transcript, summary?, sentiment?, disposition?,
            cost_total?, recording_url?, ended_reason? }
    res : { received: true }
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from logging_config import get_logger

log = get_logger("voice.control_plane")


class AgentConfig:
    """Typed view over the agent-config response the runtime builds a bot from."""

    def __init__(self, raw: Dict[str, Any]):
        self.raw = raw
        self.playbook_id: str = raw.get("playbook_id") or ""
        self.version = raw.get("version")
        self.locale: str = raw.get("locale") or "en"
        self.first_message: str = raw.get("first_message") or ""
        self.system_prompt: str = raw.get("system_prompt") or ""
        self.tools: list = raw.get("tools") or []
        voice = raw.get("voice") or {}
        self.voice_provider: str = voice.get("provider") or "elevenlabs"
        self.voice_id: Optional[str] = voice.get("voice_id")
        self.voice_language: str = voice.get("language") or self.locale
        self.guardrails: Dict[str, Any] = raw.get("guardrails") or {}
        # Optional per-session LLM override (Pixi voice pins a cheap brain).
        self.llm: Dict[str, Any] = raw.get("llm") or {}
        self.disposition_set: list = raw.get("disposition_set") or []
        self.dtmf_map: Dict[str, str] = raw.get("dtmf_map") or {}


class ControlPlaneError(RuntimeError):
    pass


class ControlPlaneClient:
    def __init__(self, base_url: str, telephony_secret: str, timeout: float = 20.0):
        self._base = base_url.rstrip("/")
        self._headers = {
            "content-type": "application/json",
            "x-telephony-secret": telephony_secret,
        }
        self._timeout = timeout

    async def fetch_agent_config(
        self,
        *,
        playbook_id: str,
        tenant_id: str,
        locale: Optional[str],
        order_id: Optional[str] = None,
        call_id: Optional[str] = None,
    ) -> AgentConfig:
        """PULL the compiled agent config. Raises ControlPlaneError on 4xx/5xx."""
        url = f"{self._base}/telephony/agent-config"
        body = {
            "playbook_id": playbook_id,
            "order_id": order_id,
            "tenant_id": tenant_id,
            "locale": locale,
            "call_id": call_id,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, headers=self._headers, json=body)
        if resp.status_code != 200:
            raise ControlPlaneError(
                f"agent-config returned {resp.status_code}: {resp.text[:300]}"
            )
        return AgentConfig(resp.json())

    async def tool_execute(
        self,
        *,
        call_id: str,
        tenant_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute a tool via the control plane. The endpoint ALWAYS returns 200
        with the result in-band, so a transport-level failure is the only way
        this can fail — in which case we synthesize an in-band error so the LLM
        still gets a readable result instead of an exception.
        """
        url = f"{self._base}/telephony/tool-execute"
        body = {
            "call_id": call_id,
            "tenant_id": tenant_id,
            "tool_name": tool_name,
            "arguments": arguments or {},
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers=self._headers, json=body)
            if resp.status_code != 200:
                return {"error": f"tool endpoint http {resp.status_code}"}
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "tool-execute transport failure",
                extra={"call_id": call_id, "tool_name": tool_name, "error": str(exc)},
            )
            return {"error": "tool endpoint unreachable"}

    async def transfer_status(self, transfer_id: str) -> str:
        """Poll a human-transfer request's status ("" on any failure)."""
        url = f"{self._base}/telephony/transfer-status"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    url, headers=self._headers, params={"transfer_id": transfer_id}
                )
            if resp.status_code != 200:
                return ""
            return str(resp.json().get("status") or "")
        except Exception:  # noqa: BLE001
            return ""

    async def transfer_update(self, transfer_id: str, status: str) -> None:
        """Report a runtime-side terminal transfer state (missed/canceled)."""
        url = f"{self._base}/telephony/transfer-status"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                await client.post(
                    url,
                    headers=self._headers,
                    json={"transfer_id": transfer_id, "status": status},
                )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "transfer-update failed",
                extra={"transfer_id": transfer_id, "error": str(exc)},
            )

    async def call_ended(
        self,
        *,
        call_id: str,
        tenant_id: str,
        transcript: Any,
        summary: Optional[str] = None,
        sentiment: Optional[str] = None,
        disposition: Optional[str] = None,
        cost_total: Optional[float] = None,
        recording_url: Optional[str] = None,
        ended_reason: Optional[str] = None,
        duration_seconds: Optional[int] = None,
    ) -> None:
        """
        POST the end-of-call artifacts. NO-THROW: the backend never fails this
        call, and we never let a persistence error propagate into shutdown.
        """
        url = f"{self._base}/telephony/call-ended"
        body: Dict[str, Any] = {
            "call_id": call_id,
            "tenant_id": tenant_id,
            "transcript": transcript,
        }
        if summary is not None:
            body["summary"] = summary
        if sentiment is not None:
            body["sentiment"] = sentiment
        if disposition is not None:
            body["disposition"] = disposition
        if cost_total is not None:
            body["cost_total"] = cost_total
        if recording_url is not None:
            body["recording_url"] = recording_url
        if ended_reason is not None:
            body["ended_reason"] = ended_reason
        # NOTE: the backend's call-ended handler does not currently persist
        # `duration_seconds`; it is sent per the runtime contract and ignored
        # harmlessly (unknown keys are dropped). Duration is derivable from the
        # call row's started_at/ended_at server-side.
        if duration_seconds is not None:
            body["duration_seconds"] = duration_seconds
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                await client.post(url, headers=self._headers, json=body)
        except Exception as exc:  # noqa: BLE001
            log.error(
                "call-ended post failed",
                extra={"call_id": call_id, "error": str(exc)},
            )
