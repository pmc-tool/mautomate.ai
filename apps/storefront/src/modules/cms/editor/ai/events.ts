"use client"

/* ------------------------------------------------------------------ */
/* 3F AI surface — open-intent wire.                                    */
/*                                                                     */
/* The three open affordances (node-toolbar sparkle, Cmd+J, the         */
/* context-menu row — ARCH-AI §2.1) live in OverlayLayer; the box       */
/* itself is one instance mounted beside them. A window CustomEvent     */
/* carries the intent so no prop threading crosses the canvas monolith. */
/* ------------------------------------------------------------------ */

import type { NodeRef } from "../canvas/protocol"

const EVT = "cms-ai-open"

export function openAiBox(ref: NodeRef): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVT, { detail: { ref } }))
}

export function onAiOpen(fn: (ref: NodeRef) => void): () => void {
  const h = (e: Event) => {
    const ref = (e as CustomEvent<{ ref?: NodeRef }>).detail?.ref
    if (ref && typeof ref === "object" && typeof (ref as { t?: unknown }).t === "string") {
      fn(ref)
    }
  }
  window.addEventListener(EVT, h)
  return () => window.removeEventListener(EVT, h)
}
