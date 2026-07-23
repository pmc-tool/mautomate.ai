# P5V — Adversarial verification of Phase 5 (the slider)

Seat: 5V (adversarial verifier). Date: 2026-07-20. VM: ratul@192.168.200.201,
repo /home/ratul/brandtodoor/apps/storefront. Read-only against DB (SELECT only).
No builds, no pm2, no publishes, no source edits. All probe scripts under /tmp on
the VM; evidence dirs /home/ratul/editor-truth/ and /home/ratul/phase2-backups/.

NOTE ON PATHS: the mandate's `plans/editor-architecture/` tree does not exist on
the VM. The architecture of record was read from the same content mirrored in the
scratchpad (`arch/ARCH-SLIDER.md`, 558 lines) and the seat notes in
`/home/ratul/phase2-backups/5a/5A-NOTES.md` and `.../5c-cont/5C-CONT-NOTES.md`.
This report is written to the mandated paths (created) and mirrored.

---

## VERDICT

Phase 5 CAN GATE. Every headline claim reproduced. One MEDIUM latent-correctness
finding (F1: the up-<i> render-time id collision) that is NOT reachable through the
shipped stage editor and matches the caveat the prior seats explicitly documented
and accepted; it must be fixed before any *layered* catalog template or content
import ships. All other findings are NOTE-severity / by-design.

Per-claim: 1 PASS · 2 PASS · 3 PASS(collision real but bounded → F1) · 4 PASS ·
5 PASS · 6 PASS · 7 PASS · 8 PASS.

---

## FINDINGS

### F1 — up-<i> render-time id collision in mixed sliders — MEDIUM
The render-time upgrade of leftover fields slides derives ids purely from array
index: `upgradeFieldsSlide(slide, {index:i})` → id `up-<i>`
(`src/modules/cms/slider/upgrade.ts:77`, `id = \`up-${idx}\``). A slider that
stores a LAYERED slide whose id is already `up-N` alongside a fields slide sitting
at index N produces two slides with the same id at render.

Reproduction (rendered through the REAL engine, learts-liquid):
- fixture /tmp/5v-collision.json: slide0 = stored layered `{id:"up-1", layers:[…]}`,
  slide1 = a fields slide (upgrades at render, index 1 → id `up-1`).
- output /tmp/5v-coll-out/section-0-hero_slider.html:
  `data-slide="up-1"` appears on BOTH `.ffs-slide` elements; layer ids collide too
  (`data-layer="up-1-title"` on both slides, `up-1-kicker`/`up-1-cta` duplicated).
  The scoped CSS selector `[data-slide="up-1"]` matches twice; per-layer frame CSS
  is emitted once per slide for the SAME selector, so the later emission (the
  fields upgrade, cl/8/0/w46) overrides the stored slide's own title frame
  (cc/0/0/w40) for BOTH title elements → visible mis-placement + broken per-slide
  background/overlay scoping.

Evidence file:line — `render/slider-css.ts:526-533` (selector `[data-slide="<sid>"]`
keyed on the possibly-duplicate id; no dedup), `render/slider-html.ts:287-293`
(render-time upgrade uses index i as the sole id seed), `upgrade.ts:76-78`.

Reachability ruling (the mandate's core question): NOT reachable through the shipped
stage editor. `slider.upgradeSlide` → `upgradeSlides` converts EVERY fields slide in
one command (`editor/slider/stage-commands.ts:590-608`), so post-upgrade no fields
slide coexists with any `up-N`; `slideReorder` keeps stored ids but introduces no new
render-time upgrade (all slides layered → renderer never re-derives `up-N`); newly
staged slides get a fresh nanoid id at dispatch, never `up-N`. The collision is
reachable ONLY via hand-authored / template-seed / API JSON that simultaneously (a)
stores a layered slide with an `up-N` id and (b) leaves a fields slide at index N —
i.e. exactly the "some slides upgraded" mixed state ARCH-SLIDER §5 calls "legal."
Current live exposure is nil: the DB has 0 layered pages and 0 layered catalog
templates. This matches the accepted caveat in 5C-CONT-NOTES §1 verbatim.
Cheap fix before layered templates/import ship: namespace render-time ids off the
slide's array position with a render-only prefix (e.g. `ren-<i>`) or dedup ids in
buildSliderCss/renderSliderHtml.

### F2 — cqw typography scales UP unbounded above the 1200px reference — NOTE
`scaledPxToCss` (`render/slider-css.ts:124-129`) emits `max(<floor>px,<px/12>cqw)`.
The floor only clamps the LOW end; above the 1200 reference the cqw term grows
without ceiling (40px authored → 42.7px at a 1280 container, ~64px at 1920). This is
the documented RevSlider grid-scaling behavior (ARCH-SLIDER §2.2) and applies equally
to the theme's own heroes' intent, but merchants who type "40px" will see larger text
on wide monitors. By design; noted so it is a conscious ship decision, not a surprise.

### F3 — sub-12px / sub-reference fonts render at the 12px floor — NOTE
For authored sizes below ~32px the floor `max(12, round(px*0.375))` can exceed the
value the cqw term yields at the 1200 reference (an 8px caption renders 12px at
reference). This is the intended legibility floor (never below 12px) but is a minor
WYSIWYG deviation for very small authored sizes. By design.

### F4 — escapeUrl refuses javascript/vbscript/data but NOT file: — NOTE/LOW
`render/slider-html.ts:89-100` (`escapeUrl`) and `slider-css.ts:87-102` (`cssUrl`)
refuse `javascript:`/`vbscript:`/`data:` but not `file:`, whereas the shared
`sanitize-html.ts` (`hasDangerousScheme`) also refuses `file:`. A `file:` URL in an
`<img src>`/`<a href>` on an https page is inert in browsers, so not exploitable, but
the two schema-refusal lists differ. Cosmetic hardening only.

### F5 — no-JS hides slides 2..n (only slide 0 visible) — NOTE
`SLIDER_BASE_CSS` sets `.ffs-slide{opacity:0;pointer-events:none}` with only
`.ffs-slide.ffs-active` visible; the server stamps `ffs-active` on slide 0 ONLY. With
JS disabled, slide 0's full content shows but slides 2..n are permanently hidden and
unreachable. Standard carousel progressive-enhancement; the primary hero message is
always visible. Distinct from the entrance system, which is correctly `.ffs-js`-gated
(claim 8 PASS). Noted for completeness.

---

## PASS — confirmed claims with reproduced numbers

CLAIM 1 — byte-identity of untouched heroes: PASS.
- `editor-truth/diff.sh`: 30 pages checked in 16s — 0 changed.
- DB (SELECT only): 21 snapshots contain hero_slider across 6 tenants; `"layers"` key
  count = 0 → NO live page is layered; every live hero is still fields-shaped.
- Broad render: all 4 LIVE hero_slider home snapshots rendered through the current
  engine across 5 themes (learts/rokon/shofy + unused katan/gamerik) = 20 renders,
  `class="ffs"` platform markup count = 0 in every one → untouched heroes never touch
  the platform renderer; all route to theme Liquid, no crashes.
- Pre/post 5A baselines `diff -rq` IDENTICAL: heroset on learts/rokon/shofy,
  woodlands (33 sections), 1v-adversarial on learts + rokon.
For untouched heroes the diff is not merely "only the entrance block" — it is ZERO
(the entrance block appears only in LAYERED platform output).

CLAIM 2 — upgrade/undo round-trip + idempotence: PASS.
- Undo mechanism is a SNAPSHOT of the before-state, not a re-derivation:
  `slider.upgradeSlide.invert` → `sectionInverse` → `{name:"section.setProps",
  args:{index, section: state.content[index]}}` (registry.ts:656-663, 1818) restores
  the exact original fields-shaped section object wholesale.
- invert suite: 358 passed, 0 failed (includes upgradeSlide fields→layered undo,
  idSeed-independence, up-<i> ids, placement round-trip/determinism/malformed).
- 5V upgrade attack (19/19, bundled against the REAL upgrade.ts): null==undefined,
  empty→up-0 empty-layers color-bg, deterministic double-run, no-mutation on frozen
  input, layered-as-fields→0 layers, title HTML escaped + \n→<br>, missing image→color
  / present→image, 1-field slides, cta-without-href→0 layers, negative/float index→up-0,
  index 99→up-99, whitespace-only fields→0 layers, isLayeredSlider mixed/pure.

CLAIM 3 — up-<i> collision caveat: PASS (ruled) → see F1. Constructed the scenario,
reproduced the duplicate-id corruption through the real engine, ruled reachability:
bounded to non-editor authoring; matches the accepted 5C caveat.

CLAIM 4 — cqw typography floor: PASS. `scaledPxToCss` math verified empirically in
emitted CSS (icon size 40 → `max(15px,3.333cqw)`; button base `max(12px,1.167cqw)`).
Computed px at container widths for a 40px headline: 320→15px (floor holds), 360→15px,
768→25.6px, 1200→40px (WYSIWYG at reference), 1280→42.7px. Nothing drops below 12px;
a 40px headline never below 15px. Text never becomes unreadable at 320px. (Upward
unbounded scaling noted F2.)

CLAIM 5 — sanitization of text/button/image/shape/icon + AI paths: PASS.
Attacked through the REAL engine (/tmp/5v-xss.json → /tmp/5v-xss-out):
- text layer.props.html `<script>`/`<svg onload>`/`<iframe>` stripped; `<img onerror>`
  → onerror removed (bare `<img src=x>` kept, allowed); `<a href="javascript:">`
  → href="#"; `<b onclick style="position;background:url(javascript:)">` → onclick
  removed, style filtered to `color:red` only.
- button: label `</a><script>` HTML-escaped; href `javascript:` → "#".
- image: src `javascript:` → escapeUrl "" → WHOLE LAYER DROPPED (i1 absent from output);
  alt `"><script>` escaped.
- shape: href `data:text/html,<script>` refused → rendered as inert `<div>`.
- icon: hostile class `fa"><script>` attribute-escaped (`fa&quot;&gt;&lt;script&gt;`).
- background image `javascript:` and slide `link` `javascript:` both refused → no
  background-image / no slide-link anchor emitted.
- full CSS passes through `.replace(/</g,"")` so the `<style>` can never be closed.
AI-path safety: the sanitizer (`sanitizeHtml` in `renderLayer`, slider-html.ts:155) is a
RENDER-TIME chokepoint on `props.html` — every write path (manual, AI rewrite, AI
arrange) stores raw props and is sanitized identically on the way out; there is no
alternate renderer. The AI `arrange` action additionally validates frames numerically
before merge (per 5C notes). No bypass exists.

CLAIM 6 — gates reproduce: PASS (all re-run on the VM, node v22.22.0):
- verify-stage-parity: 126 passed, 0 failed.
- verify-slider: 96 passed, 0 failed.
- invert suite: 358 passed, 0 failed.
- normalize: ALL PASS — 20 checks.
- verify-responsive (3C): 42 passed, 0 failed.
- tsc storefront: 471 errors, and the error SET is byte-identical to the 5c-cont
  baseline (`diff <(sort baseline) <(sort now)` empty, both 471) — same set, not just
  same count.

CLAIM 7 — placement hints: PASS.
- shofy end-to-end through the real engine: render-time upgrade of a fields slide in a
  mixed slider on shofy-liquid emits `[data-layer="up-1-title"]{left:6%;…;width:38%}`
  and `up-1-kicker{left:6%;…}` — exactly THEME_SLIDER_PLACEMENTS.shofy.
- engine wiring confirmed: `theme-runtime/engine.ts:219` passes
  `placement: placementForTheme(ctx.themeId)`.
- unknown-theme fallback: placement unit attacks 10/10 (rokon/shofy resolve; learts /
  unknown / ""/null/number → undefined → DEFAULT; malformed/array/NaN hints → default
  frame x=8). Render through katan-liquid (unused theme, no placement entry) →
  `up-1-title{left:8%;…;width:46%}` (DEFAULT_PLACEMENT), no crash.

CLAIM 8 — entrance animation safety: PASS.
- No-JS never hides layer content: every `opacity:0` hide in SLIDER_ENTRANCE_CSS is
  gated on `.ffs.ffs-js` (grep for ungated opacity:0 → NONE). `public/ffslider.js:17`
  adds `ffs-js` only when JS runs.
- reduced-motion instant: `@media (prefers-reduced-motion:reduce){.ffs.ffs-js
  [data-ffs-anim]{opacity:1;transform:none;scale:1;transition:none}}` — content shown
  at once even before ffs-in is stamped.
- byte-stable: SLIDER_ENTRANCE_CSS is a constant string (no interpolation/ordering
  nondeterminism); per-layer duration override iterates arrays in order; two identical
  renders of /tmp/5v-xss.json produced identical sha256 (4fbf6f9f0295 == 4fbf6f9f0295).

---

## INTEGRATOR-OWNED CHECKS (build/browser dependent — NOT run by 5V)
- Real-browser cqw scaling at 320/360/768/1280 (visual legibility) — headless CSS math
  verified; on-screen render is browser-owned.
- The AI arrange/rewrite chips and the stage editor gestures require a `next build` +
  backend restart to exercise in-browser (5C notes call this out).
- Live entrance-animation replay + stagger visual timing in the browser.
- Backend tsc (3585 per 5C) not re-run — 5V mandate scoped to the storefront surface;
  backend Phase-5 change was one file (ai-node/route.ts).
