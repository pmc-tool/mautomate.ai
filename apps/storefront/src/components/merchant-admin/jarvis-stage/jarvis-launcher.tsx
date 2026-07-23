"use client"

import React, { useEffect, useRef, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { JarvisStage } from "./jarvis-stage"

/**
 * JarvisLauncher — the single floating Pixi entry point, docked bottom-right.
 * The orb is its own tiny <canvas>: a breathing core with a slow-drifting ember
 * halo, so the entry point itself already feels alive.
 *
 * Clicking the pill dispatches "jarvis:open", which the unified Pixi OS
 * listens for — the OS now carries the always-on real-time voice IN-SURFACE
 * (its mA core is the live voice orb), so there is no longer a separate dark
 * voice window by default.
 *
 * The legacy immersive dark <JarvisStage/> (opened by a "jarvis:voice" event) is
 * kept purely as a fallback and is gated behind NEXT_PUBLIC_JARVIS_DARK_STAGE=1
 * (default OFF). The pill hides itself while the OS is open
 * ("jarvis:panel-state") and carries the attention-count badge
 * ("jarvis:attention").
 */
// Fallback flag: set NEXT_PUBLIC_JARVIS_DARK_STAGE="1" to restore the old
// separate dark full-screen voice window. Default: the unified OS owns voice.
const DARK_STAGE = process.env.NEXT_PUBLIC_JARVIS_DARK_STAGE === "1"

// Where the pill's persisted position is stored between sessions.
const POSITION_KEY = "pixi:launcher-pos"
// Approximate pill footprint used for viewport clamping.
const PILL_W = 130
const PILL_H = 60

function clampPosition(x: number, y: number) {
  const maxX = Math.max(8, window.innerWidth - PILL_W)
  const maxY = Math.max(8, window.innerHeight - PILL_H)
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  }
}

export function JarvisLauncher() {
  const { token } = useMerchantAuth()
  const [open, setOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [attnCount, setAttnCount] = useState(0)
  const [hover, setHover] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef = useRef(false)
  hoverRef.current = hover

  // Draggable position (left/top). null = the default dock, which sits ABOVE
  // typical bottom action bars (Save / Continue) so it never covers them.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    dx: number
    dy: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const posRef = useRef(pos)
  posRef.current = pos

  // Hydrate the persisted position, re-clamped so a smaller viewport can never
  // strand the pill off-screen; keep it in-bounds on window resize too.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(POSITION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
          setPos(clampPosition(parsed.x, parsed.y))
        }
      }
    } catch {
      // Ignore a corrupt stored position.
    }
    const onResize = () => {
      const current = posRef.current
      if (current) setPos(clampPosition(current.x, current.y))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const lastDragMovedRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Left button / touch only.
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    lastDragMovedRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    // A real drag needs a few pixels of travel — protects plain clicks.
    if (
      !drag.moved &&
      Math.abs(e.clientX - drag.startX) < 4 &&
      Math.abs(e.clientY - drag.startY) < 4
    ) {
      return
    }
    drag.moved = true
    setPos(clampPosition(e.clientX - drag.dx, e.clientY - drag.dy))
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    lastDragMovedRef.current = !!drag?.moved
    if (drag?.moved && posRef.current) {
      try {
        window.localStorage.setItem(
          POSITION_KEY,
          JSON.stringify(posRef.current)
        )
      } catch {
        // Storage full/blocked — position simply won't persist.
      }
    }
  }

  // The unified event contract: the panel opens the stage ("jarvis:voice"),
  // tells us when it is open ("jarvis:panel-state") and how many items need
  // attention ("jarvis:attention").
  useEffect(() => {
    if (typeof window === "undefined") return
    const onVoice = () => setOpen(true)
    const onPanelState = (e: Event) =>
      setPanelOpen(Boolean((e as CustomEvent).detail?.open))
    const onAttention = (e: Event) =>
      setAttnCount(Number((e as CustomEvent).detail?.count) || 0)
    // The dark voice stage is a fallback only — listen for its open event when
    // explicitly enabled. By default the unified OS owns voice in-surface.
    if (DARK_STAGE) window.addEventListener("jarvis:voice", onVoice)
    window.addEventListener("jarvis:panel-state", onPanelState)
    window.addEventListener("jarvis:attention", onAttention)
    return () => {
      if (DARK_STAGE) window.removeEventListener("jarvis:voice", onVoice)
      window.removeEventListener("jarvis:panel-state", onPanelState)
      window.removeEventListener("jarvis:attention", onAttention)
    }
  }, [])

  // Mini living orb. `token` is a dependency on purpose: before auth resolves
  // the component renders null, so the canvas does not exist when this effect
  // first runs — without re-running on token arrival the orb stays blank
  // forever on a fresh dashboard load.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !token || open || panelOpen) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const size = 56
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    const cx = size / 2
    const cy = size / 2

    // A handful of orbiting sparks for a sense of depth.
    const sparks = Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * Math.PI * 2,
      r: 10 + (i % 3) * 4,
      s: 0.4 + (i % 4) * 0.15,
    }))

    let raf = 0
    let alive = true
    const start = performance.now()
    const frame = (now: number) => {
      if (!alive) return
      const t = (now - start) / 1000
      const breath = 1 + Math.sin(t * 1.6) * 0.08
      const hot = hoverRef.current ? 1.25 : 1

      ctx.clearRect(0, 0, size, size)
      ctx.globalCompositeOperation = "lighter"

      // halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * breath)
      halo.addColorStop(0, `rgba(242,101,34,${0.35 * hot})`)
      halo.addColorStop(1, "rgba(242,101,34,0)")
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, 26, 0, Math.PI * 2)
      ctx.fill()

      // orbiting sparks
      if (!reduced) {
        for (const sp of sparks) {
          const a = sp.a + t * sp.s
          const x = cx + Math.cos(a) * sp.r
          const y = cy + Math.sin(a) * sp.r * 0.9
          const g = ctx.createRadialGradient(x, y, 0, x, y, 3)
          g.addColorStop(0, "rgba(255,225,200,0.9)")
          g.addColorStop(1, "rgba(242,101,34,0)")
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // hot core
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 11 * breath)
      core.addColorStop(0, `rgba(255,244,230,${0.95 * hot})`)
      core.addColorStop(0.4, `rgba(255,150,90,${0.75 * hot})`)
      core.addColorStop(1, "rgba(242,101,34,0)")
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, 11 * breath, 0, Math.PI * 2)
      ctx.fill()

      if (reduced) {
        alive = false
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [open, panelOpen, token])

  if (!token) return null

  return (
    <>
      {!open && !panelOpen && (
        <button
          type="button"
          onClick={() => {
            // A drag that ends on the pill must not also open Pixi.
            if (lastDragMovedRef.current) {
              lastDragMovedRef.current = false
              return
            }
            window.dispatchEvent(new CustomEvent("jarvis:open"))
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label="Pixi (drag to move)"
          title="Pixi — drag to move"
          className="jv-launch fixed z-40 flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4"
          style={
            pos
              ? {
                  left: pos.x,
                  top: pos.y,
                  right: "auto",
                  bottom: "auto",
                  touchAction: "none",
                }
              : // Default dock is LIFTED above the bottom edge so it clears the
                // Save / Continue action bars that live bottom-right on the
                // setup wizard and product forms.
                { bottom: "6.5rem", right: "1.5rem", touchAction: "none" }
          }
        >
          <canvas
            ref={canvasRef}
            width={56}
            height={56}
            style={{ width: 40, height: 40, display: "block" }}
            aria-hidden="true"
          />
          <span
            className="text-[13px] font-semibold"
            style={{ color: "#F5F1EC" }}
          >
            Pixi
          </span>
          {attnCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ring-2 ring-white"
              style={{ background: "#F26522" }}
            >
              {attnCount}
            </span>
          )}
          <style>{`
            .jv-launch{
              background:rgba(15,19,25,0.92);
              border:1px solid rgba(242,101,34,0.35);
              box-shadow:0 6px 26px rgba(0,0,0,0.35), 0 0 24px rgba(242,101,34,0.22);
              backdrop-filter:blur(8px);
              transition:transform .2s cubic-bezier(0.2,0.8,0.2,1), box-shadow .3s, border-color .3s;
            }
            .jv-launch:hover{
              transform:translateY(-2px);
              border-color:rgba(242,101,34,0.6);
              box-shadow:0 8px 32px rgba(0,0,0,0.4), 0 0 34px rgba(242,101,34,0.38);
            }
          `}</style>
        </button>
      )}

      {/* Fallback dark voice window — off by default; the unified OS is the
          always-on voice surface. Kept for NEXT_PUBLIC_JARVIS_DARK_STAGE=1. */}
      {DARK_STAGE && <JarvisStage open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
