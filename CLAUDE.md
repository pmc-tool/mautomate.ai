# mAutomate — project instructions

Multi-tenant AI e-commerce SaaS. **Read `README.md` first** (repo map, ports,
deploy recipes). For any theme work, **`THEME_GUIDE.md` is required reading.**

## Ground rules

- This repo (github.com/pmc-tool/mautomate.ai) is the single source of truth.
  Workflow: edit → commit → push; the server pulls and builds. Never edit live
  server files without committing the change here.
- Server: `ratul@192.168.200.201`, checkout at `/home/ratul/mautomate`
  (`/home/ratul/brandtodoor` is a compatibility symlink). pm2 processes are
  `mautomate-*`. Secrets live only in server-side `.env` files — never commit
  one.
- Build on the server with `scripts/deploy/` ONLY:
  `sf-rebuild.sh` (storefront), `be-rebuild.sh` (backend), `sf-ride.sh`
  (recovery after a build collision).
- ONE build at a time per app — concurrent `next build` runs corrupt `.next`
  and take every tenant store down. Check `pgrep -f '[.]bin/next build'` first,
  and never kill a build mid-flight (orphans keep running and collide later).
- Every storefront restart = ~15-30s of 502 on ALL live stores. Batch changes.
- Backend build wipes `.medusa/server/.env`; `be-rebuild.sh` restores it.
  Backend build "errors" in test files are cosmetic — judge by `/health` 200.

## Conventions

- TypeScript/React, kebab-case filenames, NEVER use emojis in code or UI.
- Money is in cents throughout Medusa — divide by 100 for display.
- Merchants see CREDITS only, never USD (plan prices are the one exception).
- Every merchant API route must be tenant-scoped: resolve the tenant via
  `apps/backend/src/api/merchant/_helpers.ts` and filter by it. Cross-tenant
  leaks are the #1 historical bug class here.
- Multi-tenant caching: per-tenant cache tags; never `cache: "force-cache"` on
  tenant-variable data (see `lib/data/cookies.ts` `getCacheOptions`).
