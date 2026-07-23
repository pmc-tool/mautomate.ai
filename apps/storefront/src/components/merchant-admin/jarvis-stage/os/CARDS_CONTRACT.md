# Jarvis OS — Card Contract (Wave 2 guide)

This is the authoritative contract for adding **bespoke card bodies** to the
Jarvis Core OS. The engine (store, layout, dock, signal lines, SSE, registry,
generic renderers) is built and stable. Wave 2 only writes **body components**
and **registers** them. You never touch the shell, the store, the layout, or the
SSE loop.

All paths are relative to
`apps/storefront/src/components/merchant-admin/jarvis-stage/os/`.

---

## 1. What you build

For a tool `foo_bar` in group `orders`, create:

```
os/cards/orders/foo-bar.tsx
```

exporting a body component and registering it:

```tsx
"use client"
import type { CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"

export function FooBarBody({ data, status, send, navigate }: CardBodyProps<FooBarData>) {
  // render `data` however you like — you are INSIDE CardShell's body slot.
  return <div style={{ color: os.textDim }}>…</div>
}

registerCardBody("foo_bar", FooBarBody as CardBody)
```

Then import the file once so the `registerCardBody` side-effect runs — add it to
`os/cards/register.ts` (a barrel that the OS imports). Registration is
idempotent and overrides the pre-registered title/icon entry's `Body` only.

> Do NOT render your own header, status badge, minimize/close, or card frame —
> `CardShell` already draws all of that around your body. You render the body
> content only.

---

## 2. `CardBodyProps` — exactly what your body receives

```ts
export type CardBodyProps<D = unknown> = {
  data: D                       // the tool_result payload (see spec §2 shapes)
  status: CardStatus            // DATA lifecycle — NOT the orb state
  toolName: string              // e.g. "list_recent_orders"
  callId: string                // the SSE tool-call id
  args?: Record<string, unknown>// the model-authored tool arguments
  send: (prompt: string) => void// re-enter the chat loop with a new prompt
  navigate: (href: string) => void // route within the dashboard (closes the OS)
}
```

- `data` is already the exact JSON your read tool returned (money in whole
  currency units, per JARVIS_OS_SPEC.md §2). Type it with a `D` generic.
- `status` is `"loading" | "ready" | "error" | …` — but the host renders a spinner
  for `loading` and only mounts your body once data is present, so you can assume
  `data` is populated. Handle `data == null` defensively anyway.
- Use `send(...)` for interactive CTAs (e.g. a `needs_attention` item's
  `cta.prompt`); use `navigate(cta.href)` for links into the dashboard.
- Write tools do **not** use a body — they render through `ConfirmCard`
  automatically. Only build bodies for **read** tools.

---

## 3. The registry API (`card-registry.tsx`)

```ts
type RegistryEntry = {
  title: string          // human card title (already set for every tool)
  icon: IconName         // from os/icons.tsx (already set)
  group: CardGroup       // capability group (already set)
  Body?: CardBody        // <-- YOU add this
  accent?: string        // optional signal-line / header accent override
}

registerCard(tool, entry)         // full entry (rarely needed — pre-done)
registerCardBody(tool, Body)      // attach ONLY a body (the Wave 2 call)
getCardEntry(tool): RegistryEntry // never throws; unknown -> KeyValueBody default
```

Every tool from the spec appendices is **already** registered with a title,
icon, and group (see the `SPECS` table). You are almost always calling
`registerCardBody(tool, Body)` and nothing else.

To add a new icon, extend `IconName` + the `P` glyph map in `os/icons.tsx`.

---

## 4. Card state machine (read it, don't fight it)

Placement (`minimized`, `dismissed`) is tracked SEPARATELY from the data
lifecycle `status`, so a card keeps its data when docked.

```
tool_call ─▶ loading ─┬─ tool_result(ok)  ─▶ ready      (your body renders)
                      └─ tool_result(err) ─▶ error
confirm   ─▶ proposed ─▶ applying ─▶ done | error | expired   (ConfirmCard)
```

- The store lives in `card-store.ts` (`cardReducer`, keyed by tool-call `id`).
- Focus is single-primary: expanding a card auto-minimizes the previous primary.
- Capacity: the `CardHost` measures the viewport and auto-minimizes overflow into
  the `Dock`. Your body should size to content and let long lists scroll — the
  shell already caps body height with `overflow:auto`.

---

## 5. Layout & the non-overlap guarantee

Cards are laid out by **CSS Grid flow**, never absolute coordinates:

```
grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr))
```

in two rails flanking the orb (single scroll column on `< 900px`). Overlap is
impossible by construction; card width adapts to the rail. **Do not** position
your body absolutely or set fixed pixel widths — use relative units and
`max-width: 100%`. Wide content (tables) must scroll inside its own
`overflow-x: auto` container (see `KeyValueBody`'s `Table`).

Signal lines (`signal-lines.tsx`) read your card's DOM rect via the
`data-jarvis-card` attribute on `CardShell` — you get conduits for free.

---

## 6. Design tokens & motion (`os/tokens.ts` + `@modules/cms/editor/design`)

The OS is a **LIGHT premium** surface — a warm near-white field, frosted white
glass cards, ink text/chrome, one ember signal. `os` is the active palette and
**defaults to LIGHT** (`lightTheme`); a `darkTheme` of the same shape exists for a
future toggle. Every component reads `os`, so your body themes automatically —
just import from `os/tokens.ts` and never hardcode a hex.

```ts
import { os, type as t, radius, motion, accent, glassSurface, statusTone } from "../../tokens"
```

- Surface: frosted white glass (`os.glass` / `glassSurface(focus)`), hairline
  borders (`os.hairline`), ember hairline on focus (`os.emberHairlineFocus`),
  soft warm shadows (`os.cardShadow` / `os.cardShadowFocus`). CardShell already
  applies this — your body sits inside it and inherits the look.
- Text: `os.text` (ink, dark), `os.textDim`, `os.muted`, `os.faint` — all tuned
  for contrast on the light field.
- Accent: `os.ember` — spend it ONLY on the touched/active thing. `os.emberSoft`
  for tints, `os.emberDeep` (#E24E12) for lines/marks that need contrast on light,
  `accent.active` for pressed/active text.
- Semantic: `os.successFg`, `os.danger`, and `statusTone("run|ok|warn|error|idle")`
  for badges — all light-readable.
- Cyan (`os.cyan`, a deep teal on light) is reserved for "listening / merchant
  input" — don't reuse it.
- Chips / icon buttons: `osChip(active?)`, `osIconButton(size?)` (renamed from the
  earlier dark helpers). Type ramp: `t.micro | label | body | bodyStrong | title | heading`.
- Motion: `motion.fast|base|slow` with the shared `ease`; honor
  `prefers-reduced-motion` (snap instead of animate).
- Numbers read big; arrays read as compact tables; keep it quiet and spacious.

Reference the generic `KeyValueBody` (`os/cards/key-value-body.tsx`) for house
style — stat rows, tables, chips — and the money/orders shapes in
JARVIS_OS_SPEC.md §2 for what `data` looks like per tool.

---

## 7. Checklist for a new bespoke body

1. `os/cards/<group>/<tool>.tsx`, `"use client"`.
2. `export function <Tool>Body(props: CardBodyProps<Shape>) { … }`.
3. `registerCardBody("<tool>", <Tool>Body as CardBody)`.
4. Add the import to `os/cards/register.ts`.
5. Tokens only; no hardcoded colors; `overflow-x:auto` around wide content.
6. No header/frame — CardShell owns it. No emoji.
7. Type-check clean: `npx tsc --noEmit` (your files).
