# Forever Finds CMS — UX Audit & Redesign Brief

_Multi-agent audit (5 dimensions, 53 findings), 2026-07-01._

## Executive summary

The CMS feels "confusing" because it ships two overlapping products at once: a suite of standalone admin form pages (Header, Topbar, Footer, Theme, Storefront Themes, SEO, and a Drawer-based page builder) and a separate live visual editor at /editor/[slug] — and both read/write the SAME underlying data with no indication of which is authoritative. A non-technical owner faces duplicate doors for every job (edit header, change colors, swap the logo, build a page), inconsistent naming and developer jargon ("chrome", "Topbar" vs "Top Bar", "blocks" vs "sections", CSS variables, Font Awesome classes), and two different visual design languages. The recommended direction is to make the live editor the single, polished surface for all visual content — page sections plus site-wide header/top bar/footer plus brand colors/fonts/logo — retire or reduce the duplicate admin form pages to a thin list-and-deep-link role, and keep only genuine record/data tools (Pages list, Blog, Media, Access, Audit, global SEO defaults). Before promoting the editor as primary, we must fix its trust-breaking gaps: silent data loss on navigation, no on-canvas edit affordances, URL-only images, and publish that falsely reports success when chrome saves fail. The result is one obvious place to design the store, plain language throughout, and a clear split between "design visually" and "manage records".

## Root causes

- Two parallel editing systems were built for the same data (admin form pages via EditorShell/Drawers AND the live editor's chrome + section panels) with no single source of truth and no cross-linking, so every task has at least two non-equivalent doors that write identical settings.
- No information architecture governs the CMS: each route self-registers its own top-level defineRouteConfig, producing a flat ~11-item sidebar, while the /cms landing hub lists a different, partial set of 6 cards — the two navigation models contradict each other and neither separates 'design the storefront' from 'manage content records'.
- Naming and labeling are ungoverned and leak engineering vocabulary: 'chrome', 'blocks' vs 'sections', 'Topbar' vs 'Top Bar', 'Storefront Themes' vs 'Theme' vs 'Theme styles' (two identical Swatch icons), CSS custom-property hints, Font Awesome class names, Open Graph/Twitter card, and '%s' templates — all surfaced to a non-technical owner.
- The live editor, though it edits real data and is the intended primary surface, is an unfinished internal-feeling tool: built from ad-hoc inline hex styles instead of the Medusa UI kit, with critical trust gaps (no unsaved-changes guard, no on-canvas affordances, URL-only images, error-swallowing publish).
- Feature parity and canonicalization were never enforced: the editor's chrome panels are a hidden subset of the richer admin forms (e.g. footer), the logo lives in three independent settings, and SEO is split between global defaults and per-page overrides with no explained relationship.

## Top issues (prioritized)

### 1. [CRITICAL] Every site-wide element (Header, Top bar, Footer, Theme) is editable in two places that write the same data, with no source of truth

**Why it matters:** This is the core of the owner's complaint. The same header/footer/topbar/theme settings are edited both in standalone admin pages and in the live editor's 'Site chrome' panel, with different UIs, different save behavior, and no cross-linking. The owner cannot tell which is authoritative or whether an edit in one appears in the other, inviting conflicting edits and eroding all trust.

**Fix:** Make the live editor the ONLY place to edit header, top bar, footer, and brand theme styles. Delete the standalone /cms/header, /cms/topbar, /cms/footer, /cms/theme routes (or reduce each to a one-line 'Edit in visual editor' deep-link that opens the editor with that element pre-selected).

### 2. [CRITICAL] Two completely different page builders edit the same page sections

**Why it matters:** The same page (Hero, Promo Grid, etc.) can be built in the admin Drawer/form builder at /cms/pages/[id] (arrow reordering because @dnd-kit isn't installed, per-section modal drawers, per-locale publish) OR in the drag-and-drop live canvas at /editor/[slug]. The Pages list only links to the inferior admin builder, and newly created pages open there, not in the polished editor. Two unrelated UXs for one task with different capabilities and publish rules.

**Fix:** Retire the /cms/pages/[id] Drawer builder. Reduce /cms/pages to a lightweight list (create/rename/slug/status/delete) where every row and every 'New page' action deep-links into the live editor at that slug. Move publish/schedule/revision controls into the editor. One builder for sections.

### 3. [CRITICAL] Switching pages or closing the tab silently discards all unpublished edits and the undo stack

**Why it matters:** The page switcher and 'New page' flow navigate via a hard window.location.href with no dirty check and no beforeunload guard anywhere in the editor. An owner who edits Home then picks 'About' from the dropdown (or closes the tab) loses everything with zero warning. dirty state is tracked but never used to protect navigation — the single most dangerous behavior for a non-technical user and a blocker to trusting the editor as primary.

**Fix:** Track a global dirty flag (content changed OR chromeDirty non-empty). Add a beforeunload handler plus an in-app confirm on page switch/new page ('You have unpublished changes — publish or discard?'). Ideally autosave a draft so nothing is ever lost.

### 4. [CRITICAL] The canvas gives no signal it is editable — no hover highlight, section label, or on-canvas controls

**Why it matters:** The only cue is one line of gray helper text; the canvas sets cursor:pointer globally but shows NO hover outline, NO section name, and NO floating toolbar — only the already-selected section gets a blue outline. To an owner the 'primary editing surface' looks like a passive storefront preview. Elementor/Shopify show hover borders, section names, and inline move/duplicate/delete handles. Without this the editor cannot become the primary surface.

**Fix:** Add a hover state in the canvas: light outline plus a small floating label/toolbar (section name, move up/down, duplicate, delete, Edit) pinned to the hovered section. Turn the canvas into the true editing surface, not a preview.

### 5. [CRITICAL] The admin and the live editor are two different design languages, so the editor reads as an unfinished internal tool

**Why it matters:** Admin CMS pages use the polished Medusa UI kit (Container, Heading, Button, IconButton, tokens, toast) while the editor is built entirely from ad-hoc inline React.CSSProperties with hardcoded hex (#2563eb, #6b7280, etc.) and glyph buttons. Moving between them feels like two products — exactly the 'developer-made, confusing' impression the owner reported. The surface we want to promote looks the least finished.

**Fix:** Adopt one design language for both. Render the editor panel with Medusa UI components (or a shared token set / Tailwind config), replace all hardcoded hex with tokens, and reuse Medusa IconButton so styling and a11y come for free.

### 6. [CRITICAL] Changing the logo means reconciling three separate settings across two surfaces — and the editor can't even upload

**Why it matters:** The logo is stored in THREE independent settings (Header logo, Theme logo, Footer bottom logo), each editable in BOTH the admin forms AND the editor's Site chrome — six possible controls with no guidance. Admin forms have a proper Media Library ImagePicker, but the editor's image control is a bare URL text box with no upload/picker, so inside the 'primary' tool the owner must leave, copy a URL, and paste it. The most common real edit is a maze.

**Fix:** Collapse the three logo settings into one canonical brand logo value that every surface reads. Give the editor's image field the same Media Library + upload widget as the admin ImagePicker so the owner never leaves the canvas.

### 7. [HIGH] 'Storefront Themes' vs 'Theme' vs 'Theme styles' — three names, two identical Swatch icons, for different jobs

**Why it matters:** The landing shows two adjacent cards using the SAME Swatch icon: 'Storefront Themes' (swap a whole prebuilt design) and 'Theme' (brand colors/fonts/logo). The editor adds a third, 'Theme styles'. An owner wanting to 'change the theme color' cannot predict which to open, and template-switching exists only in admin, forcing them off the primary surface.

**Fix:** Rename to distinct, plain concepts with distinct icons: 'Design / Template' (the prebuilt-look gallery) vs 'Brand colors & fonts'. Fold color/font/logo tokens into the editor's theme panel as the single styling surface, and surface template-switching inside the editor too. Never ship two Swatch-icon items called Themes and Theme.

### 8. [HIGH] Publish reports success even when header/footer/theme saves fail (swallowed errors)

**Why it matters:** On publish, each dirty chrome save is fired with .catch(()=>{}) so failures are silently swallowed; only the page-sections POST is error-checked, and the green 'Published — live on your storefront' message is set unconditionally. An owner who edits the header and sees 'Published' may have a header change that never saved. False confirmation is worse than an error.

**Fix:** Await and check each chrome save; if any fails, surface it and do not report full success. Prefer a single transactional publish endpoint that saves sections + chrome together and returns one status. Standardize on toast feedback everywhere.

### 9. [HIGH] Image fields are raw URL text inputs — no upload or media picker — despite a Media Library existing

**Why it matters:** The editor's image control (hero slides, banners, logo) is a plain text box requiring a pasted URL. There is no upload and no picker into the store's Media Library, even though the CMS ships a Media admin page. A non-technical owner has no way to get a URL for their own photo, blocking the most common edit ('change this banner picture') and creating yet another fragmentation.

**Fix:** Replace every editor URL box with a media picker/upload widget that opens the existing Media Library and returns the URL, with drag-drop upload. Fold the Media admin page into this picker.

### 10. [HIGH] The editor's chrome panels are a hidden subset of the richer admin forms

**Why it matters:** Topbar/Header/Footer exist in both the admin form and the editor's Site chrome, but they are NOT equivalent. The editor Footer exposes only contact/links/social/newsletter/copyright, while the admin Footer also has app buttons, categories column, extra links, payment-methods image, and bottom logo. An owner editing 'Footer' in the editor literally cannot reach half the settings and gets no signal a richer version exists — 'two doors, unequal rooms'.

**Fix:** Bring the editor's chrome panels to full parity with the admin forms before deleting the admin routes. Expose any advanced settings via an 'Advanced' expander inside the same editor panel — never a separate route.

### 11. [HIGH] Undo/redo covers only page sections and there is no Cmd+Z

**Why it matters:** snapshot/undo/redo operate only on content; header/footer/topbar/theme edits go through updateChrome() which never snapshots, so a mistaken brand-color change is unrecoverable except by manual re-editing. There is no keyboard handler either, so Cmd/Ctrl+Z does nothing and the only undo is a tiny glyph. Standard tools support keyboard undo across all edits.

**Fix:** Unify history to cover both content and chrome/theme, and add a global Cmd/Ctrl+Z + Shift+Cmd+Z handler. Keep the visible buttons as secondary.

### 12. [HIGH] Landing hub is incomplete and the 'Visual Editor' is hardcoded to Home only

**Why it matters:** The /cms hub advertises 6 cards plus a 'Visual Editor (Home)' button, but the CMS has 11 sidebar routes (Pages, Blog, Media, Access, Audit are omitted). The featured editor button is hardcoded to slug=home, so the surface the owner cares about most is only offered for one page — editing About/FAQ requires first discovering the separate Pages list. The hub teaches an incomplete, partly wrong map.

**Fix:** Make the visual editor the primary, first action on the landing and open it via a page picker (or the current page), not just Home. Make the hub a complete, honest index of the surfaces that remain after consolidation, and ensure hub and sidebar can never disagree.

### 13. [HIGH] Flat, ungrouped ~11-item sidebar full of jargon labels

**Why it matters:** Every route self-registers a top-level entry, yielding a flat list of peers (Storefront Themes, Theme, Header, Topbar, Footer, Pages, SEO, Media Library, Blog, CMS Access, Audit Log) with no hierarchy and no signal that Header/Topbar/Footer/Theme are just parts of one visual editor. Several use terms an owner won't map to intent.

**Fix:** Group into ~3 buckets: 'Design your store' (single entry → Visual Editor, which internally owns chrome + sections + theme styles + template switch), 'Content' (Pages, Blog, Media), and 'Settings' (SEO defaults, Access, Audit). Remove Header/Topbar/Footer/Theme as separate nav items.

### 14. [HIGH] Add-section only appends to the end; reordering is one-click-per-step with tiny arrows and no drag-and-drop

**Why it matters:** addSection always pushes to the bottom, so inserting a section between two others means many clicks on a cramped 26x24px up-arrow. There is no drag handle in the panel or on the canvas, and delete is a bare ✕. Composing a page is tedious and unintuitive for a non-technical owner — well below the drag-and-drop bar users expect.

**Fix:** Add insertion points (a '+' between sections on the canvas and insert-above/below on a selected section), let addSection accept a target index, and add drag-to-reorder in the section list and on the canvas with larger, labeled controls.

### 15. [MEDIUM] Developer jargon is exposed throughout: 'chrome', 'blocks' vs 'sections', 'Topbar' vs 'Top Bar', CSS variables, Font Awesome classes, Open Graph

**Why it matters:** The owner is forced to learn engineering vocabulary and reconcile inconsistent spellings of the same thing. 'SITE CHROME' groups the header/footer; the Theme form hints '--ff-primary' and 'hardcoded fallbacks'; icon fields demand raw Font Awesome class names ('fa-instagram') with no picker; SEO exposes 'Open Graph', 'Twitter card', and '%s'. This directly matches the 'you shouldn't need to know topbar vs chrome vs sections' concern and, for icons, is a hard self-serve blocker.

**Fix:** Adopt plain, owner-facing language everywhere from one shared label map: 'Announcement bar', 'Header', 'Footer', 'Colors & fonts', 'Main brand color', 'Social share image'. Standardize one spelling ('Top bar'), never surface 'block'/'chrome', replace CSS-variable and %s hints with live examples, and replace Font Awesome text inputs with a searchable icon picker.

### 16. [MEDIUM] A load/network failure renders as 'This page has no sections yet', risking overwrite of real content

**Why it matters:** If the load request throws or returns non-OK, panel and canvas both fall back to an empty content array and the canvas shows the normal empty-state text. An owner cannot distinguish a failed fetch from a genuinely blank page; they may panic and rebuild, or hit Publish and overwrite the real page with an empty one.

**Fix:** Distinguish error from empty: show a real error state with Retry on fetch failure, only show 'no sections yet' when the API genuinely returns empty, and guard Publish against saving when the last load errored.

### 17. [MEDIUM] SEO is split between global defaults and per-page overrides with no explained relationship

**Why it matters:** SEO lives in a global /cms/seo page and again per-page inside the admin page editor, and the defaults-vs-override relationship is never explained. An owner fixing how a page appears in Google has to guess which to use.

**Fix:** Keep only global defaults on the SEO settings page and move per-page SEO into the editor's page-settings panel, clearly labeled 'overrides the default'.

### 18. [MEDIUM] New-page creation and link editing use raw window.prompt with no validation

**Why it matters:** Creating a page fires window.prompt('New page slug') — asking only for a technical 'slug', with no title, template, or collision check — and inserting a link uses window.prompt plus deprecated execCommand. Raw browser prompts feel broken next to an Elementor-style tool, and 'slug' is meaningless to an owner.

**Fix:** Replace with a proper 'Create page' modal (Page name auto-derives slug, optional template, duplicate check) and a modern rich-text link popover (URL + open-in-new-tab + remove).

### 19. [MEDIUM] Editor access is a shareable ?key= URL with a dead-end 'Unauthorized' screen and no exit

**Why it matters:** The editor opens only with an exact ?key=ff_preview_... URL that leaks via history/sharing; a missing/invalid key hits a bare red 'Unauthorized' with no link forward, and there is no 'Exit / Back to admin' control inside the editor, so users can feel trapped.

**Fix:** Make the denied state actionable (Return to admin / sign in), add an 'Exit editor' breadcrumb back to Site Management, and prefer a session/token flow over a shareable URL key (or at least strip the key from the visible URL).

### 20. [MEDIUM] Selecting a section from the list doesn't scroll it into view, and locale switches silently hide fields

**Why it matters:** Clicking a section in the panel outlines it in the iframe but never scrolls to it, so on a long page the owner appears to see nothing happen then edits blind. Separately, flipping EN/BN hides whole shared fields (logo, SEO social, branding images) with no explanation, so a Bengali editor thinks fields are missing.

**Fix:** scrollIntoView the corresponding element on selection. Keep shared/non-translatable fields visible in every locale, clearly marked 'shared across all languages / edited in English', instead of making them vanish.

### 21. [MEDIUM] Accessibility gaps and weak loading/empty states on the primary surface

**Why it matters:** Undo/redo, move, delete, and rich-text controls are glyph-only with title-but-no-aria-label; the RTE uses deprecated execCommand; native color/range inputs are unstyled; and loading is a bare 'Loading…' with no skeleton. Keyboard and screen-reader users cannot reliably operate the surface we want to make primary, and failures are invisible.

**Fix:** Add aria-labels and focus styles to every icon button (reuse Medusa IconButton), replace execCommand with a maintained rich-text approach, and add skeleton/error/empty states consistent with the admin.

### 22. [LOW] Keep Media, Blog, CMS Access, and Audit Log as data tools, but move them out of the visual-editor grouping

**Why it matters:** These four are genuine list/CRUD/records tools (asset browse+upload, blog CRUD, per-user RBAC, immutable change log) and do NOT belong on a visual canvas. The only problem is that they are lumped under 'Site Management' next to the chrome editors, blurring 'design visually' vs 'manage records'.

**Fix:** Keep all four. After merging chrome into the editor, regroup them under 'Content' (Media, Blog) and 'Settings' (Access, Audit) so the visual editor is visibly primary and these read clearly as record tools.

## Recommended direction

Consolidate ALL visual editing into the live editor (/editor/[slug]) as the single, polished primary surface, and demote everything else to either a thin list/deep-link or a genuine record tool.

MERGE INTO THE LIVE EDITOR (one surface, one source of truth):
- Page sections: the editor's drag-and-drop canvas becomes the only page builder.
- Site-wide elements: Header, Top bar, Footer — brought to FULL parity with today's admin forms (footer app buttons, category columns, payment image, etc. via an 'Advanced' expander in the same panel).
- Brand styling: colors, fonts, and a single canonical logo become a 'Brand / Colors & fonts' panel in the editor with swatch previews; the standalone /cms/theme is deleted.
- Template switching ('Storefront Themes') is surfaced inside the editor as 'Design / Template' so the owner never leaves to change looks.
- Per-page SEO moves into the editor's page-settings panel as an explicit 'overrides the default'.
- Media selection: every image field uses an inline Media Library picker + upload.

REMOVE (or reduce to a one-line deep-link into the editor): /cms/header, /cms/topbar, /cms/footer, /cms/theme, and the /cms/pages/[id] Drawer builder.

KEEP as supporting admin surfaces (record/data tools, clearly separated from 'design'): /cms/pages as a lightweight list (title/slug/status/create/delete) that deep-links into the editor; Blog; Media Library (also embedded as the editor's picker); CMS Access; Audit Log; and a global-defaults-only SEO page.

NAVIGATION: replace the flat ~11-item sidebar and the contradictory 6-card hub with three groups — 'Design your store' (single entry → Visual Editor with a page picker, which internally owns sections + header/top bar/footer + colors/fonts + template + per-page SEO), 'Content' (Pages, Blog, Media), and 'Settings' (SEO defaults, Access, Audit). The landing's primary action is 'Open visual editor' pointed at a page picker, not Home.

LANGUAGE: one shared label map used by admin and editor. Drop 'chrome', 'block', and framework terms. Use 'Announcement/Top bar', 'Header', 'Footer', 'Page sections', 'Colors & fonts', 'Main brand color', 'Social share image'. Standardize spelling ('Top bar'), replace Font Awesome text with an icon picker, and CSS-variable/%s hints with live examples.

IDEAL FLOWS: (1) Edit anything visual — open the editor, see hover outlines and inline handles on every section and on the header/footer, click, edit in a Medusa-styled panel, watch it live. (2) Change the logo/brand color — one 'Brand' panel, one value, inline upload, live preview. (3) Create a page — a 'Create page' modal (name auto-derives slug) that lands directly in the editor. (4) Publish — one transactional button that saves sections + chrome together, confirms via toast, and never reports false success. Throughout, unsaved changes are protected by a dirty-flag guard (beforeunload + in-app confirm + draft autosave), undo/redo covers all edits with Cmd+Z, and the design language matches the admin.

## Phased plan

### Phase 0 — Stop the bleeding: trust and safety fixes in the live editor

**Goal:** Make the existing editor safe and honest enough to be promoted, without any IA changes yet.

Add a dirty-flag guard: beforeunload handler + in-app confirm on page switch and 'New page', ideally draft autosave, so edits are never silently lost. Fix publish to await and check each chrome save and use one transactional status (no more .catch(()=>{}) with unconditional 'Published'). Distinguish load-error from empty state (Retry button; guard Publish against overwriting after a failed load). Add an 'Exit editor / Back to admin' control and make the 'Unauthorized' screen actionable.

### Phase 1 — Make the canvas feel like an editor and unify history

**Goal:** Turn the passive-looking preview into an obviously editable, forgiving surface.

Add canvas hover state: outline + section name + floating toolbar (move up/down, duplicate, delete, Edit) and scrollIntoView on selection. Add insertion points ('+' between sections; insert above/below) and drag-to-reorder in panel and canvas. Unify undo/redo to cover content AND chrome/theme, with global Cmd/Ctrl+Z and Shift+Cmd+Z. Add aria-labels, focus styles, and skeleton loading states.

### Phase 2 — Media and language cleanup

**Goal:** Remove the two most common self-serve blockers and the jargon.

Replace every editor image URL box with an inline Media Library picker + drag-drop upload. Introduce one shared owner-facing label map used by admin and editor: drop 'chrome'/'block', standardize 'Top bar', relabel Theme fields to plain language (remove CSS-variable/fallback hints), replace Font Awesome text inputs with a searchable icon picker, and relabel SEO ('Social share image', 'Share preview size', live-example title template). Collapse the three logo settings into one canonical brand logo value.

### Phase 3 — Bring chrome to parity and adopt one design language

**Goal:** Make the editor a complete superset of the admin forms and visually consistent with the admin.

Bring the editor's Header/Top bar/Footer panels to full parity with the admin forms (advanced footer settings, etc. behind an 'Advanced' expander). Add a 'Brand / Colors & fonts' panel and surface template ('Design') switching inside the editor. Re-skin the editor panel with Medusa UI components / shared tokens, replacing all hardcoded hex and glyph buttons so admin and editor look like one product.

### Phase 4 — Consolidate IA: retire duplicates, regroup navigation

**Goal:** Deliver 'one thing, one place' now that the editor is a complete, trustworthy superset.

Delete or reduce to deep-links: /cms/header, /cms/topbar, /cms/footer, /cms/theme, and the /cms/pages/[id] Drawer builder. Reduce /cms/pages to a list that deep-links into the editor; add a proper 'Create page' modal. Move per-page SEO into the editor and keep only global defaults on the SEO page. Regroup the sidebar into 'Design your store' (Visual Editor with page picker), 'Content' (Pages, Blog, Media), 'Settings' (SEO defaults, Access, Audit). Rebuild the landing hub around a single 'Open visual editor' action and an honest, complete index.

### Phase 5 — Polish and responsive (later)

**Goal:** Round off remaining rough edges and inconsistencies.

Replace deprecated execCommand rich-text with a modern component (inline link popover). Make the panel collapsible/resizable, keep shared fields visible-but-marked across locales instead of hiding them, and evaluate per-breakpoint overrides for key fields if responsive design becomes a goal.
