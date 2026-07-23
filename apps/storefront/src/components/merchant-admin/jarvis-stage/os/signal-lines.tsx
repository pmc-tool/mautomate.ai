"use client"

/* ------------------------------------------------------------------ */
/* SignalLines — the glowing ember conduits from the core to each card.  */
/*                                                                     */
/* A pointer-events:none SVG overlay pinned to the viewport (fixed inset-0). */
/* It only READS layout: each rAF tick it looks up every expanded card's      */
/* DOM rect ([data-jarvis-card]) and the orb centre, then draws a curved       */
/* conduit entering the card from its orb-facing edge. It MUTATES <path> `d`     */
/* attributes directly (no React state per frame) so it can never drive          */
/* layout — no feedback loop. The focused card's line is brightest; while a       */
/* card is loading its conduit flows (animated dash). Reduced-motion: static.      */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useRef } from "react"
import { useJarvisOS } from "./os-provider"
import { useJarvisDesign } from "./design"
import { os } from "./tokens"

type LineRefs = {
  glow: SVGPathElement | null
  core: SVGPathElement | null
  bead: SVGCircleElement | null
}

export function SignalLines({
  getOrbCenter,
}: {
  getOrbCenter: () => { x: number; y: number }
}) {
  const { cards, focusId } = useJarvisOS()
  const [design] = useJarvisDesign()
  const refs = useRef<Map<string, LineRefs>>(new Map())
  const rafRef = useRef(0)

  // Only draw conduits to expanded cards (the store already excludes minimized
  // / dismissed from `cards`).
  const ids = useMemo(() => cards.map((c) => c.id), [cards])
  const focusRef = useRef<string | null>(focusId)
  focusRef.current = focusId
  const idsRef = useRef<string[]>(ids)
  idsRef.current = ids
  const designRef = useRef(design)
  designRef.current = design

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

    let last = 0
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - last < 33) return // ~30fps
      last = now

      const orb = getOrbCenter()
      for (const id of idsRef.current) {
        const set = refs.current.get(id)
        if (!set || !set.glow || !set.core) continue
        const el = document.querySelector<HTMLElement>(`[data-jarvis-card="${id}"]`)
        if (!el) {
          set.glow.setAttribute("d", "")
          set.core.setAttribute("d", "")
          if (set.bead) set.bead.setAttribute("opacity", "0")
          continue
        }
        const r = el.getBoundingClientRect()
        // Anchor: the midpoint of the card edge that faces the orb.
        const cardCx = r.left + r.width / 2
        const facingLeft = cardCx > orb.x
        const ax = facingLeft ? r.left : r.right
        const ay = Math.min(Math.max(orb.y, r.top + 14), r.bottom - 14)

        // Gentle S-curve: control points pulled horizontally between orb & card.
        const midX = (orb.x + ax) / 2
        const d = `M ${orb.x} ${orb.y} C ${midX} ${orb.y}, ${midX} ${ay}, ${ax} ${ay}`
        set.glow.setAttribute("d", d)
        set.core.setAttribute("d", d)

        const focused = focusRef.current === id
        const loading = el.getAttribute("data-jarvis-loading") === "1"

        // Classic conduit rendering in BOTH designs (the always-visible flowing
        // lines read better than the v2 ghost treatment). While a card loads,
        // v2 additionally sends a light packet travelling core -> card.
        if (designRef.current === "v2" && set.bead && loading && !reduce) {
          try {
            const len = set.core.getTotalLength()
            const p = (now % 1100) / 1100
            const pt = set.core.getPointAtLength(len * p)
            set.bead.setAttribute("opacity", "0.95")
            set.bead.setAttribute("cx", String(pt.x))
            set.bead.setAttribute("cy", String(pt.y))
          } catch {
            set.bead.setAttribute("opacity", "0")
          }
          set.glow.setAttribute("opacity", focused ? "0.5" : "0.22")
          set.core.setAttribute("opacity", focused ? "0.95" : "0.5")
          set.core.setAttribute("stroke-width", focused ? "1.8" : "1.2")
          continue
        }

        set.glow.setAttribute("opacity", focused ? "0.5" : "0.22")
        set.core.setAttribute("opacity", focused ? "0.95" : "0.5")
        set.core.setAttribute("stroke-width", focused ? "1.8" : "1.2")

        if (set.bead) {
          // Bead rides the anchor end; visible only when loading & not reduced.
          set.bead.setAttribute("opacity", loading && !reduce ? "0.9" : "0")
          set.bead.setAttribute("cx", String(ax))
          set.bead.setAttribute("cy", String(ay))
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getOrbCenter])

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <defs>
        <linearGradient id="jvSignal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F58A4E" />
          <stop offset="55%" stopColor={os.emberDeep} />
          <stop offset="100%" stopColor="#B8410F" />
        </linearGradient>
        <filter id="jvGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {ids.map((id) => (
        <g key={id}>
          <path
            ref={(node) => {
              const cur = refs.current.get(id) ?? { glow: null, core: null, bead: null }
              cur.glow = node
              refs.current.set(id, cur)
            }}
            d=""
            fill="none"
            stroke={os.ember}
            strokeWidth={6}
            strokeLinecap="round"
            filter="url(#jvGlow)"
            opacity={0}
          />
          <path
            ref={(node) => {
              const cur = refs.current.get(id) ?? { glow: null, core: null, bead: null }
              cur.core = node
              refs.current.set(id, cur)
            }}
            className="jv-signal-core"
            d=""
            fill="none"
            stroke="url(#jvSignal)"
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0}
          />
          <circle
            ref={(node) => {
              const cur = refs.current.get(id) ?? { glow: null, core: null, bead: null }
              cur.bead = node
              refs.current.set(id, cur)
            }}
            r={3.2}
            fill={os.emberDeep}
            opacity={0}
            className="jv-signal-bead"
          />
        </g>
      ))}
      <style>{`
        .jv-signal-core{ stroke-dasharray: 5 9; animation: jvflow .7s linear infinite; }
        @keyframes jvflow{ to{ stroke-dashoffset: -14; } }
        .jv-signal-bead{ filter: drop-shadow(0 0 4px rgba(255,180,110,0.9)); }
        @media (prefers-reduced-motion: reduce){
          .jv-signal-core{ animation: none; stroke-dasharray: none; }
        }
      `}</style>
    </svg>
  )
}
