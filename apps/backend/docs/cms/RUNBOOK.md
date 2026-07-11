# Forever Finds — CMS, Themes & Visual Editor Runbook

A practical guide to running and operating the system.

## Run it

```bash
cd ~/Desktop/CLAUDE/my-store
npm run dev          # starts backend (:9000, admin at /app) + storefront (:8000)
```

- Storefront: http://localhost:8000 (default region `/bd`, BDT)
- Admin: http://localhost:9000/app — `admin@medusa-test.com` / `supersecret`

## Choosing a storefront theme (WordPress-style)

Admin → **Site Management → Storefront Themes** → click **Activate** on a design.
The live storefront switches in seconds. The same content renders in every theme.

- Ships with: **Learts** (warm gift-shop) and **Aurora** (modern minimalist).
- Aurora themes the full flow: home, header/footer, store, product, cart, category,
  login. (Checkout and account dashboard use the shared base styling.)

## Adding a new theme (toward many designs)

See `apps/storefront/src/themes/README.md`. In short:

```bash
cd apps/storefront
node scripts/scaffold-theme.mjs <id> "<Display Name>"   # starts as a Learts clone
# 1) register in src/themes/registry.ts
# 2) mirror metadata in apps/backend/src/api/admin/cms/themes/_catalog.ts
# 3) restyle blocks under src/themes/<id>/blocks/*, set tokens, add chrome
node scripts/theme-preview.mjs <id>                     # gallery thumbnail
npx tsc --noEmit                                        # then activate in admin
```

IMPORTANT: Tailwind must scan `./src/themes/**` (already configured) or theme
classes won't generate.

## Editing content

Two surfaces, one content spine (blocks published as snapshots):

1. **Form editors** — Site Management → Header / Topbar / Footer / Theme / SEO,
   plus Pages, Blog, Media. Localized (EN/বাংলা), draft → preview → publish,
   scheduled publish, revisions/rollback, RBAC, audit log.
2. **Visual editor (Elementor-style)** — Site Management → **Visual Editor (Home)**.
   Drag blocks on a live canvas, edit fields, **Publish** → live on the storefront.
   - Async blocks (product tabs, category showcase) show a placeholder in the
     editor but render live products on the storefront.
   - Known limits (for hardening): publishes snapshots directly (doesn't two-way
     sync the form editor's draft); access is a shared key (localhost) not full
     admin SSO; no manual product-picker yet; bn editing via `?locale=bn`.

## Operational notes / gotchas

- **Admin shows `useNavigate()`/Router errors** after an `npm install`: a duplicate
  `react-router-dom` was reintroduced. Fix:
  ```bash
  rm -rf node_modules/@medusajs/dashboard/node_modules/react-router-dom \
         node_modules/@medusajs/dashboard/node_modules/react-router \
         apps/backend/node_modules/.vite apps/backend/.medusa
  # restart dev, then hard-refresh the admin (Cmd+Shift+R)
  ```
- **Theme switch didn't update a page**: theme/settings changes now broadly
  revalidate (`/api/cms/revalidate` calls `revalidatePath("/", "layout")` on the
  `cms-settings` tag). After big dependency/theme-file changes, restart `npm run dev`
  so all routes load the current theme registry.
- **Secrets** (shared by both apps): `CMS_REVALIDATE_SECRET` (publish/revalidate),
  `CMS_PREVIEW_SECRET` (draft preview + visual-editor key). Backend `.env`,
  storefront `.env.local`.

## Recommended hardening (next pass)

- Make the react-router dedupe permanent in the lockfile (`overrides` + clean install).
- Visual editor: real admin SSO (replace the shared key), two-way draft sync,
  manual product-picker, full bn locale pass.
- Theme the remaining pages (checkout, account dashboard).
- Performance, accessibility, security review, automated tests, load test.
