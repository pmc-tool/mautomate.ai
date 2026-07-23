# Brand2Door Marketing Suite — Production Rebuild Plan

> Goal: turn the thin merchant marketing CRUD into a real social-media manager matching the `mautomate` reference: connect socials → compose → schedule → kanban/calendar → publish → inbox → analytics.
> Reality: the backend is ~90% built already (oauth, 6 publish adapters, scheduled-publish runner, all models, tenant-scoped). The work = a MERCHANT ROUTE LAYER (re-scope the existing admin capabilities to `resolveMerchant`) + production UI. Not a backend rebuild.

## Ground truth (from audit)
- Backend module `apps/backend/src/modules/marketing/`: 37 tenant-scoped models incl. `post`, `post-target`(scheduled_at + publish-sweep index), `social-account`, `social-credential`(AES-256-GCM), `oauth-state`, `conversation/message`. `oauth/service.ts` (startOAuth/completeOAuth/refreshOAuth), `publish/runner.ts` + adapters for **facebook, instagram, x, linkedin, wordpress, telegram** (+ mock), `content/content-service.ts` (AI generate/rework/tailor), `analytics/stats-service.ts`, `messaging/*` (inbox). Publish worker `jobs/marketing-publish.ts` is inert until `MARKETING_ENABLED=1`.
- The RICH routes exist only under `api/admin/marketing/*` and use a single `MARKETING_DEFAULT_TENANT`. Merchant routes (`api/merchant/marketing/*`) are thin CRUD (posts/journeys/campaigns/email/chatbots).
- Merchant UI = list + basic form. Journeys page is genuinely good (keep). Posts is a textarea (worst). No connect/composer/schedule/kanban/inbox/analytics UI.
- BUG: merchant `DELETE /merchant/marketing/posts/:id` fails to cascade to post_target rows.

## Buildable NOW vs blocked on keys
- NOW (no vendor keys): the entire merchant route layer + all UI (connect page, composer, kanban, calendar, scheduling, inbox, analytics). Live publish demoable via **WordPress** (app password) + **Telegram** (bot token) + **mock** provider.
- BLOCKED on social-app credentials (user provides later): live connect+publish to **Facebook/Instagram/X/LinkedIn** (per-platform client id/secret; Meta needs App Review). YouTube/TikTok/Pinterest/Threads need keys AND new publish adapters (defer).
- Structural must-fix: OAuth callback currently binds accounts to `MARKETING_DEFAULT_TENANT`; the merchant connect flow must thread the merchant's tenant through `oauth_state` so a connected account attaches to the right store.

## Build waves (each: merchant route(s) re-scoped to resolveMerchant + production UI + verify live + tenant-isolation check)

### WAVE M0 — Merchant marketing API layer + fixes  [FOUNDATION, backend]
Add merchant-scoped routes (tenant = resolveMerchant, NOT default tenant), mirroring the admin ones:
- accounts: GET list, POST connect (oauth start → returns authorize URL), GET [id], POST [id]/refresh, DELETE [id] (disconnect). Thread tenant through oauth_state; update the `marketing-oauth/[platform]/callback` to attribute to the state's tenant + redirect back to the merchant admin connect page.
- posts: POST [id]/schedule ({scheduled_at, targets?}), POST [id]/approve, POST generate (AI), POST [id]/rework, POST [id]/tailor (per-platform), POST [id]/publish-now, and extend create/update to accept scheduled_at + media + per-platform overrides.
- media: POST upload (post media).
- analytics: GET dashboard/stats (real).
- conversations: GET list, GET [id], POST [id]/reply, POST [id]/suggest.
- FIX: post DELETE cascade (delete post_target + post_media before/with the post).
All null-safe, fail-closed, tenant-scoped. Verify cross-tenant isolation.

### WAVE M1 — Social Connect page  [UI]
Platform cards (fb/ig/x/linkedin/telegram/wordpress), Connect (system-app vs custom BYO creds dialog), connected-accounts table (status, disconnect, reconnect/refresh). Mirror mautomate `SocialConnectPage`/`AccountsTable`/`CredentialDialog`. WordPress/Telegram fully work now; OAuth platforms show "needs app credentials" until keys set.

### WAVE M2 — Post Composer  [UI]
Real composer: content editor, hashtags, media upload, pick target accounts, per-platform copy tabs + preview, link. AI-generate + rework buttons (content-service). Mirror mautomate `CreatePostDialog`/composer.

### WAVE M3 — Kanban board + Calendar + Scheduling  [UI]
Kanban board columns draft→needs_approval→scheduled→publishing→published/failed; drag between columns; drag-to-scheduled opens a date/time picker. Calendar (month/week) with drag-to-reschedule. Mirror mautomate `PostHubPage`/`KanbanBoard`/`CalendarPage`. This is the user's core "post/kanban/scheduling" ask.

### WAVE M4 — Conversations Inbox  [UI]
Unified DM inbox: conversation list, thread view, reply, AI-suggest reply, human takeover. Mirror mautomate central-inbox. (Backend messaging exists.)

### WAVE M5 — Analytics + Chatbot depth + Email editor + Campaign content  [UI polish]
- Real marketing dashboard (status rollups, upcoming posts, connected accounts, engagement) replacing the decorative KPIs.
- Chatbot: editable knowledge sources after create + a conversation/test panel.
- Email: block/visual editor + preview + test-send (replace the raw HTML textarea).
- Campaigns: attach posts/content + performance rollup.

### WAVE M6 — Activation  [blocked on user keys]
Set `MARKETING_ENABLED=1`, `MARKETING_SECRET_KEY`, per-platform app credentials; verify live connect + a real scheduled publish end-to-end (start with WordPress/Telegram which need no OAuth app).

## Sequencing
M0 first (foundation). Then M1→M3 are the core social suite (highest value, the user's named pains) — build in order (they depend on M0 routes + share api.ts). M4/M5 after. M6 when keys arrive. Keep the good Journeys page. Fix the post-delete bug in M0.
