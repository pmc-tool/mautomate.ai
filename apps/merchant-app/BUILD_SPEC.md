# mAutomate Merchant App — BUILD SPEC (single source of truth)

> Every agent MUST read this fully before writing code. It is the shared plan + contracts + rules. Do not deviate. If something is ambiguous, follow the closest existing pattern in the web app rather than inventing.

## 0. What we are building
A **native iOS + Android MERCHANT ADMIN app** in **Flutter** — a merchant runs their whole shop from their phone, and above all **talks to Jarvis** (the AI operator). It is NOT a shopper app. It reuses the existing Medusa backend + Jarvis + voice pipeline — the app is a new face on a proven engine.

Location: `/home/ratul/brandtodoor/apps/merchant-app` (Flutter project, in the monorepo).
Flutter SDK on VM: `/home/ratul/flutter/bin` (add to PATH). Verify code with `flutter analyze` (MUST be clean) + `flutter test`.

## 1. Architecture (locked)
- **State:** Riverpod v2 (`flutter_riverpod` + `riverpod_annotation`/codegen optional). Feature-first providers.
- **Networking:** `dio` with interceptors (attach Bearer token, map errors to friendly messages, 401 → sign out). SSE = read a streamed `dio` response body, parse `event:`/`data:` frames split on `\n\n` (mirror the web parser in `apps/storefront/src/components/merchant-admin/jarvis-panel.tsx`).
- **Routing:** `go_router`, auth-guarded shell, deep links.
- **Auth store:** `flutter_secure_storage` (Keychain/Keystore) for the merchant token. `local_auth` for optional biometric unlock.
- **Models:** `freezed` + `json_serializable` DTOs mirroring the backend JSON.
- **Push (later phase):** `firebase_messaging`.
- **No backend of its own** except a future push-registration route. Tenant is carried by the merchant token exactly like web.

## 2. THE API IS ALREADY DEFINED — mirror it, don't guess
The web dashboard client is the CONTRACT. Read and mirror these (on the VM):
- `apps/storefront/src/lib/merchant-admin/api.ts` — every endpoint, request/response shape (login, MFA, me, orders, products, jarvis, etc.). The Dart Dio client must mirror these function-for-function.
- `apps/storefront/src/lib/merchant-admin/auth.tsx` — auth flow: `POST /auth/merchant/emailpass` → `{token}`; MFA via `mfa_required`; `GET /merchant/me`; token stored client-side; 401 → sign out.
- `apps/storefront/src/components/merchant-admin/jarvis-panel.tsx` — Jarvis SSE stream shape: `POST /merchant/jarvis {message, conversation_id?}` → events `thinking|tool|confirm|message|done|error`; confirm cards; `POST /merchant/jarvis/apply {token, confirm_text}`; `GET/POST /merchant/jarvis/conversations`.
- `apps/storefront/src/app/dashboard/**` — each screen's data + UX to port faithfully.
- Backend routes live in `apps/backend/src/api/merchant/*` and `apps/backend/src/api/auth/*` — read them for exact field names when the web client is unclear.
Base URL: the same backend the web dashboard uses (merchant API). Configure via `--dart-define=API_BASE_URL=...`; staging default = the VM backend origin. NEVER hardcode secrets; auth is token-only.

## 3. DESIGN SYSTEM & UX RULES (non-negotiable — the user demanded this)
- **Palette (port 1:1 from web):** ink `#0F1319` (primary/action), ember `#F26522` (accent/state), paper `#F6F5F2` light bg, plus semantic ok `#12925A` / danger `#C43640` / a cool data accent `#4DD8E6`. Full light + dark theme. "Ink is for action, ember is for state."
- **Type:** Inter (bundle the font via `google_fonts` offline or `flutter` assets). Clear type scale; generous spacing (4/8 rhythm, ~16 gutters).
- **ICONS — CRITICAL:** use a **professional, consistent icon set** — **Phosphor Icons** (`phosphor_flutter`) OR Material Symbols. **NEVER emoji, NEVER AI-generic/decorative icons, NEVER inconsistent mixed sets.** One family, consistent weight, throughout.
- **NO GIMMICKS.** Production-grade, restrained, professional. No gratuitous animation. Motion only where it aids comprehension (state transitions, the Jarvis orb, pull-to-refresh).
- **International UX/UI standards:** follow platform conventions (iOS + Material where each fits), WCAG AA contrast, min 44/48dp tap targets, clear focus/pressed/disabled states, loading + empty + error states for EVERY screen (never a bare spinner with no context), safe-area aware, RTL-safe layouts, dynamic-type friendly, haptics on key actions, skeleton loaders not spinners where lists load.
- **Consistency:** a small component kit (buttons, cards, list rows, the confirm card, status chips, the Jarvis orb, app bar, bottom nav) reused everywhere. Define it ONCE (design agent) and everyone uses it.
- **Copy:** active voice, name things by what they are to a merchant. Errors say what went wrong + how to fix.

## 4. Folder structure (feature-first)
```
apps/merchant-app/lib/
  main.dart
  app.dart                      # MaterialApp.router + theme + providers scope
  core/
    api/ (dio_client, sse.dart, api_error)
    auth/ (auth_repository, auth_controller, secure_store)
    theme/ (colors, typography, theme_data, spacing)
    router/ (app_router, guards)
    widgets/ (buttons, cards, status_chip, list_row, empty_state, error_state, skeleton, confirm_card)
  features/
    home/  orders/  products/  jarvis/  (later: inbox, insights, setup, ...)
      data/ (models freezed, repository)
      application/ (riverpod controllers)
      presentation/ (screens, widgets)
```
Naming: files snake_case, classes PascalCase, providers `xxxProvider`. DTOs in `data/models` via freezed.

## 5. QUALITY BAR (QA enforces)
- `flutter analyze` MUST be clean (zero errors; warnings triaged). Run it after every feature.
- Every screen: loading (skeleton), empty (with guidance), error (retry) states.
- Widget tests for the confirm card, auth flow, and Jarvis frame parser at minimum.
- No dead code, no TODO-only stubs shipped as "done", no emoji, no AI-generic icons.
- The confirm gate is SERVER-enforced — the app only renders it; money/irreversible actions still require the tap / typed word.
- No hardcoded strings for the base URL/secrets.

## 6. Phase plan (build in order)
- **Foundation:** project + pubspec + theme/design-system + Dio/auth/API layer + router + core widget kit + login/MFA + secure token + `/merchant/me`.
- **P0 MVP:** Home (needs_attention + today's numbers), Orders (list/detail/fulfil via confirm), Products (list/quick edit/publish), **Jarvis chat** (SSE + confirm cards + conversations), **Jarvis voice** (native `speech_to_text`+`flutter_tts`) + the **orb** (Flutter `FragmentProgram`, port the web molten-orb GLSL), push scaffolding.
- **P1:** Daily real-time voice, inbox (reply/hand-to-AI), setup wizard, insights, create-product/restock.
- **P2:** ads/call-center/marketing/domains parity, white-label theming, widgets.

## 7. Agent roles & collaboration
- **UI/UX lead** owns `core/theme` + `core/widgets` (the design system + component kit) and REVIEWS every feature screen for the rules in §3. Nothing ships that violates §3.
- **Feature engineers** build one feature each (home/orders/products/jarvis/...) against the design system + API contracts. Read the corresponding web screen first.
- **QA** runs `flutter analyze`/`flutter test`, checks §5, and reports issues back to the owning agent.
- Collaboration: all read THIS spec. Don't edit another agent's files without coordinating. Feature agents import the design-system widgets — they don't restyle. If you find a WEB bug while porting, note it clearly for the coordinator to fix.

## 8. Ground truth references on the VM
- Web API client: `apps/storefront/src/lib/merchant-admin/api.ts`, `.../auth.tsx`, `.../hooks.ts`
- Jarvis web: `apps/storefront/src/components/merchant-admin/jarvis-panel.tsx`, `.../jarvis-stage/*` (orb shader to port: `jarvis-core.tsx`)
- Web screens: `apps/storefront/src/app/dashboard/**`
- Backend routes: `apps/backend/src/api/merchant/**`, `apps/backend/src/api/auth/**`
- Design tokens: ink #0F1319 / ember #F26522 (see any web component)
