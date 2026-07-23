/* ------------------------------------------------------------------ */
/* Editor shell <-> canvas message protocol (CANVAS P1 — parity).       */
/*                                                                     */
/* One typed enumeration of EVERY `cms:*` postMessage the two editor    */
/* routes exchange today, plus the three helpers both sides send and    */
/* receive through. The WIRE FORMAT IS UNCHANGED — plain               */
/* `{ type: "cms:x", ...fields }` objects — so this file changes zero   */
/* behavior; it only makes every message typed and greppable.           */
/*                                                                     */
/* Imported by BOTH routes (same Next app, same build), so the two      */
/* sides of the protocol can never skew.                                */
/*                                                                     */
/* This is the seed of ARCH-CANVAS §3's command bus: the CmdMsg/DocMsg  */
/* envelope replaces this enumeration in a later phase. Until then,     */
/* nothing may post a `cms:*` message except through postToShell /      */
/* postToCanvas below.                                                  */
/* ------------------------------------------------------------------ */

/** A page section as the editor carries it (block + props + style bags). */
export type CmsSection = { block_type: string; [k: string]: unknown }

/* ---------------- Drag payload MIME types (shared DnD contract) ------- */
/* The palette/grip drag types the canvas drop handlers key on. Same     */
/* values as the shell palette's own constants (one wire, two ends).     */
export const BLOCK_MIME = "application/x-ff-block"
export const WIDGET_MIME = "application/x-ff-widget"

/* ================================================================== */
/* SHELL -> CANVAS (the canvas is a projection; these are its inputs)  */
/* ================================================================== */

/** Full content replace — initial load + structural changes. */
export type CmsDataMsg = { type: "cms:data"; content: CmsSection[] }
/** Targeted patch — a single edited section replaced by index. */
export type CmsPatchMsg = {
  type: "cms:patch"
  index: number
  section: CmsSection
}
/** Preview mode on/off (hides every editor affordance). */
export type CmsPreviewModeMsg = { type: "cms:previewMode"; on: boolean }
/** Section selection (null clears every selection). */
export type CmsSelectMsg = { type: "cms:select"; index: number | null }
/** Element-level selection inside a section (null-ish clears it). */
export type CmsSelectElementMsg = {
  type: "cms:selectElement"
  index: number | null
  elementKey: string | null
}
/** Widget-level selection inside a container section (null-ish clears). */
export type CmsSelectWidgetMsg = {
  type: "cms:selectWidget"
  index: number | null
  path: number[] | null
}
/** Chrome region selection (header/topbar/footer; null clears). */
export type CmsSelectChromeMsg = { type: "cms:selectChrome"; key: string | null }
/** Element-level selection inside a chrome region (null-ish clears). */
export type CmsSelectChromeElementMsg = {
  type: "cms:selectChromeElement"
  region: string | null
  elementKey: string | null
}
/** Live chrome edit — one region's data replaced. */
export type CmsChromeMsg = {
  type: "cms:chrome"
  key: string
  data: Record<string, unknown>
}
/** What the shared clipboard currently holds (enables Paste rows). */
export type CmsClipboardMsg = {
  type: "cms:clipboard"
  hasSection: boolean
  hasWidget: boolean
  hasStyle: boolean
}

export type ShellToCanvasMsg =
  | CmsDataMsg
  | CmsPatchMsg
  | CmsPreviewModeMsg
  | CmsSelectMsg
  | CmsSelectElementMsg
  | CmsSelectWidgetMsg
  | CmsSelectChromeMsg
  | CmsSelectChromeElementMsg
  | CmsChromeMsg
  | CmsClipboardMsg
  // Phase 2B (declared in the 2B appendix below): column selection mirror.
  | CmsSelectColumnMsg
  // Phase 5B (declared in the 5B appendix below): slider stage selection
  // mirror (layerId null = slide-level selection).
  | CmsSelectSliderLayerMsg
  | CmsDeviceMsg
  // Phase 7A (declared in the 7A appendix below): the shell has taken over
  // the stage chrome, so the canvas suppresses its own filmstrip/rail.
  | CmsStageChromeMsg
  | CmsStageLocksMsg
  | CmsStageExitMsg

/* ================================================================== */
/* CANVAS -> SHELL (the shell is the single document authority)        */
/* ================================================================== */

/** Canvas booted — the shell replies with cms:data + cms:clipboard. */
export type CmsReadyMsg = { type: "cms:ready" }
/** A section was clicked (selection intent, canvas already outlined). */
export type CmsClickedMsg = { type: "cms:clicked"; index: number }
/** A chrome region was clicked. */
export type CmsClickedChromeMsg = { type: "cms:clickedChrome"; key: string | null }
/** A [data-el] element inside a section was clicked. */
export type CmsClickedElementMsg = {
  type: "cms:clickedElement"
  index: number
  elementKey: string
}
/** A [data-w] widget inside a container section was clicked. */
export type CmsClickedWidgetMsg = {
  type: "cms:clickedWidget"
  index: number
  path: number[]
}
/** A [data-el] element inside a chrome region was clicked. */
export type CmsClickedChromeElementMsg = {
  type: "cms:clickedChromeElement"
  region: string
  elementKey: string
}
/** Floating section-toolbar action (up/down/duplicate/edit/addBelow/delete…). */
export type CmsActionMsg = { type: "cms:action"; action: string; index: number }
/** Right-click menu action, scoped to WHAT was under the cursor. */
export type CmsCtxActionMsg = {
  type: "cms:ctxAction"
  action: string
  scope: "section" | "widget" | "element" | "chrome" | "chromeElement"
  index: number
  path?: number[]
  elementKey?: string
  region?: string
  itemField?: string
  itemIndex?: number
}
/** Clipboard keystroke forwarded from the iframe (focus was inside it). */
export type CmsKeyMsg = {
  type: "cms:key"
  action: "copy" | "paste" | "duplicate" | "delete"
}
/** Undo/redo forwarded from the iframe. */
export type CmsUndoMsg = { type: "cms:undo" }
export type CmsRedoMsg = { type: "cms:redo" }
/** Arm an insertion index AND open the section palette (openAddAt path). */
export type CmsInsertMsg = { type: "cms:insert"; index: number }
/* 6C zoo deletion: the six Batch A/B sender-migrated message types
   (cms:insertAt / insertContainerAt / insertWidgetAsSection /
   insertWidgetAt / moveSection / moveWidget) and the never-sent
   cms:setContainerLayout are DELETED — Phase 2B moved every sender onto
   `cms:cmd` envelopes, and the shell's paired legacy handlers are gone
   with them (INTEGRATION-2B §4, executed by seat 6C). */
/** Arm a seam: whatever is added next lands at this index. */
export type CmsSetAddTargetMsg = { type: "cms:setAddTarget"; index: number }
/** Open the template library, optionally landing at a seam. */
export type CmsOpenTemplatesMsg = { type: "cms:openTemplates"; at?: number }
/** On-canvas font-size handle commit (element style bag write). */
export type CmsFontSizeMsg = {
  type: "cms:fontSize"
  index: number
  elementKey: string
  px: number
}
/** A real link clicked in the canvas — open that page or select its container. */
export type CmsLinkClickMsg = {
  type: "cms:linkClick"
  href: string
  index: number | null
  chromeKey: string | null
}

export type CanvasToShellMsg =
  | CmsReadyMsg
  | CmsClickedMsg
  | CmsClickedChromeMsg
  | CmsClickedElementMsg
  | CmsClickedWidgetMsg
  | CmsClickedChromeElementMsg
  | CmsActionMsg
  | CmsCtxActionMsg
  | CmsKeyMsg
  | CmsUndoMsg
  | CmsRedoMsg
  | CmsInsertMsg
  | CmsSetAddTargetMsg
  | CmsOpenTemplatesMsg
  | CmsFontSizeMsg
  | CmsLinkClickMsg
  // Phase 2A (declared in the 2A appendix below): THE command envelope —
  // every migrated mutation rides it. In the union since 6C so the shell
  // narrows on it without a bridge cast.
  | CmsCmdMsg
  // Phase 2B (declared in the 2B appendix below): column click intent.
  | CmsClickedColumnMsg
  // Phase 3F (declared in the 3F appendix below): AI stage intent.
  | CmsAiStageMsg
  // Phase 5B (declared in the 5B appendix below): slider stage intents.
  | CmsClickedSliderSlideMsg
  | CmsClickedSliderLayerMsg
  | CmsStageMsg
  | CmsStageDeviceMsg

/** Every message on the wire, either direction. */
export type CmsMessage = ShellToCanvasMsg | CanvasToShellMsg

/* ================================================================== */
/* Send / receive helpers — the only doors onto the wire.              */
/* ================================================================== */

/**
 * Canvas -> shell. The canvas lives in an iframe of the SAME app; the
 * shell is its parent window. "*" targetOrigin is unchanged from today
 * (same-origin routes; the shell validates every field on receipt).
 */
export function postToShell(msg: CanvasToShellMsg): void {
  if (typeof window === "undefined") return
  window.parent?.postMessage(msg, "*")
}

/**
 * Shell -> canvas. The shell holds the iframe; pass its contentWindow
 * (nullable on purpose — before the iframe mounts this is a no-op,
 * exactly as the optional-chained sends behaved).
 */
export function postToCanvas(
  win: Window | null | undefined,
  msg: ShellToCanvasMsg
): void {
  win?.postMessage(msg, "*")
}

/**
 * Subscribe to incoming cms:* messages on this window. Non-cms traffic
 * (devtools, extensions, React internals) is filtered exactly as the old
 * per-type string matching ignored it. Field-level runtime validation
 * stays IN the handlers — postMessage is an untrusted boundary and the
 * types here describe honest senders, not hostile ones.
 *
 * Returns the unsubscribe function (use as a useEffect cleanup).
 */
export function onMessage(
  handler: (msg: CmsMessage, e: MessageEvent) => void
): () => void {
  const listen = (e: MessageEvent) => {
    const m = e.data as { type?: unknown } | null | undefined
    if (
      !m ||
      typeof m !== "object" ||
      typeof m.type !== "string" ||
      !m.type.startsWith("cms:")
    ) {
      return
    }
    handler(m as CmsMessage, e)
  }
  window.addEventListener("message", listen)
  return () => window.removeEventListener("message", listen)
}

/* --- Phase 2A command envelope ------------------------------------- */
/* Appended by seat 2A (bus executor + history). Seat 2B rebases on     */
/* this block; nothing above it was touched.                            */
/*                                                                      */
/* ONE message type carries every mutation the canvas sends once the    */
/* sender batches migrate (ARCH-CANVAS §3): the shell validates `name`  */
/* against the command registry                                         */
/* (modules/cms/editor/commands/registry.ts) and routes it through the  */
/* executor — single history, selection and canvas-sync path. Args use  */
/* the registry's vocabulary (index / colPath / path / region / key),   */
/* i.e. exactly the fields today's legacy messages carry.               */
/*                                                                      */
/* `label` overrides the registry's history label; `txn` groups         */
/* keystroke-level dispatches into one undo entry (same txn = one       */
/* history entry, regardless of timing).                                */

export type CmsCommandEnvelope = {
  name: import("../commands/registry").CommandName
  args: Record<string, unknown>
  label?: string
  txn?: string
}

/** Canvas → shell: dispatch a command over the bus. */
export type CmsCmdMsg = { type: "cms:cmd"; cmd: CmsCommandEnvelope }

export function postCommandToShell(cmd: CmsCommandEnvelope): void {
  if (typeof window === "undefined") return
  const msg: CmsCmdMsg = { type: "cms:cmd", cmd }
  window.parent?.postMessage(msg, "*")
}
/* --- end Phase 2A command envelope --------------------------------- */

/* --- Phase 2B NodeRef ---------------------------------------------- */
/* Appended by seat 2B (selection unification + selectable columns +    */
/* sender migration). Nothing above this line was touched except the    */
/* two union members referencing CmsSelectColumnMsg / CmsClickedColumnMsg
/* (declared below). The 2A block above is byte-identical.              */
/*                                                                      */
/* NodeRef — ONE node address, both sides (ARCH-CANVAS §4.1/§6).        */
/* Value-typed on purpose: the canvas DOM is rebuilt from Liquid        */
/* strings, so identity lives in addresses, not object references.      */
/* `col` paths are ODD-length ([c] or [c, wi, c2]); widget `path`s are  */
/* EVEN-length ([c, wi] or [c, wi, c2, wi2]) — exactly the [data-col] / */
/* [data-w] marker grammar the hit-tester parses.                       */
/* ------------------------------------------------------------------ */

export type SectionRef = { t: "section"; i: number }
/** NEW in P2: a column is first-class selectable (the owner's ask). */
export type ColumnRef = { t: "column"; i: number; col: number[] }
export type WidgetRef = { t: "widget"; i: number; path: number[] }
export type ElementRef = { t: "element"; i: number; el: string }
/** A repeated item (slide / banner tile / testimonial) of a section. */
export type ItemRef = { t: "item"; i: number; field: string; n: number }
export type ChromeRef = { t: "chrome"; region: string }
export type ChromeElRef = { t: "chromeEl"; region: string; el: string }

export type NodeRef =
  | SectionRef
  | ColumnRef
  | WidgetRef
  | ElementRef
  | ItemRef
  | ChromeRef
  | ChromeElRef
  // Phase 5B (declared in the 5B appendix below): the selection union
  // gains sliderSlide / sliderLayer (ARCH-SLIDER §3.3).
  | SliderSlideRef
  | SliderLayerRef

const numsEq = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i])

/** Structural equality — the hover/selection identity check. */
export function refEq(a: NodeRef | null, b: NodeRef | null): boolean {
  if (a === b) return true
  if (!a || !b || a.t !== b.t) return false
  switch (a.t) {
    case "section":
      return a.i === (b as SectionRef).i
    case "column":
      return a.i === (b as ColumnRef).i && numsEq(a.col, (b as ColumnRef).col)
    case "widget":
      return a.i === (b as WidgetRef).i && numsEq(a.path, (b as WidgetRef).path)
    case "element":
      return a.i === (b as ElementRef).i && a.el === (b as ElementRef).el
    case "item":
      return (
        a.i === (b as ItemRef).i &&
        a.field === (b as ItemRef).field &&
        a.n === (b as ItemRef).n
      )
    case "chrome":
      return a.region === (b as ChromeRef).region
    case "chromeEl":
      return (
        a.region === (b as ChromeElRef).region && a.el === (b as ChromeElRef).el
      )
    /* --- 5B stage: the two slider selection kinds --- */
    case "sliderSlide":
      return (
        a.i === (b as SliderSlideRef).i &&
        a.slideId === (b as SliderSlideRef).slideId
      )
    case "sliderLayer":
      return (
        a.i === (b as SliderLayerRef).i &&
        a.slideId === (b as SliderLayerRef).slideId &&
        a.layerId === (b as SliderLayerRef).layerId
      )
  }
}

/** The owning top-level section index, or null for chrome-family refs. */
export function sectionIndexOf(ref: NodeRef | null): number | null {
  if (!ref) return null
  return ref.t === "chrome" || ref.t === "chromeEl" ? null : ref.i
}

/** The column a ref lives in: a column is itself; a widget's parent column
 *  is its path minus the trailing widget index. Everything else: null. */
export function columnRefOf(ref: NodeRef | null): ColumnRef | null {
  if (!ref) return null
  if (ref.t === "column") return ref
  if (ref.t === "widget" && ref.path.length >= 2) {
    return { t: "column", i: ref.i, col: ref.path.slice(0, -1) }
  }
  return null
}

/* ---------------- column selection wire (INTEGRATION-2E §2) --------- */
/* Named to match the existing clicked/select pairs. The shell handles   */
/* these once the integrator applies INTEGRATION-2B.md (Sel gains a      */
/* `column` kind, the panel mounts 2E's column form). Until then the     */
/* canvas still selects/outlines the column locally — the messages are   */
/* simply unanswered.                                                    */

/** Canvas → shell: a container column was clicked (column-not-widget). */
export type CmsClickedColumnMsg = {
  type: "cms:clickedColumn"
  index: number // section index
  colPath: number[] // odd-length, e.g. [0] or [0,1,2] — the data-col path
}
/** Shell → canvas: column selection mirror (null-ish clears it). */
export type CmsSelectColumnMsg = {
  type: "cms:selectColumn"
  index: number | null
  colPath: number[] | null
}

/* ---------------- legacy sender batches (2B sender migration) -------- */
/* Canvas SENDERS migrated to `cms:cmd` envelopes (the shell's command   */
/* registry + cmdSink wrappers reproduce the legacy behavior exactly):   */
/*                                                                       */
/* Batch A — inserts:                                                    */
/*   cms:insertAt              → section.insert {at, type, presetIndex}  */
/*   cms:insertContainerAt     → container.insert {at, cols}             */
/*   cms:insertWidgetAt        → widget.insert {index, colPath, wi, type}*/
/*   cms:insertWidgetAsSection → widget.insertWrapped {at, type}         */
/* Batch B — moves:                                                      */
/*   cms:moveSection           → section.move {from, to}                 */
/*   cms:moveWidget            → widget.move {index, colPath, from, to}  */
/*   (cms:setContainerLayout had NO canvas sender already; its command   */
/*    is container.setLayout {index, cols})                              */
/* Batch C — structural toolbar / context-menu / item actions:           */
/*   cms:action up|down        → section.move {from, to: from±1}         */
/*   cms:action duplicate      → section.duplicate {index}               */
/*   cms:action delete         → section.remove {index}                  */
/*   cms:ctxAction duplicate   → section.duplicate | widget.duplicate    */
/*   cms:ctxAction delete      → section.remove | widget.remove          */
/*   cms:ctxAction paste (widget scope) → widget.paste {index, path}     */
/*   cms:ctxAction duplicateItem/deleteItem → item.duplicate|item.remove */
/*                               {index, field, itemIndex}               */
/*                                                                       */
/* NOT migrated (deliberately — no registry command exists for them):    */
/*   cms:action edit|addBelow|insert  (selection / palette side-effects) */
/*   cms:ctxAction edit|copy|paste(section)|copyStyle|pasteStyle|        */
/*     resetStyle              (clipboard + selection, shell-owned)      */
/*   cms:key, cms:undo, cms:redo, cms:fontSize, cms:insert,              */
/*   cms:setAddTarget, cms:openTemplates, cms:linkClick, and ALL         */
/*   selection plumbing (cms:ready / cms:data / cms:patch / the five     */
/*   select messages / the clicked messages + cms:clickedColumn above).  */
/*                                                                       */
/* The six Batch A/B message TYPES had ZERO senders after this           */
/* migration; seat 6C deleted them together with the shell's paired      */
/* legacy handlers (INTEGRATION-2B.md §4 executed).                      */
/* --- end Phase 2B NodeRef ------------------------------------------- */

/* --- 3F AI surface --------------------------------------------------- */
/* Appended by seat 3F (AiPromptBox — ARCH-AI §2/§4).                     */
/*                                                                        */
/* The AI RESULT itself rides the existing `cms:cmd` envelope as          */
/* `ai.apply { ref, set, before, staged: true }` (ARCH-AI §4.1) — no new  */
/* wire for it. This message carries what the envelope cannot:            */
/*                                                                        */
/* - cms:aiStage: resolve the pending staged preview. `promote` turns it  */
/*   into ONE labeled history entry (executor promoteStaged(label));      */
/*   `discard` re-applies the recorded before-state with zero history     */
/*   residue (executor discardStaged()).                                  */
/*                                                                        */
/* 6C zoo deletion: cms:aiImage (the image chips' optional deep-link) is  */
/* DELETED — the shell never grew a handler, so the message was a silent  */
/* no-op; the box's normal clicked/select intent already opens the panel  */
/* on the node, which is the whole behavior.                              */

/** Canvas → shell: resolve the pending staged AI preview. */
export type CmsAiStageMsg = {
  type: "cms:aiStage"
  op: "promote" | "discard"
  /** History label for `promote` ("AI: rewrote Heading"). */
  label?: string
}
/* --- end 3F AI surface ------------------------------------------------ */

/* --- 5B slider stage --------------------------------------------------- */
/* Appended by seat 5B (the slide stage — ARCH-SLIDER §3). Nothing above  */
/* this line was touched except: the NodeRef union's two new members, two */
/* refEq cases, and the three/one union references in CanvasToShellMsg /  */
/* ShellToCanvasMsg — the 2B/3F precedent exactly.                        */
/*                                                                        */
/* The stage's MUTATIONS all ride the existing `cms:cmd` envelope as the  */
/* slider.* registry family (one command per gesture) — no new wire for   */
/* them. These messages carry only what the envelope cannot: selection    */
/* intent and stage mode.                                                 */

/** Slide-level selection (filmstrip click / stage entry). */
export type SliderSlideRef = { t: "sliderSlide"; i: number; slideId: string }
/** Layer-level selection (stage box / layer-rail click). */
export type SliderLayerRef = {
  t: "sliderLayer"
  i: number
  slideId: string
  layerId: string
}

/** Canvas → shell: a slide became active on the stage (panel shows the
 *  slide's background/name/duration form). */
export type CmsClickedSliderSlideMsg = {
  type: "cms:clickedSliderSlide"
  index: number
  slideId: string
}

/** Canvas → shell: a layer was selected on the stage (panel mounts the
 *  per-layer SchemaPanel). layerId is never null here — clearing layer
 *  selection posts cms:clickedSliderSlide instead. */
export type CmsClickedSliderLayerMsg = {
  type: "cms:clickedSliderLayer"
  index: number
  slideId: string
  layerId: string
}

/** Canvas → shell: stage mode entered/exited (mode, NOT history —
 *  ARCH-SLIDER §3.3). On exit the shell restores section selection. */
export type CmsStageMsg = {
  type: "cms:stage"
  on: boolean
  index: number | null
}

/** Shell → canvas: slider selection mirror (panel back-navigation and
 *  executor selection restore). layerId null = slide-level selection;
 *  index null = clear (the stage may also exit if its section vanished). */
export type CmsSelectSliderLayerMsg = {
  type: "cms:selectSliderLayer"
  index: number | null
  slideId: string | null
  layerId: string | null
}
/** Canvas → shell: the STAGE's device switch (its own responsive
 *  control — the page header's buttons hide while staged). The shell
 *  resizes the canvas iframe, so the slider's per-device @media rules
 *  (frames + visibility) genuinely fire: what the stage shows IS the
 *  device render, not a relabelled desktop one. */
export type CmsStageDeviceMsg = {
  type: "cms:stageDevice"
  device: "desktop" | "tablet" | "mobile"
}

/** Shell → canvas: the AUTHORITATIVE device. The canvas used to infer its
 *  device from its own viewport width, which lies whenever the canvas box
 *  is narrower than the device it represents (a "desktop" centre region of
 *  ≤1024px read as tablet — so the stage silently edited tablet frames
 *  while its switch said Desktop). The shell knows the truth; the canvas
 *  now takes it and only falls back to width inference if it never
 *  arrives. */
export type CmsDeviceMsg = {
  type: "cms:device"
  device: "desktop" | "tablet" | "mobile"
}
/* --- end 5B slider stage ----------------------------------------------- */

/* --- 7A stage chrome relocation ---------------------------------------- */
/* Appended by seat 7A (RevSlider-exact full-screen stage layout).        */
/* Nothing above this line was touched except ONE new member on the       */
/* ShellToCanvasMsg union — the 5B precedent exactly.                     */
/*                                                                        */
/* WHY: the stage's chrome (filmstrip + layer rail) used to render INSIDE */
/* the canvas iframe, which the shell constrains to the width left over   */
/* by its 380px editing panel — so the rail was boxed in and, at mobile   */
/* preview width (390px), had to hide itself entirely. The chrome now     */
/* lives in the SHELL, which owns the whole viewport: top toolbar, right  */
/* "LAYER OPTIONS" sidebar, bottom layer list, canvas iframe in the       */
/* centre. The canvas keeps ONLY the manipulation overlay (stage rect,    */
/* layer boxes, resize handles, snap guides, device badge).               */
/*                                                                        */
/* This message is the handshake. It is a GATE, not a delete: StageMode   */
/* still ships its Filmstrip/LayerRail and renders them whenever the      */
/* shell has NOT claimed the chrome (`external: false`, the default), so  */
/* any path that mounts the stage without the 7A shell still works.       */
/*                                                                        */
/* Device switching is unchanged and deliberately NOT a new message: the  */
/* canvas derives its device from its own viewport width, so the shell's  */
/* top-bar switch resizing the iframe propagates automatically, and       */
/* StageMode's cms:stageDevice path (its compact bar + the entry-device   */
/* restore on exit) keeps working untouched. */

/** Shell → canvas: the shell is rendering the stage chrome itself.
 *  `external: true` suppresses the in-canvas filmstrip + layer rail (and
 *  the compact device bar that stood in for the hidden rail); the overlay
 *  keeps its full geometry role. Sent on stage entry, on canvas re-ready
 *  while staged, and with `external: false` on stage exit. */
export type CmsStageChromeMsg = {
  type: "cms:stageChrome"
  external: boolean
}

/** Shell → canvas: the stage's SESSION lock set (layer ids the user has
 *  padlocked in the bottom layer list). Session-only and deliberately NOT
 *  a command — locking is a workbench affordance, never document state,
 *  so it must not enter history/autosave/publish. It has to cross the
 *  iframe because the shell owns the padlock button while the canvas owns
 *  the drag: without this the padlock would be a lie. */
export type CmsStageLocksMsg = {
  type: "cms:stageLocks"
  layerIds: string[]
}

/** Shell → canvas: leave the stage. The 5B exit paths all originated in
 *  the canvas (Esc, scrim click, the filmstrip's close) and told the shell
 *  via cms:stage{on:false}; the 7A top bar's "Back" is the first exit that
 *  starts in the SHELL, so it needs the reverse leg. The canvas runs its
 *  own exitStage(), which posts cms:stage{on:false} back — one exit path,
 *  one place that restores section selection. */
export type CmsStageExitMsg = { type: "cms:stageExit" }
/* --- end 7A stage chrome relocation ------------------------------------ */
