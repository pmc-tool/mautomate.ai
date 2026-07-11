# Brand2Door Call-Center — Gap Analysis & Production Rebuild Plan

> Reference: calldone (`/Users/…/CLAUDE/calldone` — Go API + Next dashboard + external Pipecat voice runtime).
> Reality: the Brand2Door call-center BACKEND already implements ~85% of calldone's CONTROL plane as real, tenant-scoped Medusa code. The gap is merchant UI + a few merchant write-routes + a few genuinely-absent pieces. The VOICE plane (STT→LLM→TTS) is an external runtime (calldone-pipecat, currently disabled) — key-gated, not code we write.

## What's REAL in the backend (verified, tenant-scoped, not stubs)
agents CRUD + rich training `_definition.ts` (persona/voice/objective/first_message/prompt/states[]/tools[]/guardrails/dtmf) + publish/immutable versions; playbooks registry + `compileSystemPrompt` + `guardrails.ts` (hard tool-gating, anti-invention, DTMF, Bengali-first) + 2 seeded playbooks (COD-confirmation, WISMO); campaign runner job + `dialing/dial-gate.ts` (call-window + concurrency + consent/DNC); dialer job (claim-first, POSTs to VOICE_AGENT_URL); call + call-attempt models (transcript json, recording_url, summary, sentiment, cost); `analytics/aggregate.ts` (connect/containment/AHT/cost/by-day); consent/OTP/DNC; kill-switch/settings; tools registry + gateway (shadow-mode + cc_audit); Twilio webhooks (voice/status/recording, signature-verified); order-placed subscriber + COD confirm/cancel workflows. Admin routes (`api/admin/call-center/*`) expose most of it; MERCHANT routes are agents-CRUD + GET-only everything else.

## Current merchant UI honest state
- Agents + `[id]` training editor = **decent, real, persists** (verified create→train→KB→publish→delete live). KEEP + extend.
- Dashboard + Analytics = basic-works, honest (real math, empty until calls run). KEEP.
- Campaigns / Calls / Playbooks = **read-only stubs — rebuild**. No campaign create, no CSV contact list, no dialer trigger, no call detail/transcript viewer, no phone-number UI, no test-call.

## Genuinely MISSING (build)
Merchant campaign create/manage/start-pause routes+UI; CSV contact-list (new model+parser); call detail (transcript viewer + recording player); phone-number management (model + list/assign UI; provisioning key-gated); browser WebRTC test-call (UI + token endpoint + runtime); KB file upload + embeddings/RAG (storage exists, retrieval doesn't).

## Buildable NOW (zero keys) vs BLOCKED on keys
- NOW: all merchant UIs + the missing merchant write-routes + contact-list model + call-detail render + phone-number data layer + agent-editor upgrades (templates/voice-picker/tools-library/state-graph/KB-upload UI). Backend enrollment/dialer/analytics already exist.
- BLOCKED on keys/runtime: `CALL_CENTER_ENABLED=true` + `VOICE_AGENT_URL` (re-enable calldone-pipecat) + Twilio (SID/token) → live inbound/outbound calls; ElevenLabs/Deepgram → live TTS/STT + voice preview; OpenAI → KB RAG embeddings + LLM; number provisioning (calldone's Stripe-checkout buy flow, unported). Without these the dialer safely reschedules (nothing lost).

## Build waves (each: merchant route(s) re-scoped to resolveMerchant + production UI + verify + tenant-isolation check)

### CC0 — Merchant API layer + models  [FOUNDATION, backend]
Add tenant-scoped merchant routes mirroring the admin ones: campaigns create/update/[id]/start/pause/cancel; a NEW contact-list model + CSV import routes; call [id] detail (transcript/recording/summary); dispositions GET; phone-number model + list/assign routes (data layer). Clean up leftover .bak files. All resolveMerchant-scoped, fail-closed.

### CC1 — Campaign builder + contact lists  [UI — the biggest hole]
Campaign create wizard (name → audience: existing-orders filter OR uploaded CSV contact list → schedule/cadence/pacing → dispositions) + campaign detail with start/pause/cancel + progress. CSV upload UI. This is what makes outbound actually runnable (once the runtime is on).

### CC2 — Call detail + transcript/recording  [UI]
Call detail page: transcript viewer, recording `<audio>` player, summary/sentiment/cost, disposition. Call list → detail. (Fields already on the model; populated by the runtime.)

### CC3 — Agent editor upgrades  [UI]
Template/wizard from the existing playbook registry (COD-confirmation/WISMO as starting points; use_case → select); voice PICKER (provider dropdown + voice_id list + preview — preview key-gated); tools LIBRARY picker; visual state-graph; KB FILE upload (store now, RAG later). Extends the good agent editor toward calldone-grade.

### CC4 — Phone numbers  [UI + data]
Phone-number management: list, assign to agent, inbound/outbound config (data layer + UI). Actual provisioning/buy + live routing = key-gated (Twilio) later.

### CC5 — Test-call / simulator  [UI, runtime-gated]
Browser WebRTC "talk to your agent" widget (mirror calldone WebCallWidget + token endpoint). Build the UI + token route now; live audio needs the runtime + Twilio.

### CC6 — Ops console + analytics polish  [UI]
Dashboard → real console (live task queue, active-campaign controls, start-a-call). Analytics polish.

### CC7 — Activation  [blocked on user keys]
Set CALL_CENTER_ENABLED=true + VOICE_AGENT_URL (re-enable calldone-pipecat pm2 + its OPENAI/DEEPGRAM/TTS keys) + Twilio creds; verify a real outbound call + transcript + test-call end-to-end.

## Sequencing
CC0 (foundation) → CC1 (campaigns+contacts, biggest hole) → CC2 (call detail) → CC3 (agent upgrades) → CC4/CC5/CC6 → CC7 (keys). Keep Agents/Dashboard/Analytics; rebuild Campaigns/Calls/Playbooks. Playbooks page likely FOLDS into Agents (agents ARE playbooks) — consolidate rather than keep a confusing duplicate.
