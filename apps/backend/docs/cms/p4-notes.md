# Phase 4 — Device Mode, Visibility & Render Parity (QA notes)

**Scope of this file:** reference documentation only. No runtime files were
changed to produce it. It records how the Phase 4 device-mode / visibility /
escape-hatch behavior renders, and how the parity guarantee is verified.

---

## 1. Editor == Production render parity

Both render paths serialize a section's `style` / `advanced` bags to scoped CSS
through the **same** function:

- `src/modules/cms/render/style-engine.ts` → `buildSectionCss(id, style, advanced)`

Callers:

- **Editor iframe:** `src/app/editor-canvas/[slug]/page.tsx` (SectionItem).
- **Production:** `src/modules/cms/section-renderer.tsx`.

Because there is a single serializer with an identical call signature on both
sides, editor and production CSS **cannot drift by construction**. The output is
scoped to `.cms-sec-<id>` (id run through `sanitizeId`), so no global leakage.

### Hybrid wrapper (parity of the box itself)

- `hasStyle(style, advanced) === false` → `buildSectionCss` returns `""` → the
  section wrapper stays `display:contents` (byte-identical to pre-CMS markup).
- `hasStyle === true` → a real `.cms-sec-sec-<idx>` box is rendered and the
  scoped rule applies. Both `editor-canvas/page.tsx` (SectionItem ~L64-96) and
  `section-renderer.tsx` implement the same hybrid switch.

---

## 2. Device mode

- The Desktop / Tablet / Mobile toggle in the editor drives BOTH (a) the iframe
  viewport width and (b) which device slot the Style/Advanced controls edit
  (via the `device` prop threaded through `SchemaPanel` →
  `ResponsiveFieldWrapper`). The editor no longer hardcodes `device="desktop"`.
- Storage remains **diff-only**: a `ResponsiveValue<T>` is `{ base, tablet?,
  mobile? }`. Editing on Tablet/Mobile writes only that device's slot; `base`
  is the Desktop value.

### CSS emission model (breakpoints)

`buildSectionCss` resolves every field per device and emits diff-only blocks:

- **Base rule** `.cms-sec-<id>{…}` — the Desktop (`base`) values.
- **Tablet** `@media (max-width:1024px){…}` — only declarations that differ
  from the Desktop base.
- **Mobile** `@media (max-width:767px){…}` — only declarations that differ from
  the **tablet** resolution (tablet's max-width query already covers mobile
  widths, so mobile diffs against tablet, not desktop).

Consequence: a fixture with `{ base, mobile }` (no tablet override) emits BOTH
the base rule AND a `max-width:767px` block, and NO `max-width:1024px` block —
asserted directly in the parity test.

---

## 3. Visibility (hide-on-device)

Emitted by `buildSectionCss` from the `advanced` bag:

- `hideOnDesktop: true` → `@media (min-width:1025px){ .cms-sec-<id>{display:none} }`
  (its own min-width query so tablet/mobile stay visible).
- `hideOnTablet: true` → adds `display:none` inside the `max-width:1024px` block.
- `hideOnMobile: true` → adds `display:none` inside the `max-width:767px` block.

A hide flag alone makes `hasStyle` true, so the section gets a real wrapper box
(no `display:contents`) and the visibility rule applies live and in production.
The editor additionally shows a "hidden on <device>" badge, but the actual
hiding is pure CSS, so live editor preview and prod match.

---

## 4. Escape hatch (Advanced)

All via the `advanced` bag, serialized by `buildSectionCss`:

- **Position:** `position` (skipped when `default`), `zIndex`, `offsetX` → `left`,
  `offsetY` → `top` (offsets are responsive).
- **Custom CSS:** `customCss`. `{{selector}}` (or the bare word `selector`) is
  replaced with `.cms-sec-<id>`; bare declarations with no `{` are wrapped in
  `.cms-sec-<id>{…}`.
- **Identity:** `anchorId` / `cssClasses` are applied on the wrapper element by
  the renderers (not part of the CSS string).

---

## 5. How parity is verified

- `scripts/verify-render-parity.ts` (run via `npm run verify:render-parity`).
  Dependency-free, runs the REAL engine under `node --experimental-strip-types`.
  Feeds fixtures (padding, responsive base+mobile, hideOnMobile, background,
  border, customCss, position) through `buildSectionCss`, asserts the expected
  rules + media queries, asserts editor CSS === production CSS for each fixture,
  and asserts `hasStyle` true/false gating. Currently **39 passed, 0 failed**.
- Complements `scripts/verify-style-engine.ts` (`npm run verify:style-engine`),
  which unit-tests the engine primitives.
