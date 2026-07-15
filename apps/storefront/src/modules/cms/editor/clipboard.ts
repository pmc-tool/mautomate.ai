/* ------------------------------------------------------------------ */
/* THE editor clipboard — one, shared by everything.                    */
/*                                                                     */
/* There used to be two: the sidebar's Copy style wrote to one buffer,  */
/* the right-click menu to another. Copy in one place, paste in the     */
/* other — nothing happened. This module is now the only clipboard:     */
/* the panel strip, the context menu and the keyboard all read and      */
/* write here, and it persists to localStorage so a copied look         */
/* survives switching pages.                                            */
/*                                                                     */
/* Three slots, not one: copying a style must not evict a copied        */
/* section (they gate different Paste items in the menu).               */
/* ------------------------------------------------------------------ */

export type StyleClip = {
  /** What kind of thing the style was copied FROM. Paste adapts to the
   *  target: elementStyles only travel section-to-section / chrome-to-chrome;
   *  widgets and elements take style + advanced only. */
  source: "section" | "widget" | "element" | "chrome" | "chromeElement"
  style?: Record<string, unknown>
  advanced?: Record<string, unknown>
  elementStyles?: Record<string, unknown>
}

export type ClipboardState = {
  section: Record<string, unknown> | null
  widget: Record<string, unknown> | null
  style: StyleClip | null
}

const KEY = "ff_clipboard_v2"
const LEGACY_STYLE_KEY = "ff_copied_style"

let state: ClipboardState = { section: null, widget: null, style: null }
let loaded = false

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      state = {
        section: p?.section ?? null,
        widget: p?.widget ?? null,
        style: p?.style ?? null,
      }
      return
    }
  } catch {
    // malformed buffer — start empty
  }
  // One-time import of the old sidebar copy-style buffer, so a style copied
  // before this upgrade still pastes after it.
  try {
    const raw = window.localStorage.getItem(LEGACY_STYLE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p === "object") {
        state = {
          ...state,
          style: {
            source: "section",
            style: p.style ?? {},
            advanced: p.advanced ?? {},
          },
        }
      }
    }
  } catch {
    // ignore malformed legacy buffer
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // quota / unavailable — the in-memory clipboard still works this session
  }
}

export function readClipboard(): ClipboardState {
  load()
  return state
}

export function writeClip<K extends keyof ClipboardState>(
  k: K,
  v: ClipboardState[K]
) {
  load()
  state = { ...state, [k]: v }
  persist()
}

/** What the menus need to grey out dead Paste items. */
export function clipSummary() {
  load()
  return {
    hasSection: !!state.section,
    hasWidget: !!state.widget,
    hasStyle: !!state.style,
  }
}

/* Deep-merge `extra` onto `base` (plain objects merge recursively; arrays and
   scalars are replaced). Paste is a MERGE everywhere now — copied keys win,
   existing keys the copy doesn't mention survive — because "Paste Style"
   replacing in one entry point and merging in another was two behaviors
   wearing one label. */
export function deepMergeBag(
  base: Record<string, unknown>,
  extra: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base ?? {}) }
  for (const k of Object.keys(extra ?? {})) {
    const bv = out[k]
    const ev = extra[k]
    if (
      bv &&
      ev &&
      typeof bv === "object" &&
      typeof ev === "object" &&
      !Array.isArray(bv) &&
      !Array.isArray(ev)
    ) {
      out[k] = deepMergeBag(
        bv as Record<string, unknown>,
        ev as Record<string, unknown>
      )
    } else {
      out[k] = ev
    }
  }
  return out
}
