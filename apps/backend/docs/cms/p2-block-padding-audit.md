# Phase 2 — Block Padding Audit (outer/section-level spacing)

**Scope:** Analysis only. No runtime behavior changed. This documents the
outer (section-level) padding and margin each of the 11 block renderers
hardcodes, and whether that will DOUBLE-UP once the Phase 2/3 hybrid wrapper
box (`cms-sec-<id>`) applies user-set section padding/margin.

**Do NOT strip these defaults now.** Style storage is diff-only: an unstyled
section writes no `style` bag, so its wrapper contributes zero padding. If the
block's own default padding were removed today, every unstyled section would
lose its vertical rhythm and the home page would collapse. Defaults must stay
until each block's outer padding is deliberately migrated to the wrapper (and
even then only via the neutralization strategy in the Recommendations section).

---

## Reference: what the hardcoded classes actually resolve to

From `public/learts/assets/css/style.min.css`:

- `.section` → `float:left; width:100%` (no padding).
- `.section-fluid` → adds **horizontal** padding at large breakpoints only:
  55px (≥1500px), 35px (1200–1499px), 25px (768–1199px). No vertical padding.
- `.section-padding` → **vertical** padding, responsive:
  - desktop (≥1200px): `padding-top:100px; padding-bottom:100px`
  - 992–1199px: `100px / 100px`
  - tablet 768–991px: `80px / 80px`
  - mobile ≤767px: `60px / 60px`
- `.learts-pt-30` → `padding-top:30px` (no bottom).
- `.border-top-dashed` / `.border-bottom-dashed` → `1px dashed #d2d2d2`.
- `.container` → standard Bootstrap horizontal gutters (this is where inner
  horizontal padding comes from for non-fluid blocks).
- `.learts-mb-*` / `.learts-mb-n*` / `.learts-mt-*` → INNER element spacing on
  rows/cards/forms (e.g. the `row learts-mb-n30` + `col learts-mb-30` negative
  margin gutter trick). These are NOT section-level; they space child elements
  and are out of scope for the wrapper padding overlap. They are listed per
  block only for completeness.

The important takeaway: the only **outer vertical section padding** in play is
`.section-padding` (and PromoBannerGrid's lone `.learts-pt-30`). Horizontal
outer padding is `.section-fluid` (large screens) and/or `.container` gutters.
No block sets outer `margin` on its root — so **margin never double-ups**.

---

## Per-block audit

Each block's root element is a `<div className="section ...">`. The Phase 2
hybrid wrapper (`cms-sec-<id>`) will be the PARENT of this root div (in the
editor it is the `data-cms-idx` div in `SectionItem`; in production it must be
added around `<Component/>` inside `section-renderer.tsx`). Because the wrapper
is a parent box and the block's `.section-padding` sits on the child, any
wrapper padding STACKS on top of the block's own padding.

### 1. BrandStrip.tsx (line 30)
- Root classes: `section section-fluid section-padding bg-white border-top-dashed border-bottom-dashed learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal padding: `section-fluid` (large screens) + inner `.container`.
- Other: top+bottom dashed borders, white bg. Inner: `style={{gap:"20px 0"}}` on carousel row (inner, not outer).
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding` (vertical). Border + bg would also visually fight a user background/border set on the wrapper.

### 2. CategoryShowcase.tsx (line 83)
- Root classes: `section section-fluid section-padding bg-white learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `section-fluid` + `.container`. Inner: `learts-mb-n40`/`learts-mb-40`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding`.

### 3. DealOfDay.tsx (line 73)
- Root classes: `section section-fluid section-padding learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `section-fluid` + `.container`. Inner: `learts-mb-n30`; countdown inline `margin:"25px 0 30px"` (inner).
- Outer margin: none. No bg (transparent).
- **Double-up risk:** YES for user-set `padding`.

### 4. HeroSlider.tsx (line 74)
- Root classes: `section section-fluid bg-white learts-theme` — **NO `section-padding`**.
- Outer vertical padding: **none** (the slider fills its own fixed height: inline `height:700, maxHeight:"70vh"` on `.home3-slider`).
- Outer horizontal: `section-fluid` + `.container-fluid`.
- Outer margin: none.
- **Double-up risk:** LOW for padding (there is no default vertical padding to stack). A user setting padding here simply adds inset around the fixed-height slider — expected. Note the fixed `height`/`maxHeight` is inline on the inner slider, not the wrapper, so wrapper `height`/min-height controls in P3 would compose oddly; flag for P3 size handling, not a padding double-up.

### 5. ImageWithText.tsx (line 85)
- Root classes: `section section-fluid section-padding learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `section-fluid` + `.container`. Inner: `learts-mb-n30`/`learts-mb-30`.
- Outer margin: none. No bg.
- **Double-up risk:** YES for user-set `padding`.

### 6. InstagramGrid.tsx (line 38)
- Root classes: `section section-fluid section-padding bg-white learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `section-fluid` + `.container`. Inner: `learts-mb-n30`/`learts-mb-30`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding`.

### 7. Newsletter.tsx (line 28)
- Root classes: `section section-padding bg-white learts-theme` — **NO `section-fluid`**.
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `.container` gutters only (no `section-fluid`). Inner: `learts-mt-20`/`learts-mt-15`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding` (vertical).

### 8. ProductTabs.tsx → home/components/learts/product-tabs.tsx (line 37)
- ProductTabs delegates to `LeartsProductTabs`, whose root is `section section-fluid section-padding bg-white learts-theme`.
- Outer vertical padding: **100/80/60 via `section-padding`** (inside the delegated component, not in the block file).
- Outer horizontal: `section-fluid` + `.container`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding`. NOTE: the padding lives in a SHARED theme component (`product-tabs.tsx`), reused outside CMS — must not be stripped/edited for CMS purposes; the neutralization must be done from the wrapper CSS side (see Recommendations).

### 9. PromoBannerGrid.tsx (line 88)
- Root classes: `section section-fluid learts-pt-30 bg-white learts-theme` — **NO `section-padding`; asymmetric `learts-pt-30`**.
- Outer vertical padding: **`padding-top:30px` only, no padding-bottom** (bottom rhythm comes from the `row learts-mb-n30` + `col learts-mb-30` negative-margin gutter trick — inner).
- Outer horizontal: `section-fluid` + `.container`.
- Outer margin: none.
- **Double-up risk:** PARTIAL/ASYMMETRIC. A user-set `padding` would stack on the 30px top only. This is the odd one out — its default top padding is 30px (not 100px) and it has no bottom padding. If P3 neutralizes inner padding on override, it must zero `padding-top` here specifically; a blanket reset would still be correct (it only has a top value).

### 10. RichText.tsx (line 52)
- Root classes: `section section-padding bg-white learts-theme` — **NO `section-fluid`**.
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `.container` / `.container-fluid` (varies by `width` prop); `full` width uses `container-fluid px-0`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding` (vertical).

### 11. Testimonials.tsx (line 50)
- Root classes: `section section-fluid section-padding bg-white learts-theme`
- Outer vertical padding: **100/80/60 via `section-padding`**.
- Outer horizontal: `section-fluid` + `.container`. Inner: `justify-content-center`, `learts-mb-30`.
- Outer margin: none.
- **Double-up risk:** YES for user-set `padding`.

---

## Summary table

| Block | Outer vertical padding | Outer horiz padding | section-fluid | bg-white | Padding double-up? |
|---|---|---|---|---|---|
| BrandStrip | section-padding 100/80/60 | fluid + container | yes | yes (+ dashed borders) | YES |
| CategoryShowcase | section-padding 100/80/60 | fluid + container | yes | yes | YES |
| DealOfDay | section-padding 100/80/60 | fluid + container | yes | no | YES |
| HeroSlider | none | fluid + container-fluid | yes | yes | LOW (no default) |
| ImageWithText | section-padding 100/80/60 | fluid + container | yes | no | YES |
| InstagramGrid | section-padding 100/80/60 | fluid + container | yes | yes | YES |
| Newsletter | section-padding 100/80/60 | container only | no | yes | YES |
| ProductTabs (shared) | section-padding 100/80/60 | fluid + container | yes | yes | YES (shared comp) |
| PromoBannerGrid | learts-pt-30 (top 30px only) | fluid + container | yes | yes | PARTIAL/asymmetric |
| RichText | section-padding 100/80/60 | container(-fluid) | no | yes | YES |
| Testimonials | section-padding 100/80/60 | fluid + container | yes | yes | YES |

**Findings:**
- 9 of 11 blocks hardcode `.section-padding` (100/80/60 responsive vertical). All 9 will double their vertical padding if the wrapper also applies user `padding`.
- HeroSlider has NO outer vertical padding (safe; its size is a fixed inner height).
- PromoBannerGrid is the anomaly: asymmetric `padding-top:30px`, no bottom.
- NO block sets an outer `margin` on its root → user-set `margin` never double-ups; it composes cleanly onto the wrapper.
- Horizontal outer padding is never user-overridable-vs-doubling in a harmful way today (it comes from `section-fluid`/`container`), but if P3 exposes horizontal padding it would also stack — same neutralization applies.

---

## Recommendations for P3 (avoid double-padding without blanking the page)

The wrapper box (`cms-sec-<id>`) is a PARENT of the block's `.section` root, so
naive wrapper padding STACKS on the block's own `section-padding`. Diff-only
storage means we cannot simply strip the block defaults (unstyled sections
would lose their rhythm). Recommended approach, in priority order:

### R1 (recommended): wrapper applies padding AND neutralizes the inner default, but only for the sides the user actually set

`buildSectionCss` should target the wrapper for the user value, and emit a
companion rule that zeroes the inner block's default on the SAME axis, scoped
to the wrapper so unstyled sections are untouched:

```
.cms-sec-<id> { padding-top: <user>; padding-bottom: <user>; }
.cms-sec-<id> > .section { padding-top: 0 !important; padding-bottom: 0 !important; }
```

- Emit the `> .section` reset **only for the padding sides present in the diff**
  (e.g. if only `padding.top` is set, reset only `padding-top`). This preserves
  the responsive 100/80/60 on any side the user did NOT override.
- `.cms-sec-<id> > .section` is a uniform, single selector that works for ALL
  11 blocks: every block's root element is `<div class="section …">`, and it is
  the immediate child of the wrapper in both contexts. `SectionErrorBoundary`
  renders `this.props.children` with no extra DOM node (verified), so the
  production DOM is `wrapper > .section` just like the editor's
  `SectionItem` (`data-cms-idx`) > `.section`. Keep the two identical by
  generating this CSS from the SHARED build function the brief mandates.
- This also fixes PromoBannerGrid (its only outer value is `padding-top:30px`,
  which the top-side reset zeroes) and the ProductTabs shared component (we
  neutralize from the CMS wrapper side, never editing the shared theme file).
- HeroSlider needs no reset (no default), but the generic rule is harmless
  there.

### R2 (alternative): put the class on the block root, not a new parent

If P2/P3 instead adds `cms-sec-<id>` directly onto the block's OWN root
`.section` element (rather than an extra parent div), then user `padding`
targets the same element as `.section-padding` and, with equal-or-higher
specificity, simply OVERRIDES it — no stacking, no reset rule needed. This is
cleaner but is more invasive: it requires each block to accept/merge an
injected className+id onto its root, whereas the parent-wrapper approach (R1)
keeps block files 100% untouched (preferred by the "change no block runtime"
constraint). R1 is recommended precisely because it needs zero block edits.

### R3 (later, opt-in migration): move outer padding to the wrapper per block

Longer term, individual blocks could drop `section-padding` from their root and
let the wrapper own vertical padding — but ONLY once the wrapper supplies a
DEFAULT padding for unstyled sections (i.e. abandon strict diff-only for the
padding key, or seed a theme default). Until that default exists, do NOT strip.
If pursued, migrate in this order of safety: the plain `section-padding` blocks
(CategoryShowcase, DealOfDay, ImageWithText, InstagramGrid, Newsletter,
RichText, Testimonials, BrandStrip), then the shared ProductTabs (needs a
CMS-only wrapper, not editing the shared component), and handle PromoBannerGrid
separately due to its asymmetric top-only 30px.

### R4: margin
No block sets outer margin, so `buildSectionCss` can apply user `margin` to the
wrapper directly with no neutralization. (Beware collapsing margins are avoided
because `.section` is `float:left`, which establishes a new block formatting
context on the child, not the wrapper — a user vertical margin on the wrapper
behaves normally.)

### R5: background / border overlap (not padding, but same wrapper)
Several blocks hardcode `bg-white` (and BrandStrip adds dashed top/bottom
borders). A user-set background or border on the wrapper will sit BEHIND/around
the block's own `bg-white`/borders and appear to have no effect. When P3 adds
background/border controls, apply them via the same `> .section` override
pattern (or document that these blocks paint their own background). Out of
scope for this padding audit but flagged so P3 does not treat "background does
nothing" as a bug.
