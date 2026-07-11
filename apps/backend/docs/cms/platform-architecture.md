# Storefront Platform Architecture (v2) — the real spine

Goal: a Shopify-like platform with our OWN pre-built themes (no external uploads). A
user picks a theme, gets a working store in minutes, and edits it like Elementor —
smoothly, in real time, production-grade. Must scale to many themes and (later) many
stores.

This document is grounded in deep research of Shopify Online Store 2.0, Elementor +
WordPress Full-Site-Editing, and the headless builders (Builder.io, Webstudio,
Sanity Presentation, Puck). They all converge on the same architecture. We will copy
it, not reinvent it.

---

## The one idea that fixes everything: three hard layers

Every production visual builder separates exactly three things, and never couples them:

```
1. SCHEMA   — what is editable (declared once, per block)        [code, versioned]
2. DATA     — the values a user chose (sections, order, props)   [DB, per page/store]
3. RENDER   — components that turn data → the real page          [theme code]
```

- The **editor is a generic interpreter of SCHEMA.** It contains zero theme-specific
  code. Add a theme with 40 sections → the editor needs no changes. (Shopify: the
  editor only reads `{% schema %}`; Elementor: it only reads `register_controls()`.)
- **DATA is the page** — a JSON document of sections, not hardcoded React. This is the
  Shopify "JSON template" / Elementor `_elementor_data` model.
- **RENDER is the theme** — a component per block type. Swappable.

Our current system has fragments of all three but **no schema layer**, so the editor
*guesses* controls from JSON (the audit's #1 finding). That is the root cause of "not
professional." Everything else follows from fixing this.

---

## Target architecture

### A. Block schema = single source of truth (kills the 4× duplication)

One TypeScript object per block drives the editor panel, the defaults, validation,
and the component's props. (Mirrors Shopify section schema + Builder.io `inputs` +
Puck `fields`.)

```ts
type FieldType =
  | "text" | "textarea" | "richText" | "number" | "boolean"
  | "select" | "color" | "image" | "url" | "product" | "collection"
  | "object" | "list"

interface FieldDef {
  name: string
  type: FieldType
  label: string
  default?: unknown
  required?: boolean
  help?: string
  group?: string                                  // groups fields under a heading
  hidden?: (props: Record<string, unknown>) => boolean   // conditional (TS fn, not a string)
  options?: { label: string; value: string }[]    // select
  fields?: FieldDef[]                              // object / list (recursive)
  min?: number; max?: number; step?: number        // number / range
  maxItems?: number                                // list
}

interface BlockSchema {
  type: string                  // STABLE key: "hero_slider" (theme-agnostic)
  label: string
  category: string              // "hero" | "products" | "content" | "media" | "social"
  icon?: string
  fields: FieldDef[]
  defaultProps: Record<string, unknown>
  presets?: { name: string; props: Record<string, unknown> }[]  // "Add section" entries
  maxInstances?: number         // e.g. 1 hero per page
  allowedTemplates?: string[]   // guardrail: which page types may use this block
  lock?: "none" | "contentOnly" // pre-built theme protection (can't break layout)
}
```

Validation, defaults, and the admin form are all DERIVED from this — no hand-written
forms, no duplicated interfaces.

### B. Theme = a package (pluggable; scales to many)

```ts
interface ThemeBlock { schema: BlockSchema; Component: React.ComponentType<any> }

interface DesignToken {
  name: string; cssVar: string; label: string
  type: "color" | "font" | "spacing" | "size"; default: string; group: string
}

interface PageTemplate {
  type: string                    // "home" | "page" | "product" | "collection" | ...
  label: string
  defaultSections: { type: string; props: Record<string, unknown> }[]
}

interface ThemeConfig {
  id: string; label: string; version: string
  blocks: Record<string, ThemeBlock>      // key === BlockSchema.type
  designTokens: DesignToken[]              // colors/fonts/spacing → CSS vars
  globalSettings: FieldDef[]               // the "Theme Settings" panel
  templates: Record<string, PageTemplate>  // default content per page type
  headerSchema: BlockSchema                // editable chrome
  footerSchema: BlockSchema
  stylesheets?: string[]; preview?: string
}
```

Adding a theme = provide components + schemas + tokens + templates. The editor works
automatically. This is the answer to "can we handle 20-30 themes": yes, by contract.

### C. Data format (what we store + publish)

```ts
interface StoredSection { id: string; type: string; props: Record<string, unknown> }
interface StoredPage   { storeId?: string; slug: string; templateType: string; sections: StoredSection[] }
interface StoredLayout { storeId?: string; header: StoredSection[]; footer: StoredSection[] }   // chrome, site-wide
interface StoredThemeSettings { storeId?: string; themeId: string; tokenOverrides: Record<string,string>; globalProps: Record<string,unknown> }
```

`storeId` is optional now and required later — multi-store slots in without a rewrite.
We already have a solid **publish-snapshot pipeline** (versioned, revisions,
revalidation, i18n) — we keep it and publish these documents through it.

### D. The editor (Elementor/Shopify-class)

- **Two-frame, same-origin:** an editor shell + an `<iframe>` of the REAL storefront
  (we already built this — the research validates it as the correct approach).
- **Schema-driven panel:** select a section → the panel renders real controls from the
  block's schema (image picker, color, select, range, repeater, product picker…). No
  guessing.
- **Real-time via targeted patches (the smoothness fix):** an edit sends a JSON patch
  over `postMessage`; the iframe applies it to a small client store; **only that
  section re-renders.** (Today we replace the whole array each keystroke — that's the
  jank.) Dual-render: blocks that are pure presentation update instantly client-side;
  live-data blocks (products) reuse the real server component.
- **Global theme settings → CSS variables:** colors/fonts/spacing are CSS custom
  properties; the panel writes the token via a `<style>` tag → instant cascade, no
  re-render.
- **Editable header/footer:** chrome is schema-driven "layout zones," edited in the
  same iframe, stored in `StoredLayout`, applied site-wide.
- **Multi-page:** a catch-all storefront route renders any CMS page; the editor edits
  any page/template; `allowedTemplates` guards which blocks fit where.
- **Section tree** (add/reorder/remove/select), **presets** (plug-and-play),
  **content-only lock** (users can't break a theme's layout), **undo/redo** at the
  model level.

### E. Multi-store (later, but designed in)

Everything keys by `storeId`; theme + token overrides are per store; the editor loads
by `?storeId`. Standard row-scoping + subdomain/path routing. Deferred to its own
phase so the single-store MVP ships first.

---

## What we keep vs. build

KEEP (audit says solid): the publish-snapshot pipeline (versions/revisions/
revalidation/i18n), the theme-registry idea, and the iframe-of-real-page editor we
just built (it's the right foundation).

BUILD (the missing spine + pieces):
1. the **schema layer** (one schema per block) — unify the 4× duplication;
2. the **schema-driven control panel** — replace guess-from-JSON;
3. **targeted patch updates** — replace full re-render (smoothness);
4. **editable header/footer**;
5. **multi-page rendering + templates** (catch-all route);
6. **global theme settings → CSS vars** + **presets** + **content-only lock**;
7. **theme package contract** + scaffold (prove a 3rd theme is fast);
8. **multi-store** (later);
9. **hardening** (perf/a11y/security/draft-mode cookies/tests/docs).

---

## Phased plan (each phase ships + is verified; sign-off per phase)

- **P1 — Schema spine.** Define `BlockSchema`; author schemas for all 11 blocks as the
  single source of truth; derive defaults + validation; make backend + storefront
  consume it. Outcome: no duplication; a real, introspectable schema.
- **P2 — Schema-driven editor panel.** Replace `FieldEditor` (guesser) with a control
  renderer driven by the schema (all field types incl. product/image pickers). Outcome:
  professional, consistent editing.
- **P3 — Real-time targeted patches.** Client store in the iframe + JSON-patch bridge →
  per-section re-render; dual-render. Outcome: smooth, instant, no jank.
- **P4 — Editable header/footer.** Chrome as schema-driven layout zones, site-wide.
  Outcome: the "no header/footer" gap closed.
- **P5 — Multi-page + templates.** Catch-all storefront route; page templates +
  guardrails; edit any page. Outcome: real multi-page, not home-only.
- **P6 — Theme settings + presets + lock.** Global design tokens (CSS vars) panel;
  presets for plug-and-play; content-only locking. Outcome: the "wow", plug-and-play feel.
- **P7 — Theme package + scale.** Formalize the package; conform Learts + Aurora; build
  a 3rd theme fast to prove scale. Outcome: many-themes by contract.
- **P8 — Multi-store (optional/when needed).** Tenant keying + per-store theme/tokens.
- **P9 — Hardening.** Perf, a11y, security, draft-mode, undo/redo, tests, runbook.

Each phase: agents build → I integrate + verify live → you sign off → next.

---

## Sources

Shopify OS 2.0 theme architecture, section schema, JSON templates, section groups,
Section Rendering API, settings_schema (shopify.dev). Elementor controls/dual-render/
data-model + WordPress FSE template parts + theme.json (developers.elementor.com,
developer.wordpress.org). Headless builder bridges: Builder.io, Webstudio, Sanity
Presentation/Comlink, Prismic, TinaCMS, Puck.
