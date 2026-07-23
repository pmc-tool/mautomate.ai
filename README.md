# mAutomate

Multi-tenant, AI-powered e-commerce SaaS (Merchant Automation Made Simple).
One merchant signup provisions a full store: storefront, admin dashboard,
AI marketing/operations, call center, and billing — all served from this
single codebase.

**This repository is the single source of truth for ALL code.**
Builds and runtime data live only on the server. Never commit secrets,
build output, or runtime data (`.gitignore` enforces this).

## Repository layout

| Path | What it is | Runs as |
|---|---|---|
| `apps/backend/` | Medusa v2 backend: all APIs (`/merchant`, `/platform`, `/store`, `/admin`), modules (billing, credits, marketing, call-center, CMS, themes) | pm2 `b2d-backend`, port **9500** |
| `apps/storefront/` | Next.js app serving BOTH every tenant storefront (Liquid themes via `theme-render`) AND the merchant dashboard (`/dashboard`) + visual editor (`/editor`) | pm2 `b2d-storefront-next`, port **8601** |
| `apps/console/` | Super-admin console ("Control") — static export | pm2 `b2d-console`, port **8700** (serves `~/console/dist`) |
| `apps/landing/` | mautomate.ai marketing site (Next.js static export: pricing, blog, get-started, signup) | built to `~/mautomate-landing/out`, served by the landing server |
| `apps/merchant-app/` | Flutter merchant mobile app (Jarvis-first admin) | shipped as APK/IPA |
| `apps/shopper-app/` | Flutter white-label customer app (server-driven from CMS blocks) | shipped per-store |
| `apps/voice-agent/` | Python/pipecat voice agent (AI call center + Jarvis voice) | pm2 `b2d-voice-agent`, uvicorn :8790 |
| `themes/` | Liquid theme packages (`katan-liquid`, `learts-liquid`, …) + `pack/validate/upload` scripts | uploaded to backend theme store |
| `infra/landing-server/` | Node server for mautomate.ai: serves the landing export + proxies `/partners`, `/api/*`, signup | pm2 `b2d-landing`, port **8500** |
| `scripts/deploy/` | The ONLY sanctioned build/deploy scripts (see below) | run on the server |
| `THEME_GUIDE.md` | REQUIRED reading before any theme work | — |

## Where things run

- Server: `ratul@192.168.200.201` (the "VM"), repo checked out at `/home/ratul/brandtodoor`.
  (The directory name predates the Brand2Door -> mAutomate rebrand; pm2 process
  names `b2d-*` are the same legacy. Renaming them is pure operational churn, so
  they stay — but everything user-facing says mAutomate. Historical planning docs
  live in `docs/archive/`.)
- Public entry: Cloudflare tunnels. `mautomate.ai` → :8500 (landing), `merchant.mautomate.ai` → :8600 edge → :8601, `api.mautomate.ai` → :9500, `*.mautomate.ai` tenant stores → :8600 → :8601. Tunnel config: `/home/ratul/vip-tunnel-config.yml`.
- Secrets: `.env` files exist ONLY on the server (e.g. `apps/backend/.env`). They are gitignored. Never commit one; add a matching `.env.example` if you introduce a new variable.

## Development workflow

1. Clone from GitHub (`pmc-tool/mautomate.ai`) — on your machine this lives in ONE place.
2. Edit → commit → push (small, described commits; no more editing live files over ssh without committing).
3. On the server: `git pull`, then build with the scripts below.
4. Builds/artifacts stay on the server: `.next`, `.medusa`, `dist/`, `out/` are never committed.

## Building & deploying (server)

**Golden rules — breaking these has caused real outages:**
1. **ONE build at a time per app.** Two concurrent `next build` runs corrupt `.next` and take every store down. Check first: `pgrep -f '[.]bin/next build'`.
2. **Never kill a build mid-flight** — killed ssh sessions orphan the build, which then corrupts the next one.
3. Every storefront restart = ~15-30s of 502 on ALL live stores. Batch changes; deploy in quiet windows.
4. Backend `medusa build` WIPES `.medusa/server/.env` — the script restores it; never restart without that restore.
5. Backend build exit=1 with TS errors in test files is cosmetic — judge by `/health` returning 200.

| Task | Command (on server, repo root) |
|---|---|
| Storefront (dashboard + stores) | `bash scripts/deploy/sf-rebuild.sh` |
| Storefront recovery after a build collision | `bash scripts/deploy/sf-ride.sh` |
| Backend | `bash scripts/deploy/be-rebuild.sh` |
| Landing | `cd apps/landing && BLOG_API=https://api.mautomate.ai npm run build && rsync -a --delete out/ ~/mautomate-landing/out/` |
| Console | `cd apps/console && npm run build && rsync -a --delete dist/ ~/console/dist/` |
| Theme upload | see `THEME_GUIDE.md` + `themes/upload-theme.js` |

Health checks: backend `curl :9500/health`, storefront `curl :8601/dashboard`, landing `curl :8500`.

## Conventions

- TypeScript/React; kebab-case files; no emojis in code.
- Merchant-facing UI shows CREDITS only, never USD (plan prices are the one exception).
- All merchant APIs are tenant-scoped — every new route must resolve and filter by tenant. Read `apps/backend/src/api/merchant/_helpers.ts` first.
- Money amounts are in cents throughout Medusa — divide by 100 for display.
