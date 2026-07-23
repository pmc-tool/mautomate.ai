# Jarvis Unified Surface — Architecture Spec

**Goal:** collapse today's TWO Jarvis surfaces into ONE. The light card
"Jarvis OS" becomes the single screen; the real-time Daily voice is **always-on
and embedded** inside it (the `mA` core is the live voice orb); voice-driven
tool actions spawn OS cards in the same screen. Retire the separate dark
full-screen `jarvis-stage.tsx` voice window from the default flow (keep as
fallback).

All paths below are relative to `apps/storefront/src/...` (frontend),
`apps/backend/src/...` (backend), or `apps/voice-agent/...` (python), on the VM
`/home/ratul/brandtodoor`.

---

## 0. The mess today (why unify)

Wiring as shipped:

- `app/dashboard/layout.tsx` mounts `<JarvisOSMount/>` (when
  `NEXT_PUBLIC_JARVIS_OS !== "0"`) **and** `<JarvisLauncher/>`.
- `jarvis-launcher.tsx` — the floating bottom-right pill. Click dispatches
  `window.dispatchEvent(new CustomEvent("jarvis:open"))`. It **also renders
  `<JarvisStage/>`** (the dark immersive voice window), opened on a
  `jarvis:voice` event.
- `os/jarvis-os-mount.tsx` listens for `jarvis:open` → opens `<JarvisOS/>` (the
  light card OS). Text SSE only.
- **The bug:** inside `os/jarvis-os.tsx`, the `AskBar` mic button does:
  ```tsx
  onClick={() => window.dispatchEvent(new CustomEvent("jarvis:voice"))}
  ```
  i.e. clicking the OS mic fires `jarvis:voice`, which the launcher catches and
  **opens the separate dark `JarvisStage` on top of the OS.** Two surfaces, two
  orbs, two voice/confirm stacks. That single `dispatchEvent` line is the split
  to eliminate.

Two independent tool→card pipelines exist:

- **Text:** `os/use-jarvis-stream.ts` (`runJarvisStream`) reads the SSE-over-POST
  `/merchant/jarvis` stream and fires `onToolCall/onTool/onToolResult/onConfirm/
  onMessage`. `os/os-provider.tsx` maps those onto card-store actions.
- **Voice:** tools run in the **python** voice pipeline (`bot.py` →
  `/telephony/tool-execute` → `executeJarvisVoiceTool`). Today the browser
  gets **nothing** structured back except caption text — so voice actions never
  spawn cards. This spec adds that bridge.

---

## 1. Real-time voice client flow (in `jarvis-stage.tsx`) + the extractable hook

### 1.1 How `startRealVoice` connects

`components/merchant-admin/jarvis-stage/jarvis-stage.tsx`, `startRealVoice()`
(≈ lines 452–609):

1. `POST /merchant/jarvis/voice/start` with `Authorization: Bearer <token>`,
   empty body. Backend (`voice/start/route.ts`):
   - `resolveMerchant(req)` → authoritative `tenant_id` (never client-supplied).
   - Creates a Daily room via `DAILY_API` (`/rooms`, `max_participants: 2`,
     `exp: now+3600`, video off, no chat/screenshare).
   - Mints an **owner** meeting token (`/meeting-tokens`, `exp: now+1800`).
   - Creates a call-center call row with `playbook_id: "jarvis"` +
     `tenant_id` stamped (`provider_call_id = room_name`).
   - Dispatches the bot: `POST ${VOICE_AGENT_URL}/api/pipelines/start` with
     `{call_id, playbook_id:"jarvis", tenant_id, room_url, room_name, locale}`.
   - Returns `{ call_id, room_url, token, bot_dispatched }`.
2. Client: `await import("@daily-co/daily-js")` (lazy, off the render path;
   dep is `@daily-co/daily-js ^0.91.0`). Destroys any existing global call
   instance (`DailyIframe.getCallInstance()?.destroy()` — Daily forbids two).
3. `const co = DailyIframe.createCallObject({ audioSource: true, videoSource:
   false })`. Stored in `dailyCallRef`; `call_id` in `dailyCallIdRef`.
4. Registers handlers **before** join: `track-started`, `app-message`,
   `left-meeting`, `network-connection`, `error`, `camera-error`.
5. `realModeRef.current = true` **before** join (blocks the fallback
   `ensureMic()` getUserMedia from racing Daily for the device).
6. `await co.join({ url: room_url, token: roomToken })`.
7. `co.setLocalAudio(true)` — assert the local mic track is published/unmuted
   (this is the track the pipecat VAD listens to).
8. **Race sweep:** iterate `co.participants()` and attach any bot audio track
   that already existed at join time (the bot usually joins first).
9. `setVoiceMode("real")`, `setDailyStatus("connected")`.

On **any** failure: log which step broke, `stopRealVoice(true)`, return `false`;
the opener sets `voiceMode="failed"` (an explicit, diagnosable retry — never a
silent fall to the "ghost" browser Web-Speech voice).

### 1.2 Mic capture

Daily **exclusively owns the mic** in real mode (`audioSource:true` publishes
it). The browser-Web-Audio analyser path (`ensureMic()`, ≈ 241–264) is
**fallback-only** and hard-returns `if (realModeRef.current ||
dailyCallRef.current)`. So there is exactly one capture of the device.

### 1.3 Bot audio playback

`attachRemoteAudio(track)` (≈ 319–335) attaches the bot's remote audio track to
a hidden `<audio ref={remoteAudioElRef} autoPlay playsInline>` sink:
`el.srcObject = new MediaStream([track])`, then `tryPlayRemote()`.
`tryPlayRemote()` (≈ 289–315) handles the browser **autoplay policy honestly**:
on a rejected `el.play()` it raises `soundBlocked=true`, surfacing a real
"Sound blocked — tap to enable" gesture button; `enableSound()` (≈ 340–352)
resumes every owned `AudioContext` and re-plays on a real user gesture.

### 1.4 VAD / always-listening — **confirmed continuous**

Yes: once joined, the session is **continuous, hands-free, no click-to-talk.**
Turn-taking runs **server-side** in the pipecat runtime, not the browser:
`bot.py` builds `DailyParams(vad_analyzer=self._make_vad(...))` plus an optional
smart-turn `turn_analyzer` (`_make_turn_analyzer`). The browser never gates the
mic. The big mic button in the stage is a **mute toggle**, not push-to-talk:

```tsx
// onMic(), real-voice branch (≈ 743–753)
const next = !micLive
co.setLocalAudio?.(next)
setMicLive(next)
```

The "Connected — just talk." copy reflects this. **This is exactly the
always-on behavior the unified surface wants** — no change needed to the model.

### 1.5 Orb state/level

Two analysers — **local mic** + **remote bot** — each produce a smoothed 0..1
RMS (`wireAnalyser(track,"local"|"remote")`, `rmsFromAnalyser`). One `rAF`
(≈ 138–233) picks the louder side and derives:
- `st="speaking"` when the bot is loud, `"listening"` when the merchant is loud,
  `"thinking"` in the between-turns gap, else `"idle"`;
- `level` = clamped RMS.
Fed to `<JarvisCore state={coreState} level={level} activities={activities}/>`.
(The OS uses `MaCore` with the SAME `{state, level}` interface — see §3.)

### 1.6 Teardown

`stopRealVoice(notifyBackend)` (≈ 389–447): `co.leave()` + `co.destroy()`; null
all analysers + close the Daily `AudioContext`; clear the `<audio>` sink; and if
`notifyBackend` → `POST /merchant/jarvis/voice/stop {call_id}` with
`keepalive:true`. Called from `requestClose`, unmount cleanup, and the
open-effect's cancel path.

### 1.7 Confirm-over-voice (pending poll)

While `voiceMode==="real"`, a 3s poll (≈ 693–730) hits
`GET /merchant/jarvis/voice/pending` → rows `{id, tier, require_text, summary,
token, exp, ...}`, appended into `confirms[]` and applied via
`POST /merchant/jarvis/apply {token, confirm_text}`. (Security model in §2.4.)

### 1.8 → Extract to `useJarvisRealtimeVoice` (reusable hook)

**Create** `lib/merchant-admin/use-jarvis-realtime-voice.ts`. Move ALL of the
above out of `jarvis-stage.tsx` into a hook so it can mount inside the OS.

```ts
export type RealtimeStatus =
  | "idle" | "connecting" | "connected" | "reconnecting" | "failed"

export function useJarvisRealtimeVoice(opts: {
  token: string | null
  enabled: boolean               // auto-connect while true (OS open)
  onAppMessage: (data: any) => void   // raw ev.data — the card bridge (§2)
  onPending?: (rows: PendingRow[]) => void
}): {
  status: RealtimeStatus
  micLive: boolean
  toggleMic: () => void          // co.setLocalAudio(!micLive)
  level: number                  // 0..1 for the orb
  orbState: "idle"|"listening"|"thinking"|"speaking"
  interim: string                // merchant's live transcript
  reply: string                  // bot's last caption
  soundBlocked: boolean
  enableSound: () => void
  micDenied: boolean
  retry: () => void
  stop: () => void
}
```

**What moves into the hook (verbatim logic):** `dailyCallRef`,
`dailyCallIdRef`, `remoteAudioElRef`, `dailyAudioCtxRef`, the local/remote
analyser refs + `realLocal/RemoteLevelRef`; `startRealVoice`, `stopRealVoice`,
`retryRealVoice`, `tryPlayRemote`, `attachRemoteAudio`, `wireAnalyser`,
`enableSound`, `handleAppMessage`; the amplitude `rAF` (emitting `level` +
`orbState`); and the `/voice/pending` poll (emitting via `onPending`).

**Auto-connect, no click-to-talk:** the hook runs `startRealVoice()` in an
effect keyed on `enabled && token` (the same open-effect the stage has at
≈ 658–689). Mic is live immediately after join; `toggleMic` mutes/unmutes.
Graceful: `micDenied` (from `camera-error`) → tell the merchant to type; `failed`
→ expose `retry`.

**The hidden `<audio>` sink:** rather than depend on the consumer's JSX,
the hook creates a detached element in the connect path
(`document.createElement("audio")`, `playsInline`, appended to
`document.body`, removed on teardown) and holds it in `remoteAudioElRef`. This
keeps the hook drop-in for any surface.

**Daily singleton guard:** Daily allows one global call object. The hook must
`destroy()` any pre-existing instance before `createCallObject` (already done),
and only ONE mounted consumer may have `enabled=true` at a time (see §3.4).

`jarvis-stage.tsx` is then refactored to consume this hook (its remaining job is
just the dark full-screen chrome) — or left as-is as the fallback while the OS
adopts the hook fresh.

---

## 2. Voice-pipeline tool execution → driving cards (the core integration)

### 2.1 Where voice tools actually run

Voice tools do **not** run in the text SSE. `bot.py` registers **one catch-all**
handler (`_register_tools`, ≈ 1854–1923):

```py
async def handle_function(params) -> None:      # FunctionCallParams
    name = getattr(params, "function_name", None)
    args = getattr(params, "arguments", None) or {}
    ...
    out = await self.control.tool_execute(
        call_id=cid, tenant_id=tenant_id, tool_name=name or "", arguments=args)
    ...
    await params.result_callback(out)
llm.register_function(None, handle_function)
```

`control.tool_execute` POSTs `/telephony/tool-execute`; for a `playbook_id ==
"jarvis"` call row it routes to **`executeJarvisVoiceTool`**
(`apps/backend/src/api/merchant/jarvis/_voice.ts`). Reads run and return their
payload; writes are **proposed only** (plan → mint HMAC plan token → `recordPending`
→ return `{result:{proposed:true, label, tier, summary, requires_typed_word,
note}}`). The token is stored server-side in `jarvis_voice_pending`, **never
returned to the model.**

### 2.2 The channel: Daily **app-messages** (confirmed supported)

The browser call object **already listens**:

```tsx
co.on("app-message", (ev: any) => handleAppMessage(ev))   // ev.data is the payload
```

pipecat **0.0.80** DailyTransport **can send** app-messages to that listener.
Verified in the installed package
`pipecat/transports/services/daily.py`:

- `DailyTransportMessageUrgentFrame(message=..., participant_id=...)` (l. 91).
- Output transport `send_message()` (l. 435–449):
  ```py
  if isinstance(frame, (DailyTransportMessageFrame,
                        DailyTransportMessageUrgentFrame)):
      ...
      self._client.send_app_message(frame.message, participant_id)  # None ⇒ broadcast
  ```
- `_schedule_tool_filler` (bot.py ≈ 1843) **already** pushes frames downstream
  via `llm_processor.push_frame(...)` — the identical mechanism. In the Daily
  pipeline the order is `transport.input() → … → llm → tts → transport.output()`,
  so a frame pushed from the LLM processor flows **downstream to
  `transport.output().send_message()`** and out to the browser. No new plumbing.

**Decision: use Daily app-messages, emitted from `handle_function` in `bot.py`,
pushed as `DailyTransportMessageUrgentFrame` via the LLM processor.** No new WS,
no backend→browser channel (the backend isn't in the room; the bot is).

### 2.3 Exact emit points in `bot.py` (inside `handle_function`)

Add a tiny helper on the agent and two emits. Wrap in `try/except` — the bridge
must **never** break a call; skip when `self._transport_kind != "daily"`.

```py
# helper (new)
async def _emit_card(self, llm_proc, payload: dict) -> None:
    if self._transport_kind != "daily":
        return
    try:
        from pipecat.transports.services.daily import (
            DailyTransportMessageUrgentFrame,
        )
        await llm_proc.push_frame(
            DailyTransportMessageUrgentFrame(message={"t": "jarvis_tool", **payload})
        )
    except Exception as exc:                    # never fail the call
        log.warning("card emit failed", extra={"error": str(exc)[:120]})
```

```py
# inside handle_function, after computing name/args:
llm_proc = getattr(params, "llm", None) or llm
corr = getattr(params, "tool_call_id", None) or uuid.uuid4().hex

# (A) tool STARTED — before control.tool_execute:
await self._emit_card(llm_proc, {
    "phase": "call", "id": corr, "name": name, "args": args,
})

out = await self.control.tool_execute(...)     # existing

# (B) tool FINISHED — after out returns:
res = out.get("result") if isinstance(out, dict) else None
is_write = isinstance(res, dict) and "proposed" in res
await self._emit_card(llm_proc, {
    "phase": "result", "id": corr, "name": name,
    "ok": not (isinstance(out, dict) and out.get("error")),
    "kind": "write" if is_write else "read",
    # reads: the actual payload the card body renders
    "data": None if is_write else res,
    # writes (proposed): everything needed to spawn the ConfirmCard shell
    "proposed": bool(res.get("proposed")) if is_write else False,
    "tier": (res or {}).get("tier"),
    "require_text": (res or {}).get("requires_typed_word"),
    "summary": (res or {}).get("summary"),
    "pending_id": (res or {}).get("pending_id"),   # see §2.5 backend note
    "error": out.get("error") if isinstance(out, dict) else None,
})
```

`corr` correlates the two emits (pipecat function calls may not expose a stable
id — synthesize one). `import uuid` at module top.

### 2.4 Exact client handler → card-store dispatch (reuse the text path)

In `useJarvisRealtimeVoice`, `onAppMessage(data)` is wired by the OS provider to
dispatch the **same** card-store actions the text SSE uses
(`os/card-store.ts` — `TOOL_CALL` / `TOOL_RESULT` / `CONFIRM`). The card store,
`CardHost`, `Dock`, `SignalLines` all already read from it — cards render
identically whether the trigger was typed or spoken.

```ts
// in os-provider.tsx, passed as onAppMessage to the hook:
function onVoiceMessage(data: any) {
  if (!data || data.t !== "jarvis_tool") { handleCaption(data); return }
  if (data.phase === "call") {
    dispatch({
      type: "TOOL_CALL",
      id: data.id,
      tool: data.name,
      label: TOOL_LABEL(data.name) ?? data.name,
      kind: isWriteName(data.name) ? "write" : "read",   // client catalog, §2.6
      args: data.args,
    })
    pushFeed({ id: `t-${data.id}`, kind: "tool", text: ..., state: "running" })
  } else if (data.phase === "result") {
    if (data.kind === "read") {
      dispatch({ type: "TOOL_RESULT", id: data.id, ok: data.ok,
                 data: data.data, error: data.error })
    } else {
      // WRITE: do NOT settle as "ready". Leave the card as a write awaiting its
      // token; the token arrives via the pending poll (below). Optionally stash
      // pending_id on the card for exact correlation.
      dispatch({ type: "TOOL_STATE", id: data.id, state: "running" })
      voiceWriteByPendingId.current.set(data.pending_id, data.id) // §2.5
    }
  }
}
```

Captions (existing `handleAppMessage` schema — `user|stt|transcription` vs
`bot|assistant|tts`) still feed `interim` / `reply` for the answer line. Keep
that logic in the hook; only the `jarvis_tool` type is new.

### 2.5 Bridging the confirm token (writes)

The plan token is **never** in the app-message (by design). It lives only in
`jarvis_voice_pending`, fetched by the authenticated poll. So the ConfirmCard's
token comes from the **`/voice/pending` poll**, which the OS provider now owns
(moved from the stage). When a pending row arrives, dispatch `CONFIRM` on the
matching card:

```ts
// onPending(rows) from the hook's poll:
for (const r of rows) {
  const cardId = voiceWriteByPendingId.current.get(r.id)   // exact match
             ?? findCardByAction(r.action)                 // fallback correlate
  if (!cardId) continue
  dispatch({
    type: "CONFIRM", id: cardId, tool: r.action, label: TOOL_LABEL(r.action),
    confirm: { tier: r.tier === "hard" ? "hard" : "soft",
               requireText: r.require_text ?? null, summary: r.summary,
               details: {}, token: r.token, exp: Number(r.exp) },
  })
}
```

`CONFIRM` flips the card to `status:"proposed"` and renders the existing
`cards/confirm-card.tsx` with soft one-tap / hard typed-word. Apply reuses the
**unchanged** `applyConfirm → applyToken → POST /merchant/jarvis/apply`
(`os-provider.tsx`). So **voice writes surface as real ConfirmCards in the OS,
propose-only, applied by a human tap** — identical guarantee to text and to
today's dark-stage affordance.

> **Recommended tiny backend change (optional but clean):** have
> `executeJarvisVoiceTool` also return `pending_id: planNonce(signed.token)`
> (and `exp`) inside `result` — non-secret; the nonce is already the
> `jarvis_voice_pending` PK. That gives the client an **exact** card↔pending
> key (`voiceWriteByPendingId`) instead of correlating by action name. Without
> it, fall back to matching on `action` + recency.

### 2.6 Client tool classification

`os/tool-catalog.ts` already ships `READ_TOOLS` (29) and the write list, and
`os/card-registry.tsx` pre-registers every tool with title/icon/group.
`isWriteName(name)` / `TOOL_LABEL(name)` derive from those — no server round-trip
needed to pick the card kind, and the app-message's `kind` is authoritative
anyway.

---

## 3. Unification plan

### 3.1 One surface

`JarvisOS` (`os/jarvis-os.tsx` + `os/os-provider.tsx`) is the ONE surface. The
provider gains the embedded real-time voice:

```tsx
// os-provider.tsx
const rt = useJarvisRealtimeVoice({
  token,
  enabled: open,                 // auto-connect when the OS opens
  onAppMessage: onVoiceMessage,  // §2.4 — spawns cards
  onPending: onVoicePending,     // §2.5 — confirm tokens
})
```

Expose `rt.status / micLive / toggleMic / level / orbState / interim / reply /
soundBlocked / enableSound / retry` on the OS context.

### 3.2 The `mA` core becomes the always-on voice orb

`OrbLayer` in `jarvis-os.tsx` currently drives `MaCore` with a **synthetic**
~15fps level. Replace its source with the hook when voice is live:

```tsx
// OrbLayer
const { orbState, voiceLevel, voiceStatus } = useJarvisOS()
const level = voiceStatus === "connected" ? voiceLevel : syntheticLevel
<MaCore state={orbState} level={level} />
```

`MaCore` already takes the **same `{state, level}` interface** as the dark
`JarvisCore`, so the real analyser level (0..1) drives the pulse/rings directly.
`orbState` derives from `rt.orbState` when connected, else the existing
text-derived state (`busy && answer ? "speaking" : busy ? "thinking" : ...`).

### 3.3 Feed the card store from BOTH inputs

- **Typed:** `AskBar` → `send()` → `runJarvisStream` → card-store actions
  (unchanged).
- **Spoken:** hook `onAppMessage` → card-store actions (§2.4).
Both dispatch the same reducer. The answer caption shows `interim || answer`
(text) unified with `rt.interim || rt.reply` (voice).

### 3.4 Retire the dark window from the default flow

1. **`os/jarvis-os.tsx` `AskBar`:** delete the
   `onClick={() => window.dispatchEvent(new CustomEvent("jarvis:voice"))}` and
   wire the mic button to `rt.toggleMic()` (mute/unmute), styled from
   `rt.micLive`. Add small state chips for `connecting / reconnecting / failed`
   (+ `retry`) and a "Sound blocked — tap to enable" affordance bound to
   `rt.soundBlocked / enableSound` (port the stage's styles).
2. **`jarvis-launcher.tsx`:** stop opening the dark stage by default. Gate it
   behind a fallback flag, e.g.
   `const DARK = process.env.NEXT_PUBLIC_JARVIS_DARK_STAGE === "1"` — only then
   listen to `jarvis:voice` and render `<JarvisStage/>`. Default: the launcher
   only owns the pill + `jarvis:open` + attention badge. **Keep
   `jarvis-stage.tsx` on disk** as the fallback (per memory's "keep code as
   fallback").
3. **Daily singleton:** only one `useJarvisRealtimeVoice` may have
   `enabled=true` at once (Daily = one global call object). Enforce with a
   module-level boolean lock in the hook (first mount wins; others stay text-only
   until it releases) so the overlay-OS and the assistant-page-OS (§3.5) never
   both connect.

### 3.5 `/dashboard/assistant` as the home

`app/dashboard/assistant/page.tsx` today renders `AssistantChat`
(`assistant-chat.tsx`) — a ChatGPT-style two-pane copy of the text panel with
conversation history. Recommendation:

- Add an **`inline` mode** to `JarvisOS` (render in normal flow, not
  `position:fixed; z-index:9999`). The assistant page mounts
  `<JarvisOS inline open />` as its body: the always-on orb + voice + card
  canvas become the sit-down home.
- The floating launcher keeps opening the **overlay** `JarvisOS` on other pages
  (same provider, `inline={false}`). The singleton lock (§3.4) ensures only the
  visible instance holds the voice call.
- `assistant-chat.tsx`'s conversation-history sidebar can be preserved as an
  optional left rail of the inline OS (nice-to-have) or deferred; its SSE copy is
  superseded by the OS provider.

### 3.6 Mic UX summary

Always-on (auto-connect on open) · mute toggle (not push-to-talk) · typed input
retained · graceful mic-permission ("type instead") · explicit "couldn't
connect — retry" · autoplay "tap to enable sound". All already exist in the
stage; the hook carries them into the OS.

---

## 4. Card system v2 (accumulate · drag · resize · adaptive · mobile)

Current state — `os/card-store.ts`, `os/card-host.tsx`, `os/dock.tsx`,
`os/jarvis-os.tsx`:

- Store = reducer keyed by tool-call `id`; `Card` has a stable `slot`;
  `activeCards()` returns non-minimized/non-dismissed in slot order;
  `enforceCapacity()` auto-minimizes the **oldest** overflow into the Dock (keeps
  the focus card). `CardHost` lays cards into **two CSS-grid rails** flanking a
  center orb gutter (`repeat(auto-fill, minmax(min(300px,100%),1fr))`); narrow
  (< 900px) collapses to one scrollable column. **No overlap by construction —
  but no drag/resize, and no accumulation.**

### 4.a ACCUMULATE across commands

Today `TURN_START` **minimizes every expanded card** into the dock at the start
of each command:

```ts
case "TURN_START": {                       // ← the docking behavior to remove
  for (const id of state.order) {
    const c = byId[id]
    if (c && !c.dismissed && !c.minimized) byId[id] = { ...c, minimized: true }
  }
  return { ...state, byId, focusId: null, turn: state.turn + 1 }
}
```

**Change:** `TURN_START` should only bump the turn counter (and clear
`focusId`), leaving prior cards active:

```ts
case "TURN_START":
  return { ...state, focusId: null, turn: state.turn + 1 }
```

Cards then **persist and accumulate** until the board is truly full;
`enforceCapacity` already docks the oldest when `active.length > maxExpanded`.
Optionally render a faint per-turn divider (cards carry `turn`). Net: one small
reducer edit + keep the existing capacity/dock spill.

### 4.b + 4.c DRAGGABLE + RESIZABLE + auto-arrange + adaptive

**Recommendation: a custom absolute-position packing canvas — NOT
react-grid-layout.** Rationale: RGL adds a runtime dep + its own external CSS
(the storefront/artifact constraints favor self-contained styles), fights the
reserved **center orb gutter**, and duplicates state the store already holds
(`slot`, order, focus). A ~200-line custom engine reusing the store is cleaner
and mobile-reconcilable.

**Data model — extend `Card`:**
```ts
layout?: { x: number; y: number; w: number; h: number }  // grid units (e.g. 12-col)
```
**New actions:** `MOVE_CARD {id, x, y}`, `RESIZE_CARD {id, w, h}`,
`AUTO_ARRANGE`, `SET_GRID {cols, rowH}`.

**`CardCanvas` (replaces the rail-based `CardHost` on desktop):**
- Fixed column count (e.g. 12) × variable row height; a **skyline/shelf packer**
  seeds each new card into the first free cell, **avoiding the center orb-gutter
  rect** (compute from `getOrbCenter()` + `GUTTER`).
- **Drag:** pointer handlers on `CardShell`'s header → update `{x,y}` →
  collision resolve by pushing overlapped cards down (RGL-style compaction).
- **Resize:** a corner handle → update `{w,h}` (clamp to per-registry
  `min/max`) → re-pack.
- **Auto-arrange:** `AUTO_ARRANGE` re-runs the packer over all active cards
  (a toolbar button + on viewport resize).
- Layout persists on the card, so `FOCUS`/`MINIMIZE` never reflow the board.
- `enforceCapacity` unchanged — a full board still spills oldest to the Dock.

**Adaptive sizing:** each registry entry (`card-registry.tsx`) declares a
default `{w,h}` (content-driven); card bodies use container queries so a resized
card reflows its own contents; `CardShell` may request grow when content
overflows.

### 4.d MOBILE

The `CardCanvas` has two modes (keep the existing 900px `NARROW` breakpoint):
- **`free`** (desktop): absolute packing + drag/resize (above).
- **`stack`** (mobile): single **full-width scrollable column** ordered by
  `turn` then `slot`; drag/resize disabled (or long-press reorder only); touch
  targets ≥ 44px; the orb shrinks to a compact sticky header; the `Dock` stays a
  horizontal scroller (already is). `layout` is ignored in `stack` mode — the
  store stays the single source of truth; positions are derived per mode.

**Reconciliation:** the store owns lifecycle (`status`, `minimized`,
`dismissed`, `slot`, `turn`) **and** now `layout`; `CardCanvas` is a pure
projection of `activeCards()` + `layout` per mode. `Dock`/`enforceCapacity`/
`SignalLines` are untouched.

---

## 5. Build / deploy facts

Repo root on VM: `/home/ratul/brandtodoor`. pm2 process names **confirmed**:
`b2d-storefront-next` (id 14), `b2d-voice-agent` (id 23), `b2d-backend` (id 22),
`b2d-piper` (id 24, the free TTS). `@daily-co/daily-js ^0.91.0` is already a
storefront dependency.

### Storefront (the OS + hook + cards) — port **8601**, pm2 `b2d-storefront-next`
- Build **directly** with `next build` under the shared `NODE_PATH`
  (brandtodoor + foreverfinds `node_modules`); then run `sf-postbuild.sh`; then
  `pm2 restart b2d-storefront-next --update-env`.
- **NEVER `rm -rf .next`** — triggers the Next 15 `/404 _document useContext`
  build crash (see memory: AI-video-canvas + synthesize-prerender-manifest
  recovery). Build in place.
- **ONE storefront build at a time** — other terminals build concurrently; wait
  for the next-build slot (memory: advertising-panel handoff).
- `pm2 restart … --update-env` is required so the PATH/NODE_PATH isn't stripped
  (memory: medusa-admin-ux-parity pm2 `--update-env` gotcha).
- Verify the exact `NODE_PATH` string + `sf-postbuild.sh` path against
  `session-handoff.md` before running (it holds the canonical recipe).

### Voice-agent (the bot.py bridge) — port **8790**, pm2 `b2d-voice-agent`
- Python, `apps/voice-agent/` (`.venv`, pipecat 0.0.80). Edit `bot.py`
  (`_emit_card` helper + the two emits in `handle_function`), then
  `pm2 restart b2d-voice-agent`. No build step.
- Requires `DAILY_API_KEY` (backend), `VOICE_AGENT_URL` + `VOICE_AGENT_API_KEY`
  (backend → runtime dispatch). Confirm `.env` (`apps/voice-agent/.env`).
- The bridge is additive + `try/except`-wrapped: if it throws it must not affect
  the call. Test with a live browser session; watch `pm2 logs b2d-voice-agent`.

### Backend (only if adopting the optional `pending_id` return) — port **9500**, pm2 `b2d-backend`
- Edit `apps/backend/src/api/merchant/jarvis/_voice.ts` (`executeJarvisVoiceTool`
  → add `pending_id`/`exp` to `result`). Rebuild the medusa backend + restart
  `b2d-backend` (mind the NODE_PATH VM deploy gotcha from
  `ai-call-center-initiative.md`). Optional — the client can correlate by action
  name without it.

### Deploy order
1. Backend (optional `pending_id`) → restart `b2d-backend`.
2. `bot.py` bridge → restart `b2d-voice-agent`.
3. Storefront (hook + OS wiring + card-v2) → `next build` + `sf-postbuild.sh` +
   `pm2 restart b2d-storefront-next --update-env`.
4. Verify end-to-end in a real browser (Daily needs mic permission + a user
   gesture for audio): open the OS, confirm auto-connect + always-on mic, speak
   a **read** ("show me low stock") → a card spawns from voice; speak a **write**
   ("restock SKU X to 50") → a ConfirmCard appears, tap Confirm → applied.

---

## Appendix — file map

| Concern | File |
|---|---|
| Dark voice stage (Daily flow to extract) | `components/merchant-admin/jarvis-stage/jarvis-stage.tsx` |
| **New** extracted voice hook | `lib/merchant-admin/use-jarvis-realtime-voice.ts` |
| Browser Web-Speech fallback hook (unrelated to Daily) | `lib/merchant-admin/use-jarvis-voice.ts` |
| OS surface / orb / ask bar (`jarvis:voice` bug) | `os/jarvis-os.tsx` |
| OS brain (text SSE → cards; add voice bridge here) | `os/os-provider.tsx` |
| Text SSE reader | `os/use-jarvis-stream.ts` |
| Card store / reducer (§4.a, §4.b model) | `os/card-store.ts` |
| Card layout (→ CardCanvas) | `os/card-host.tsx` |
| Dock / capacity spill | `os/dock.tsx` |
| `mA` voice orb (same {state,level} API) | `os/ma-core.tsx` |
| Tool catalog / registry (client kind classification) | `os/tool-catalog.ts`, `os/card-registry.tsx` |
| Launcher pill (+ dark-stage mount to gate) | `components/merchant-admin/jarvis-stage/jarvis-launcher.tsx` |
| OS mount (jarvis:open) | `os/jarvis-os-mount.tsx` |
| Dashboard layout (mounts) | `app/dashboard/layout.tsx` |
| Assistant page (unification home) | `app/dashboard/assistant/page.tsx`, `assistant-chat.tsx` |
| Voice bridge server-side | `apps/backend/src/api/merchant/jarvis/_voice.ts` |
| Voice routes | `apps/backend/src/api/merchant/jarvis/voice/{start,pending,stop}/route.ts` |
| Voice runtime tool handler (emit points) | `apps/voice-agent/bot.py` — `_register_tools` / `handle_function` |
| pipecat Daily app-message API | `apps/voice-agent/.venv/.../pipecat/transports/services/daily.py` |
