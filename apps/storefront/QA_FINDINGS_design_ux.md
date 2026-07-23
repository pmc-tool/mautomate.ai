# Design / UX / UI Audit — mAutomate commerce SaaS

Read-only code audit of the merchant dashboard + storefront (`apps/storefront`),
the super-admin console (`apps/console`), the partner portal, and the Flutter
apps (`apps/merchant-app`, `apps/shopper-app`). Severity: **P1** = broken flow /
serious inconsistency, **P2** = polish / consistency, **P3** = nice-to-have.

Design source of truth: `apps/storefront/src/modules/cms/editor/design.ts`
(ink `#0F1319`, ember accent `#F26522`, grey ramp, Inter) and the Tailwind
`brand` scale in `apps/storefront/tailwind.config.js` (`brand-500 = #F26522`).
Philosophy: **"ink is for action, ember is for state."**

---

## P1 — Broken / serious inconsistencies (fix first)

### P1-1. Merchant sidebar: active nav icon is WHITE on a light ember tint → invisible
**Surface:** merchant dashboard · `src/components/merchant-admin/sidebar.tsx`
The active group button and active leaf link render `bg-brand-50` (light ember
tint `#FEF1EA`) with the label `text-grey-90` — but the icon stays `text-white`:

- group button: active branch `... bg-brand-50 text-grey-90 ...` with icon
  `active ? "text-white" : ...` (around L360–L378)
- leaf link: same `bg-brand-50 text-grey-90` with icon `active ? "text-white"`
  (around L405–L420)

White icon on `#FEF1EA` is effectively invisible — this is the "sidebar color
mismatch" the user reported. It reads as a half-finished migration: the active
state was changed from a solid dark fill (`bg-grey-90 text-white`, still the
pattern used correctly in the console sidebar, `apps/console/src/components/sidebar.tsx:162`)
to a light ember tint, but the icon's `text-white` was left behind.
**Fix:** active icon should use the ember token `text-brand-600` (or `text-brand-500`)
to match the left rail (`before:bg-brand-500`) and the tint, or `text-grey-90`
to match the label. Correct token: **`text-brand-600`**.

### P1-2. `KpiCard tone="brand"` renders CYAN, not ember
**Surface:** merchant dashboard + partner portal · `src/components/merchant-admin/kpi-card.tsx`
The tone map hardcodes:
```
brand: "bg-cyan-50 text-cyan-700",   // should be ember
green: "bg-emerald-50 text-emerald-700",
```
`tone="brand"` is meant to be the ember accent but paints cyan/teal — a color
that appears nowhere in the design system's web palette. It is used e.g. on the
partner "Open balance" KPI (`src/app/partners/page.tsx`, `tone="brand"`), so the
partner portal shows a teal stat tile that matches nothing else.
**Fix:** `brand: "bg-brand-50 text-brand-700"`. (The Flutter app keeps ember and
cyan correctly separate — cyan is a tertiary/info color there, not "brand".)

### P1-3. Jarvis launcher and "Resume setup" pill overlap in the bottom-right corner
**Surface:** merchant dashboard · `src/components/merchant-admin/jarvis-stage/jarvis-launcher.tsx:156`
vs `src/components/merchant-admin/setup-resume.tsx:59`
Both are `position: fixed`, both dock bottom-right, both at **z-40**:
- JarvisLauncher: `fixed z-40 ... style={{ bottom: "1.5rem", right: "1.5rem" }}`
- setup-resume: `fixed bottom-5 right-5 z-40 ...` (1.25rem / 1.25rem)

During onboarding (exactly when the "Resume setup" pill is shown) the two pills
sit on top of each other in the same corner at the same stacking level — the
Jarvis-surface overlap class the user flagged. **Fix:** give the two a shared
stacking contract — e.g. offset setup-resume upward (`bottom-20`) when the
launcher is mounted, or dock one bottom-left. Introduce a z-index/anchor scale
so floating chrome can't collide (see P3-1).

### P1-4. Merchant sign-in has no password recovery — dead end when locked out
**Surface:** merchant dashboard · `src/components/merchant-admin/auth-gate.tsx` (LoginView)
The login card is email + password + "Sign in" only. There is **no "Forgot
password"** link and no account-recovery affordance anywhere on the screen. A
merchant who forgets their password has no self-serve path back in. (Sign-up is
also absent, which may be intentional if onboarding is invite-only, but recovery
is not optional for a paid SaaS.) **Fix:** add a "Forgot password?" link to the
recovery flow; if recovery isn't built yet, that is itself a P1 gap.

---

## P2 — Consistency & polish

### P2-1. The super-admin console never adopted the ember accent — it reads as a different product
**Surface:** `apps/console`
The console's `tailwind.config.js` defines only `grey` (no `brand` scale at all).
Its state colors are ink: active nav is `bg-grey-90 text-white`
(`src/components/sidebar.tsx:162`), focus rings are `ring-grey-90`
(`:160`, `:184`). There is no `.ff-studio` ember wrapper (unlike the dashboard
and partner layouts). So "state" (active nav, focus, selection) is **ember** in
the merchant dashboard and partner portal but **ink** in the console — the "one
design language" from `design.ts` is not applied to the surface the user (as
super-admin) lives in. The user explicitly wants the super-admin surface to feel
like the same, friendly product. **Fix:** add the `brand` scale to the console
Tailwind config and the shared `.ff-studio` focus/selection CSS; use ember for
active nav state (or make a deliberate, documented decision that the console is
intentionally ink-only).

### P2-2. Merchant login is LESS polished and less accessible than the internal console login
**Surface:** `src/components/merchant-admin/auth-gate.tsx` vs `apps/console/src/components/auth-gate.tsx`
The customer-facing merchant login is weaker than the internal super-admin one:
| | Merchant login | Console login |
|---|---|---|
| Label ↔ input association (`htmlFor`/`id`) | **missing** (a11y bug — label click / SR association broken) | present |
| `autoComplete` on email/password | missing | present (`email`, `current-password`) |
| Placeholder | none | `admin@mautomate.ai` |
| Error presentation | bare `text-red-600` text | styled box `bg-red-50 rounded px-3 py-2` |
| Submit loading state | text only ("Signing in...") | `Spinner` icon + text |
| Logo / brand mark | none | logo badge |
| Focus ring | `focus:ring-grey-90` (full-strength grey) | `focus:ring-grey-90/20` (subtle) |

**Fix:** bring the merchant login up to the console's pattern — add `id`/`htmlFor`,
`autoComplete`, placeholders, a boxed error, a spinner, the mAutomate logo, and
the subtle focus ring. This is the first screen most users ever see.

### P2-3. Stale "B2D" brand mark on the console login
**Surface:** `apps/console/src/components/auth-gate.tsx` (~L19)
The login badge renders `B2D` (Brand2Door) while the title says "Control Plane"
and the placeholder is `admin@mautomate.ai`. The product was rebranded to
mAutomate; the badge is stale. **Fix:** replace with the mAutomate mark.

### P2-4. No shared Button component — 85+ hand-rolled primaries, guaranteed drift
**Surface:** merchant dashboard (broad)
There is no `Button` component under `src/components/merchant-admin/` and no use
of `@medusajs/ui` Button. Primary buttons are copy-pasted inline
(`bg-grey-90 text-white ...`) across 85+ files. The design system DOES define a
`button()` primitive — but only in `design.ts` as CSS-in-JS for the visual
editor, so the dashboard can't consume it. Result: padding drift
(`py-2` dominant but `py-1.5`, `py-2.5`, `py-3` all present; `px-3/4/5`) and no
single place to change the button look. **Fix:** extract a shared `Button`
(tones: primary=ink, accent=ember, secondary, ghost, danger) mirroring
`design.ts button()`, and migrate the inline buttons to it.

### P2-5. Radius token drift — custom scale mixed with default Tailwind radii
**Surface:** merchant dashboard (broad)
The design system defines `rounded-base` (4), `rounded-rounded` (8),
`rounded-large` (16), `rounded-soft` (2), `rounded-circle`. But the dashboard
also uses **126** occurrences of default Tailwind `rounded-md` (55, =6px),
`rounded-lg` (59, =8px), `rounded-xl` (12, =12px) — none of which are design
tokens (`rounded-lg` duplicates `rounded-rounded`; `rounded-md`/`xl` have no
token equivalent). Two radius vocabularies are in play. **Fix:** normalize to the
custom scale; lint against `rounded-(sm|md|lg|xl|2xl|3xl)`.

### P2-6. Success color is applied ad-hoc (emerald vs green) and doesn't match the token
**Surface:** merchant dashboard (broad)
Positive/success states use `emerald-*` (254 occurrences) and `green-*` (22) —
two different Tailwind greens for the same meaning — and **neither** matches the
design token `semantic.successFg = #067647` (defined in `design.ts` and honored
by the Flutter app as `successSolid 0xFF067647`). The web surfaces reach for raw
Tailwind semantics instead of the tokens. **Fix:** pick one success color mapped
to `#067647` (e.g. add `success` to the Tailwind theme) and replace `green-*` and
raw `emerald-*` usages; likewise standardize danger/warning/info on the
`semantic` hexes.

### P2-7. The ember brand accent is nearly absent from the web product
**Surface:** merchant dashboard (broad)
`brand-*` (ember) appears only ~6 times in the entire merchant dashboard (the
sidebar active state + one KPI). The flagship onboarding (`setup/page.tsx`) uses
ink (`bg-grey-90`) for the active step and emerald for completion — **no ember at
all**. Focus rings elsewhere use `ring-grey-90` (39×). So the "one warm signal"
identity from `design.ts` effectively doesn't exist on web; the product reads as
monochrome ink+grey. (The Flutter app, by contrast, implements the ember-as-state
system faithfully — see "Polished vs rough".) **Fix:** deliberately spend ember
on state — active steps, selected rows, primary-progress, the one publish action
— per the design brief, or consciously downgrade the brief. Today it's neither.

### P2-8. Competing focus-ring styles
**Surface:** merchant dashboard
`src/app/dashboard/layout.tsx` `.ff-studio` sets the canonical ember
`:focus-visible` ring (box-shadow `rgba(242,101,34,.28)`). But:
- `sidebar.tsx` also hardcodes `focus-visible:ring-2 focus-visible:ring-brand-500
  focus-visible:ring-offset-2` (redundant, adds an offset the global ring doesn't).
- `auth-gate.tsx` hardcodes `focus:ring-2 focus:ring-grey-90` (`:focus`, not
  `:focus-visible`) → a **grey** ring shows on mouse focus while keyboard focus
  gets ember; the two disagree.
**Fix:** rely on the `.ff-studio` ring; remove the per-component ring overrides.

### P2-9. Dashboard error boundary is developer-facing, not merchant-friendly
**Surface:** `src/app/dashboard/error.tsx`
On any client error the merchant is shown "Client-side error", a raw
`error.stack` dump in `<pre>`, and told to "copy the error below and share it
with support". Only action is "Try again" (no "Back to overview", no support
link/mailto). For a non-technical merchant this is alarming and unhelpful.
**Fix:** friendly copy, hide the stack behind a "technical details" disclosure,
add a "Back to dashboard" link and a real support channel.

### P2-10. Dark mode is configured but unimplemented
**Surface:** merchant dashboard
`tailwind.config.js` sets `darkMode: "class"` and `design.ts` defines a full
`ink` dark-chrome ramp, but there are **0** `dark:` variants in the dashboard /
merchant-admin components. The capability is half-built (the Flutter apps ship a
complete dark scheme; the web doesn't). **Fix:** either implement dark mode using
the ink tokens or remove the dead configuration to avoid implying support.

---

## P3 — Nice-to-have

### P3-1. No z-index scale — magic numbers across floating chrome
Values in `merchant-admin`: `z-10, z-20, z-30, z-40, z-50, z-[70], z-[80], z-[9999]`.
A modal is `z-50` but the Jarvis stage is `z-[9999]`, so a modal opened over the
stage would hide behind it; the launcher (`z-40`) sits under both the mobile
sidebar toggle (`z-50`) and modals. **Fix:** define named layers
(base/nav/overlay/modal/toast/jarvis) and use them everywhere.

### P3-2. Inconsistent full-screen background greys
`auth-gate.tsx` LoadingShell uses `bg-grey-5`, LoginView/MfaView use `bg-grey-10`,
`error.tsx` uses `bg-grey-10`, `page-shell.tsx` uses `bg-grey-5`. A reload flashes
grey-5 → grey-10. **Fix:** pick one app-shell background (grey-5) for all
full-screen states.

### P3-3. Console reaches for one-off semantic colors
`apps/console` uses `slate`, `sky`, `blue` alongside `emerald`/`amber` for status
(`text-blue-600`, `text-sky-800`, `text-slate-700`, `bg-sky-50`, …). No single
semantic palette. **Fix:** standardize on the `semantic` tokens.

---

## Summary

**Top issues (in order):**
1. **Merchant sidebar active icon is white on a light ember tint → invisible**
   (`sidebar.tsx`; fix icon to `text-brand-600`). This is the reported sidebar
   color mismatch.
2. **`KpiCard tone="brand"` paints cyan, not ember** (`kpi-card.tsx`; fix to
   `bg-brand-50 text-brand-700`).
3. **Jarvis launcher overlaps the "Resume setup" pill** — both `fixed`
   bottom-right at `z-40` during onboarding.
4. **Merchant login has no password recovery** and is less polished/accessible
   than the internal console login (missing `htmlFor`/`autoComplete`, bare error,
   no spinner, no logo).
5. **The console has no ember accent and the web dashboard barely uses it** — the
   "ink for action, ember for state" identity is only truly realized in the
   Flutter apps; the web surfaces read monochrome and the super-admin console
   reads as a colder, separate product.
6. **No shared Button component** (85+ hand-rolled) + **radius token drift**
   (`rounded-md/lg/xl` mixed with the custom scale) + **success color drift**
   (emerald vs green, neither = `#067647`).

**Polished vs rough:**
- **Polished:** the Flutter `merchant-app` / `shopper-app` (the *best* token
  system in the codebase — exact ember `0xFFF26522`, ink, full light+dark
  `AppColors` ThemeExtension, correct semantic hexes); the setup wizard
  (resumable, server-verified real progress, nothing is a dead end); the partner
  portal (reuses the shared merchant-admin components + the `.ff-studio` ember
  surface); the console *login* screen.
- **Rough:** the merchant *login* (a11y + branding gaps, no recovery); the
  merchant *sidebar* active state (the icon bug); the dashboard *error boundary*
  (raw stack trace); cross-surface color drift (KpiCard cyan; console ink-only;
  ember nearly absent on web).

**Highest-impact friendliness wins:**
- Fix the two color mismatches (sidebar icon, KpiCard cyan) — cheap, visible.
- Rebuild the merchant login to match the console's (logo, associated labels,
  autocomplete, boxed error, spinner) and add "Forgot password".
- Bring the console into the ember design language so the super-admin's own
  surface feels like the same product they sell.
- Extract a shared `Button` and a `success` semantic color to stop the drift at
  the source, and humanize the error boundary.
