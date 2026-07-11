# Elementor-Grade Editor — Teardown & Phased Build Plan

_Multi-agent Elementor research (8 facets) + codebase gap analysis + synthesis, 2026-07-01. 6 phases, a 4-agent team each._

## Executive summary

The store owner's complaint ("padding margin gaps nothing I can edit here") is architecturally accurate, not a UI gap. Our editor at /Users/nowshidalamsayem/Desktop/CLAUDE/my-store/apps/storefront is CONTENT-ONLY: SchemaPanel.tsx renders one flat field list from each block's BlockSchema.fields; the render path (section-renderer.tsx production, app/editor-canvas/[slug]/page.tsx editor) spreads content props into hardcoded block components (modules/cms/blocks/*.tsx) whose only styling hook is 8 GLOBAL theme CSS vars. Each section is wrapped in a display:contents element carrying data-cms-idx — it generates no box, so there is literally nowhere for spacing/background/border to live or render. The device toggle in app/editor/[slug]/page.tsx only resizes the iframe (DEVICE_WIDTH 820/390); no field stores a per-device value. Closing the Elementor gap is therefore ONE coherent spine: (1) a universal Style + Advanced schema every block carries in a namespaced block.style/block.advanced bag (separate from content), (2) a responsive {base,tablet,mobile} value shape with a cascade resolver, (3) a tabbed Content/Style/Advanced panel, (4) a render layer that turns the display:contents wrapper into a real positioned box and emits scoped <style> with @media rules keyed per-section id, and (5) five new field types (dimensions, unit-number, typography-group, background, border/shadow). Everything else Elementor does (copy-paste style, navigator badges, global tokens, motion, per-device visibility, custom CSS) layers cleanly on top of that spine and requires NO change to the block renderers once the wrapper box exists. This brief sequences that spine first, ships a spacing/padding quick win in week one, then adds capability in ordered phases with a dedicated agent team per phase.

## North star

"Elementor-grade" for this store editor means: every section (and every chrome region) exposes the same three tabs — Content (its existing schema fields, unchanged), Style (spacing, background, border, radius, shadow, typography, size/gap/alignment), Advanced (per-device visibility, position/z-index, custom CSS/class, motion) — with an identical control vocabulary across all 11 blocks, where any spacing/typography/size value can be set independently per device (desktop→tablet→mobile cascade with ghosted inherited values and one-click reset), values are stored as small diffs in block.style/block.advanced never baked into markup, and the same generated CSS drives both the resized editor iframe and the live storefront so what you see is pixel-identical to what ships. The owner can select any section and adjust its top/bottom padding, gap, background and border in seconds — the thing they cannot do today — and do it differently on mobile, without a developer.

## Foundational architecture (build this spine first)

### Add a universal Style schema and universal Advanced schema as two shared FieldDef[] arrays (new file modules/cms/schema/universal/style.ts + advanced.ts), merged into every block at panel-build time — NOT authored per block. Store their values in namespaced block.style and block.advanced objects, kept fully separate from content props so copy-style/reset never touch text.

**Why:** This is the direct fix for the #1 complaint and the single decision that unblocks 90% of Elementor parity: one schema, edited once, gives all 11 blocks + header/topbar/footer spacing/background/border/typography for free, and makes style a first-class separable unit (prereq for copy-style, reset-style, presets, navigator badges).

**Touches:** modules/cms/schema/universal/style.ts (new), modules/cms/schema/universal/advanced.ts (new), modules/cms/schema/index.ts (getPanelSchema helper merging content+style+advanced), modules/cms/schema/types.ts (BlockSchema stays content-only)

### Introduce a responsive value shape { base, tablet?, mobile? } plus a FieldDef.responsive:boolean flag and a resolveResponsive(value, device) cascade util (tablet ?? base; mobile ?? tablet ?? base). Only size-like leaves (padding sides, margin sides, gap, fontSize, lineHeight, letterSpacing, width) are flagged responsive; fontFamily/weight/color stay scalar.

**Why:** Elementor treats responsiveness as a per-control capability, not a page mode. Our device toggle already exists but stores nothing — this shape is what lets tablet/mobile hold distinct values while unset devices inherit, matching the owner's mental model and keeping stored JSON tiny (diffs only).

**Touches:** modules/cms/schema/types.ts (FieldDef.responsive + value-shape types + resolveResponsive util), modules/cms/editor/SchemaPanel.tsx (read active device), app/editor/[slug]/page.tsx (promote device state to shared context/query param)

### Restructure SchemaPanel.tsx from one flat FieldList into a three-tab shell (Content / Style / Advanced). Content tab renders the block's existing schema unchanged; Style and Advanced tabs render the universal schemas against block.style / block.advanced. Add collapsible accordion grouping by FieldDef.group.

**Why:** Gives users permanent muscle memory (same 3 tabs on every element) and progressive disclosure so simple blocks stay simple. Content editing is 100% preserved — zero regression risk to today's flows.

**Touches:** modules/cms/editor/SchemaPanel.tsx (tab shell + accordion), app/editor/[slug]/page.tsx (pass style/advanced bags + onChange for each namespace, extend cms:patch payload)

### Build a StyleEngine render layer: turn the data-cms-idx wrapper from display:contents into a REAL box (<div class=cms-sec-{id}>) and generate a scoped <style> block per section that emits base rules + @media(max-width:1024px) tablet + @media(max-width:767px) mobile from block.style/advanced. Inject it next to buildThemeVars() in editor-canvas AND in section-renderer.tsx for production so editor and live are identical.

**Why:** Inline style cannot express media queries or :hover; a scoped class + generated CSS is the only way per-device values and hover states render correctly, and it makes the resized editor iframe genuinely trigger the same media queries as production (true breakpoint CSS, not simulation). This is the component every later feature (visibility, custom CSS, motion, positioning) writes into.

**Touches:** app/editor-canvas/[slug]/page.tsx (SectionItem wrapper + buildThemeVars-adjacent CSS emitter), modules/cms/section-renderer.tsx (same emitter server-side), new modules/cms/render/style-engine.ts (buildSectionCss(id, style, advanced)), themes/contract.ts (wrapper contract)

### Add five new field types to the FieldType union: 'dimensions' (4-side linked box + unit for padding/margin/radius), 'unitNumber' (slider+number+unit — generalize existing 'range'), 'typographyGroup' (family/size/weight/lineHeight/letterSpacing/transform/align popover), 'background' (color|gradient|image composite), 'border' (+ 'boxShadow'). Each renders a dedicated Control in SchemaPanel and is reused across the universal Style schema.

**Why:** These are the concrete controls the owner is missing. Building them as reusable field types (not per-block widgets) means one implementation powers every block and every future catalog element, matching Elementor's ~30-control shared library approach.

**Touches:** modules/cms/schema/types.ts (FieldType union + per-type FieldDef options), modules/cms/editor/SchemaPanel.tsx (DimensionsControl, UnitNumberControl, TypographyControl, BackgroundControl, BorderControl, BoxShadowControl), modules/cms/render/style-engine.ts (serialize each to CSS)

## Quick wins (ship the spacing/padding/gaps complaint FAST)

- Ship a Style tab with ONLY a 'Spacing' accordion (top/bottom/left/right padding + margin + gap via a new DimensionsControl) writing to block.style, desktop-only, before the full responsive system lands. This alone answers the literal complaint ('padding margin gaps nothing I can edit') in week one.
- Flip the data-cms-idx wrapper in app/editor-canvas/[slug]/page.tsx (line ~48) and section-renderer.tsx from display:contents to a real <div> that applies computed padding/margin/gap inline — the smallest change that makes spacing actually render, reusable as the foundation box for everything later.
- Expose a 'Section background' color field (reusing the existing 'color' control) in the new Style tab immediately — trivial to render as background-color on the new wrapper box, high perceived value.
- Add a 'Max width / content width' select (narrow/normal/wide/full) to the universal Style schema, generalizing the pattern already proven in rich_text.width and image_with_text.image_side so it works on ALL blocks.
- Promote the existing device state in app/editor/[slug]/page.tsx (desktop/tablet/mobile, DEVICE_WIDTH) into a shared context now, even before per-device values exist, so the spacing controls can become device-aware in the very next iteration with no rewiring.
- Add a collapsible-accordion grouping to the current flat FieldList (FieldDef.group already exists in types.ts and is partitioned in SchemaPanel FieldList) — purely presentational, makes long panels feel professional immediately.

## Phases

### Phase 1 — Foundation: data model, universal schemas, resolver

**Goal:** Establish the block.style/block.advanced namespaced data model, the universal Style/Advanced FieldDef arrays, the responsive value shape + resolveResponsive cascade util, and the five new field-type definitions — WITHOUT yet rendering anything. Pure data + type layer so every later phase has a stable contract.

**Rationale:** All eight gaps in our audit trace back to there being no place to store non-content style data and no shared schema to describe it. Building this contract first lets render, panel, and responsive work proceed in parallel afterward against a frozen interface. It is also low-risk: adding optional style/advanced bags cannot break existing content-only pages (they simply have empty bags).

**Agent team:**

- **Schema Architect** — In modules/cms/schema/types.ts extend the FieldType union with dimensions | unitNumber | typographyGroup | background | border | boxShadow | choose | code; add FieldDef.responsive:boolean and the per-type option fields (sides, units[], gradient support). Add a getPanelSchema(block) helper in schema/index.ts returning { content: block.schema.fields, style: UNIVERSAL_STYLE, advanced: UNIVERSAL_ADVANCED }. Keep BlockSchema content-only.
- **Style-Schema Author** — Create modules/cms/schema/universal/style.ts defining UNIVERSAL_STYLE as grouped FieldDef[]: Spacing (padding/margin dimensions, gap unitNumber — responsive), Size (width, maxWidth/content-width select), Background (background type), Border (border + radius + boxShadow), Typography (typographyGroup — size responsive), Layout (align-items/justify/text-align via choose). Mark only size-like leaves responsive:true.
- **Advanced-Schema Author** — Create modules/cms/schema/universal/advanced.ts defining UNIVERSAL_ADVANCED: Visibility {hideOnDesktop/Tablet/Mobile booleans}, Position {position choose, zIndex number, offsets}, anchorId text, customClass text, customCss code. Ensure every field carries a group so accordions render cleanly.
- **Responsive-Model Engineer** — In types.ts add the responsive value shape type ResponsiveValue<T> = { base:T; tablet?:T; mobile?:T } and implement resolveResponsive(value, device) with the desktop→tablet→mobile cascade, plus defaultForField/validateFields updates so style/advanced bags get sane empty defaults and never fail validation when absent.

**Deliverables:** Extended FieldType union + FieldDef flags in modules/cms/schema/types.ts; modules/cms/schema/universal/style.ts and advanced.ts; getPanelSchema() in modules/cms/schema/index.ts; resolveResponsive() util + ResponsiveValue type + unit tests

**Verification:** Unit tests: resolveResponsive returns base when tablet/mobile unset, tablet overrides base for mobile fallback chain; getPanelSchema returns three schemas for every registered block_type; defaultPropsFromSchema still produces identical content defaults for all 11 blocks (snapshot test to prove no content regression).

**Risk:** Scope creep in the universal schema — mitigate by shipping a deliberately small v1 field set (spacing/size/background/border/typography only) and deferring exotic controls. Frozen interface risk: publish the ResponsiveValue + block.style/advanced shape as a written contract before Phase 2/3 start in parallel.

### Phase 2 — Render layer: real box + scoped responsive CSS engine

**Goal:** Convert the display:contents section wrapper into a real positioned box and build style-engine.ts that serializes block.style/advanced into a scoped <style> with base + @media tablet/mobile rules, wired identically into the editor iframe (editor-canvas) and production (section-renderer). After this phase, any style data set on a section actually renders — in both contexts.

**Rationale:** This is the load-bearing beam. Without it, Phase 3 panel controls would edit data that renders nowhere. Doing it against the frozen Phase 1 contract (before the panel UI exists) lets us validate rendering with hand-authored fixture JSON and guarantees editor/live parity from day one.

**Agent team:**

- **Render Layer Engineer** — In app/editor-canvas/[slug]/page.tsx change the SectionItem wrapper (currently <div data-cms-idx style={{display:'contents'}}> at ~line 48) to <div data-cms-idx className={`cms-sec-${id}`}>, giving each section a stable id. Ensure click-select/outline logic (handleClickCapture, data-cms-idx queries at lines ~260/287/337) still resolves the same element now that it is a real box.
- **Responsive CSS Emitter** — Create modules/cms/render/style-engine.ts exporting buildSectionCss(id, style, advanced): emits `.cms-sec-{id}{...base...}` plus `@media(max-width:1024px){.cms-sec-{id}{...tablet...}}` and `@media(max-width:767px){...mobile...}` by running resolveResponsive per breakpoint, and serializes dimensions/background/border/boxShadow/typography to CSS. Include hide-on-device as display:none media rules and customCss with a {{selector}}→.cms-sec-{id} swap.
- **Production Parity Engineer** — Wire buildSectionCss into modules/cms/section-renderer.tsx (server) so published pages emit the same per-section <style> blocks, and into editor-canvas near buildThemeVars() (~line 419). Guarantee byte-identical CSS between the two paths via a shared function so there is no editor-vs-live drift.
- **Block Wrapper Refactor** — Audit the 11 modules/cms/blocks/*.tsx for hardcoded outer padding/margin that would now double up with the wrapper box; move section-level spacing responsibility to the wrapper, leaving inner layout intact. Update themes/contract.ts if the wrapper contract changes what props blocks receive.

**Deliverables:** Real-box section wrapper in editor-canvas + section-renderer; modules/cms/render/style-engine.ts (buildSectionCss) with media-query + customCss support; Shared emitter guaranteeing editor/production CSS parity; Fixture-driven render test page proving spacing/background/border apply

**Verification:** Feed a fixture page with hand-authored block.style (padding, background, border, mobile override) into both editor-canvas and section-renderer; assert identical generated CSS strings; resize the iframe to 390px and confirm the mobile @media rule visibly takes effect; confirm click-to-select still highlights the correct section after the display:contents→box change.

**Risk:** Layout regressions from removing display:contents (Bootstrap/Learts grid may have relied on it) — mitigate with a per-block visual diff pass and a feature flag to fall back to contents for un-styled sections. Double-spacing where blocks hardcode their own padding — caught by the Block Wrapper Refactor agent.

### Phase 3 — Panel UX: tabs, control library, responsive field wrapper

**Goal:** Rebuild SchemaPanel.tsx into a Content/Style/Advanced tabbed panel with collapsible accordions, implement the five new controls (dimensions, unit-number+unit, typography, background, border/shadow) plus a ResponsiveFieldWrapper (device icon, ghosted inherited value, reset-to-inherit) and a per-field reset icon backed by diff-only storage.

**Rationale:** This is where the owner finally SEES and USES the controls. It depends on Phase 1 (schemas) and Phase 2 (so edits render live). Building the controls as a reusable library — not per-block — is what delivers the 'professional feel' and powers every future catalog element.

**Agent team:**

- **Panel Tabs Engineer** — Restructure modules/cms/editor/SchemaPanel.tsx: add a 3-tab pill header (Content/Style/Advanced); Content renders today's FieldList unchanged against props; Style/Advanced render UNIVERSAL_STYLE/ADVANCED against block.style/block.advanced. Convert FieldList group partitioning (already at ~line 385) into collapsible accordion sections. Wire onChange to the correct namespace and extend the cms:patch payload in app/editor/[slug]/page.tsx to carry style/advanced.
- **Controls Library Engineer** — Implement DimensionsControl (4 linked inputs + link toggle + unit select), UnitNumberControl (slider+number+unit, generalizing existing 'range'), TypographyControl (popover group), BackgroundControl (color/gradient/image tabs), BorderControl + BoxShadowControl, and a ChooseControl (icon-button group for align/justify). Register them in SchemaPanel's Control() switch (~line 209).
- **Responsive Field Wrapper Engineer** — Build ResponsiveFieldWrapper that reads the active device from the shared device context, computes hasOverride = value[device] !== undefined, renders resolved value ghosted/muted when inherited, shows the device icon, and exposes a 'clear override' action that deletes the device key. Wrap every responsive:true field with it generically (works for dimensions/unitNumber/typography size).
- **Reset/Diff-Storage Engineer** — Adopt store-only-diffs: block.style/advanced hold only keys the user set. Add the per-field reset icon (visible when value !== default) that deletes the key. Ensure defaultPropsFromSchema does NOT pre-populate style/advanced, and the render layer falls back to theme tokens/CSS defaults for absent keys.

**Deliverables:** Tabbed Content/Style/Advanced SchemaPanel with accordions; Reusable control library: dimensions, unitNumber, typography, background, border, boxShadow, choose; ResponsiveFieldWrapper with ghosted-inherited + clear-override; Diff-only storage + per-field reset icons

**Verification:** Manual: select each of the 11 blocks, set padding/background/border in the Style tab, confirm live iframe update; switch to Mobile device, set a smaller padding, confirm it stores only under mobile and the field ghosts the desktop value when the override is cleared; confirm Content tab still edits text exactly as before; snapshot block JSON to prove style bag contains only explicitly-set diffs.

**Risk:** Panel complexity/perf with many controls — mitigate with accordion lazy-render and memoized controls. Two-way sync bugs across the cms:patch bridge — add an integration test that a style edit round-trips through postMessage to the canvas and back.

### Phase 4 — Responsive completion, visibility, and escape hatches

**Goal:** Make the device toggle fully dual-purpose (resize + active editing device), ship per-device visibility (hide on desktop/tablet/mobile), and deliver the custom CSS / custom class / positioning escape hatch — the power-user safety valve that de-risks every not-yet-built control.

**Rationale:** Phase 3 gives per-field responsive editing; this phase promotes the global device state to the single source of truth and completes the responsive story (visibility + reversal) plus the Advanced-tab escape hatches Elementor uses so the schema never has to cover 100% of cases.

**Agent team:**

- **Device-Mode State Engineer** — Promote the local device state in app/editor/[slug]/page.tsx (~line 146, DEVICE_WIDTH) to a shared React context (or query param) consumed by both the iframe resizer and SchemaPanel's ResponsiveFieldWrapper, so switching device both resizes the canvas and routes every responsive control to that device's slot.
- **Visibility & Direction Engineer** — Consume UNIVERSAL_ADVANCED visibility booleans in style-engine.ts as display:none @media rules (live + editor), and add an editor-only 'hidden on tablet/mobile' badge in the canvas/navigator so authors aren't confused when a section disappears at a width. Add a responsive flex-direction (row/row-reverse/column) field for multi-column-capable blocks.
- **Escape-Hatch Engineer** — Implement the customCss (code field with {{selector}} scoping), customClass, anchorId, and position/z-index/offset controls end-to-end: SchemaPanel controls + style-engine emission. Make the wrapper box position:relative by default and honor position:absolute/sticky. Gate raw customCss behind an admin-only flag given injection risk.
- **QA & Parity Engineer** — Author an integration matrix: for a fixture page, verify each device's rendered CSS in editor-canvas matches section-renderer output, visibility toggles hide correctly at each breakpoint, and customCss scopes to exactly one section instance (no leakage to sibling sections of the same type).

**Deliverables:** Shared device-mode context driving both canvas resize and panel editing; Per-device visibility with editor badges + responsive direction control; Custom CSS/class/anchor/position escape hatch (admin-gated CSS); Editor↔production parity integration matrix

**Verification:** Switch device to Mobile: panel controls now write mobile slot AND iframe resizes together; toggle hide-on-mobile and confirm the section vanishes only at ≤767px in both iframe and a real production preview; write `{{selector}}{outline:2px solid red}` in one section's customCss and confirm only that instance is outlined.

**Risk:** XSS via customCss — mitigate with admin-only permission gating and eventual sanitization/sandboxing. Hydration mismatch if visibility were JS-resolved — avoided by using pure @media CSS. Device-context refactor could regress the existing preview toggle — cover with a smoke test.

### Phase 5 — Global design system: tokens + link-to-global

**Goal:** Add site-wide Color and Typography tokens (extending today's 8 global --ff-* vars into a managed, named set) and let any color/typography control link to a token via a globe icon instead of a raw value, so brand edits cascade everywhere. Add a Theme Style defaults layer for buttons/headings/inputs.

**Rationale:** Our audit shows we already inject theme vars globally (buildThemeVars, schema/chrome/theme.ts); this phase turns that into a real design-system: tokens referenced by ID (not copied), resolving to CSS vars so one edit re-renders the whole site — the Elementor globe-icon model. It also makes the style layer consistent instead of a pile of one-off values.

**Agent team:**

- **Token Model Engineer** — Extend schema/chrome/theme.ts into theme.tokens.colors[] and theme.tokens.typography[] ({id,name,value}). Extend the 'color' and new 'typographyGroup' field types to store either a raw value or {ref:tokenId}. Generate `:root{--ff-color-{id}:...}` into both buildThemeVars (editor-canvas) and the production layout.
- **Token Picker UI Engineer** — Add the globe/link toggle to color and typography controls in SchemaPanel: off = raw picker, on = searchable dropdown of theme tokens; show a link/chain indicator + token name when bound. Build one shared TokenPicker reused by both control types.
- **Theme Style Defaults Engineer** — Add theme.componentDefaults (button, heading h1-h6, body, input) editable in a Theme tab, compiled to a base CSS layer (<style id=theme-defaults>) that block components use as their styling base — the concrete step to stop hardcoding Tailwind/Learts values in blocks/*.tsx.
- **Render Resolver Engineer** — Update style-engine.ts to resolve {ref:tokenId} to var(--ff-color-{id}) / var(--ff-font-{id}-*) at CSS-emit time, with a JS-computed fallback where a literal value is required, ensuring token edits cascade live in both editor and production.

**Deliverables:** Managed color + typography tokens in theme schema; Globe-icon link-to-token in color/typography controls (shared TokenPicker); Theme Style component-defaults CSS layer; Token-ref resolution in style-engine (editor + production parity)

**Verification:** Define a 'Primary' color token, link three sections' backgrounds to it, edit the token once, confirm all three update live in the iframe and in a production preview; confirm a section with a raw color is unaffected; confirm typography-token binding drives font-family/size across bound headings.

**Risk:** Migration of existing --ff-* vars — provide a one-time mapper so current theme.ts values seed the new token set without breaking live pages. Over-scoping into full Variables Manager — cap v1 at fixed named tokens; defer unlimited/typed variables and Classes.

### Phase 6 — Polish & parity: copy-style, richText, motion, navigator badges

**Goal:** Layer the high-polish Elementor affordances that the style spine now makes cheap: Copy Style / Paste Style / Reset Style, an upgraded richText toolbar (color/size/align), a shared motion wrapper (entrance + hover + sticky), and Navigator state badges — plus style presets ('save as preset').

**Rationale:** Every item here is a thin add-on over block.style/advanced from Phase 1, proving the architecture: copy-style just serializes the style object, badges just inspect it for non-empty keys, motion is one more field group + a wrapper component. These deliver the 'feels like Elementor' delight without new foundational work.

**Agent team:**

- **Copy/Paste/Preset Engineer** — Add Copy Style (serialize block.style to clipboard/localStorage), Paste Style (deep-merge into target block.style only), Reset Style (clear the object), and theme.stylePresets ('Save as preset' extracts current style into a named entry; a preset picker applies it). Surface via the canvas hover toolbar + a right-click context menu.
- **RichText Upgrade Engineer** — Extend RichTextControl in SchemaPanel.tsx beyond execCommand bold/italic/H2/P/list/link to add text color, font-size, and alignment; widen the sanitizeHtml allow-list in blocks/RichText.tsx to permit the new style attributes safely.
- **Motion Wrapper Engineer** — Add an Advanced-tab motion group (entranceAnimation select+duration, hoverAnimation select, sticky top/offset) and a shared <AnimatedBlock>/sticky wrapper applied at the section box in editor-canvas + section-renderer; honor prefers-reduced-motion. Ship a curated ~15-preset keyframes stylesheet, not all 37.
- **Navigator/Badges Engineer** — Build a Navigator tree panel in app/editor/[slug]/page.tsx driven off the section array, with click-to-select via the existing cms:select bridge, drag-reorder reusing move logic, and state badges computed by inspecting each section's style/advanced for non-empty keys (custom padding, hidden-on-device, custom CSS).

**Deliverables:** Copy/Paste/Reset Style + style presets (toolbar + context menu); Upgraded richText toolbar (color/size/align) + widened sanitizer; Motion group + shared animation/sticky wrapper (reduced-motion safe); Navigator tree with click-select, drag-reorder, and state badges

**Verification:** Copy style from a styled section, paste onto another, confirm only visual props transfer and text is untouched; save a preset and re-apply on a third section; confirm reduced-motion disables entrance animations; confirm Navigator badges appear exactly on sections with non-empty style/advanced.

**Risk:** richText sanitizer widening could open an XSS vector — restrict to an explicit style-attribute allow-list. Motion perf/jank — use IntersectionObserver + CSS classes, cap preset count, skip scroll-parallax for v1 as low-ROI.
