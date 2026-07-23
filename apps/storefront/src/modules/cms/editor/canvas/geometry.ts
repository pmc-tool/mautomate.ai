"use client"

/* ------------------------------------------------------------------ */
/* Canvas geometry store (CANVAS P1 — parity).                          */
/*                                                                     */
/* Replaces the `measureTick` counter: instead of seven effects each    */
/* re-measuring the DOM whenever a state counter bumps, ONE store       */
/* invalidates (rAF-batched) on scroll / resize / DOM mutation and      */
/* notifies subscribers. Overlay effects subscribe via                  */
/* useGeometryVersion() — the returned number replaces `measureTick`    */
/* in their dependency arrays — and read rects through rectOf(), which  */
/* memoizes getBoundingClientRect per element per version.              */
/*                                                                     */
/* Mutation observation is childList+subtree only: theme HTML lands via */
/* dangerouslySetInnerHTML (React cannot tell us), but attribute        */
/* changes are deliberately NOT observed — the outline effects write    */
/* el.style on these very nodes, and observing attributes would loop    */
/* invalidations forever.                                               */
/* ------------------------------------------------------------------ */

import { useEffect, useRef, useSyncExternalStore } from "react"

export class GeometryStore {
  private version = 0
  private listeners = new Set<() => void>()
  private raf: number | null = null
  private root: HTMLElement | null = null
  private mo: MutationObserver | null = null
  private cache = new WeakMap<Element, { v: number; rect: DOMRect }>()

  /** Attach the window listeners + the mutation observer to `root`.
   *  Idempotent per root; call disconnect() before re-observing. */
  observe(root: HTMLElement): void {
    if (this.root === root) return
    this.disconnect()
    this.root = root
    window.addEventListener("scroll", this.invalidate, true)
    window.addEventListener("resize", this.invalidate)
    if (typeof MutationObserver !== "undefined") {
      this.mo = new MutationObserver(this.invalidate)
      this.mo.observe(root, { childList: true, subtree: true })
    }
  }

  disconnect(): void {
    if (!this.root) return
    window.removeEventListener("scroll", this.invalidate, true)
    window.removeEventListener("resize", this.invalidate)
    this.mo?.disconnect()
    this.mo = null
    this.root = null
    if (this.raf != null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
  }

  /** Invalidate every cached rect and notify subscribers, at most once
   *  per animation frame (scroll fires far more often than paint). */
  invalidate = (): void => {
    if (this.raf != null) return
    this.raf = requestAnimationFrame(() => {
      this.raf = null
      this.version++
      this.listeners.forEach((fn) => fn())
    })
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getVersion = (): number => this.version

  /** The element's viewport rect, measured at most once per version. */
  rectOf(el: Element): DOMRect
  rectOf(el: Element | null | undefined): DOMRect | null
  rectOf(el: Element | null | undefined): DOMRect | null {
    if (!el) return null
    const hit = this.cache.get(el)
    if (hit && hit.v === this.version) return hit.rect
    const rect = el.getBoundingClientRect()
    this.cache.set(el, { v: this.version, rect })
    return rect
  }
}

/**
 * The canvas's one geometry store, attached to the canvas root once it
 * mounts. Stable identity for the lifetime of the page.
 */
export function useGeometry(
  rootRef: React.RefObject<HTMLElement | null>
): GeometryStore {
  const storeRef = useRef<GeometryStore | null>(null)
  if (storeRef.current == null) storeRef.current = new GeometryStore()
  const store = storeRef.current
  useEffect(() => {
    const root = rootRef.current
    if (root) store.observe(root)
    return () => store.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])
  return store
}

/**
 * Subscribe to the store; the returned number is the drop-in replacement
 * for the old `measureTick` state in effect/memo dependency arrays.
 */
export function useGeometryVersion(store: GeometryStore): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion)
}
