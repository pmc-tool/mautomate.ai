# Call Center Module

A tenant-ready AI call-center module for Medusa v2. It models the outbound/inbound
calling workflow (campaigns, playbooks, call tasks, attempts, dispositions,
consent, callbacks) so an AI voice agent can run structured conversations against
a commerce backend.

Pilot market: **Bangladesh / Bengali**.

## Tenancy

- **Single-tenant run, multi-tenant-ready.** The module currently runs as a
  single tenant (see `CALL_CENTER_DEFAULT_TENANT`, default `default`), but every
  model carries a `tenant_id` so the same schema can be partitioned across
  multiple tenants later without a migration rewrite.

## Entities

| Entity | Purpose |
| --- | --- |
| `Call` | A single voice call (inbound or outbound). |
| `CallTask` | A unit of work queued for the calling engine. |
| `CallAttempt` | An individual dial attempt against a task. |
| `Campaign` | A grouping of tasks under a shared goal/config. |
| `Playbook` | The conversational script/strategy the agent follows. |
| `PlaybookVersion` | An immutable versioned snapshot of a playbook. |
| `Disposition` | The outcome classification of a call/attempt. |
| `AgentRole` | Role/permission definition for agents. |
| `Consent` | A contact's current consent state. |
| `ConsentLog` | Append-only audit trail of consent changes. |
| `Callback` | A scheduled call-back request. |
| `RecordingAccessLog` | Audit trail of who accessed call recordings. |

## Commerce Gateway abstraction

The module talks to commerce through a **`CommerceGateway`** abstraction rather
than importing Medusa services directly. Medusa is **adapter #1**; the core call-
center logic stays decoupled so other commerce backends can be plugged in later.

## Database migrations

Migrations are **generated later**, not hand-written. Once the models are in
place, generate them with:

```bash
npx medusa db:generate call_center
```

## Redis requirement

The event bus and workflow engine can run Redis-backed. This is wired into
`apps/backend/medusa-config.ts` behind an env guard: the Redis providers are only
registered when `REDIS_URL` is set, so the default in-memory setup stays intact
and non-breaking.

The Redis provider packages (`@medusajs/event-bus-redis`,
`@medusajs/workflow-engine-redis`) are already installed in this workspace. If a
future environment lacks them, install before enabling Redis:

```bash
npm i @medusajs/event-bus-redis @medusajs/workflow-engine-redis
```

Option keys used in `medusa-config.ts` (verified against the installed packages):

- `@medusajs/event-bus-redis` -> `options: { redisUrl }`
- `@medusajs/workflow-engine-redis` -> `options: { redis: { redisUrl } }`
  (the older `redis: { url }` form is deprecated and emits a warning).

## Status

**Phases 0–5 built (code-complete, pre-migration).** The full stack is in place:
data model + gateway (P0/P1), event subscriber + claim-first dialer + telephony
webhooks + tool-execution + Bengali COD/WISMO playbooks + fulfillment gate +
the self-hosted Python voice runtime at `apps/voice-agent/` (P1/P2), the admin
console + Order/Customer widgets + SSE (P3), inbound WISMO + SMS-OTP + campaign
engine + dial-gates + consent/DNC + analytics + post-call extraction (P4), and
reliability (durable kill-switch, reconciliation), observability, unit tests,
and go-live docs (P5).

It is **not yet migrated or deployed** and stays inert until `CALL_CENTER_ENABLED=true`.
To activate: `npx medusa db:generate call_center && npx medusa db:migrate`, wire
Redis + telephony/AI credentials, deploy the voice runtime, and follow
`docs/call-center/GO-LIVE.md`. The Bengali voice-quality + latency spike is a
hard gate before any real customer call. Backlog (deferred): courier/NDR, live
tracking in WISMO, WhatsApp fallback, abandoned-cart, returns automation, QA
scorecards, and the multi-tenant SaaS surface.

## Plan references

- `docs/ai-call-center-plan.html`
- `docs/ai-call-center-build-plan.html`
