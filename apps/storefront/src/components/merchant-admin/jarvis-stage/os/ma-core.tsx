"use client"

/* ------------------------------------------------------------------ */
/* MaCore — the LIGHT "mA" core for the Pixi OS surface.              */
/*                                                                     */
/* A dependency-free 2D-canvas emblem matching the approved concept: a    */
/* radial glow disc (white -> warm cream -> ember rim) with the "mA" glyph   */
/* in an ember gradient, concentric rotating tech-rings (some broken/dashed   */
/* arcs), an expanding pulse ring, and orbiting particles — all on a warm      */
/* near-white field. Prop-driven with the SAME interface the OS feeds the       */
/* orb (state + 0..1 voice level): state modulates glow + ring speed, level      */
/* drives a reactive ring/pulse. Respects prefers-reduced-motion (static draw).   */
/*                                                                     */
/* This is used ONLY inside the OS surface. The dark WebGL JarvisCore and the    */
/* immersive jarvis-stage.tsx voice flow are left untouched.                      */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef } from "react"
import type { JarvisState, JarvisActivity } from "../jarvis-core"
import type { JarvisDesign } from "./design"

type MaCoreProps = {
  state: JarvisState
  level: number
  activities?: JarvisActivity[]
  /** "v2" = the unlabeled molten "quiet sun"; "classic" = the mA emblem. */
  design?: JarvisDesign
}

export function MaCore({ state, level, activities, design = "classic" }: MaCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ state, level, activities, design })
  propsRef.current = { state, level, activities, design }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

    let w = 0
    let h = 0
    let dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Static orbiting particles (stable seed so they don't jitter on resize).
    const particles = Array.from({ length: 16 }, (_, i) => ({
      a: (i / 16) * Math.PI * 2,
      rf: 1.5 + (i % 4) * 0.28, // radius factor of base
      sp: (i % 2 === 0 ? 1 : -1) * (0.12 + (i % 3) * 0.05),
      sz: 1.2 + (i % 3) * 0.7,
    }))

    // Broken tech-rings: [radiusFactor, gapCount, dir, widthPx].
    const rings = [
      { rf: 1.42, gaps: 3, dir: 1, lw: 1.4, dash: false },
      { rf: 1.74, gaps: 0, dir: -1, lw: 1.0, dash: true },
      { rf: 2.12, gaps: 4, dir: 1, lw: 1.2, dash: false },
      { rf: 2.5, gaps: 2, dir: -1, lw: 0.9, dash: true },
    ]

    // eased scene values
    let sGlow = 0.6
    let sSpeed = 0.15
    let sLevel = 0
    let sEnter = 0
    const start = performance.now()
    let raf = 0

    const approach = (cur: number, t: number, rate: number, dt: number) =>
      cur + (t - cur) * (1 - Math.exp(-rate * dt))

    const draw = (time: number, glow: number, speed: number, lvl: number, enter: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h)
      const base = R * 0.13 * (0.6 + 0.4 * enter)

      // 1. Warm ambient glow behind the core (seats it on the light field).
      const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 4.4)
      amb.addColorStop(0, `rgba(255,236,214,${0.55 * glow})`)
      amb.addColorStop(0.4, `rgba(250,214,177,${0.28 * glow})`)
      amb.addColorStop(0.72, `rgba(242,101,34,${0.10 * glow})`)
      amb.addColorStop(1, "rgba(246,245,243,0)")
      ctx.fillStyle = amb
      ctx.beginPath()
      ctx.arc(cx, cy, base * 4.4, 0, Math.PI * 2)
      ctx.fill()

      // 2. Expanding pulse ring — reactive to level.
      const period = 2.6
      const ph = ((time / 1000) % period) / period
      const pulseR = base * (1.05 + ph * (2.2 + 1.2 * lvl))
      const pulseA = (1 - ph) * (0.22 + 0.4 * lvl) * glow
      ctx.strokeStyle = `rgba(242,101,34,${pulseA})`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
      ctx.stroke()

      // 3. Concentric tech-rings (some broken, some dashed), slow rotation.
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri]
        const rad = base * ring.rf
        const rot = (time / 1000) * speed * ring.dir + ri * 0.6
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.strokeStyle = `rgba(242,101,34,${0.32 * glow + (ri === 0 ? 0.12 : 0)})`
        ctx.lineWidth = ring.lw
        if (ring.dash) ctx.setLineDash([2, 7])
        else ctx.setLineDash([])
        if (ring.gaps > 0) {
          // broken arc segments with gaps
          const seg = (Math.PI * 2) / ring.gaps
          const gap = seg * 0.26
          for (let g = 0; g < ring.gaps; g++) {
            ctx.beginPath()
            ctx.arc(0, 0, rad, g * seg + gap / 2, (g + 1) * seg - gap / 2)
            ctx.stroke()
          }
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, rad, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
      ctx.setLineDash([])

      // 4. Reactive inner ring — swells with the voice level.
      const inner = base * (1.14 + 0.34 * lvl)
      ctx.strokeStyle = `rgba(226,78,18,${0.4 + 0.4 * lvl})`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(cx, cy, inner, 0, Math.PI * 2)
      ctx.stroke()

      // 5. Orbiting particles.
      for (const p of particles) {
        const ang = p.a + (time / 1000) * p.sp * (0.6 + speed)
        const pr = base * p.rf
        const px = cx + Math.cos(ang) * pr
        const py = cy + Math.sin(ang) * pr
        const g = ctx.createRadialGradient(px, py, 0, px, py, p.sz * 2.4)
        g.addColorStop(0, `rgba(242,101,34,${0.9 * glow})`)
        g.addColorStop(1, "rgba(242,101,34,0)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(px, py, p.sz * 2.4, 0, Math.PI * 2)
        ctx.fill()
      }

      if (propsRef.current.design === "v2") {
        // 6-v2. The "quiet sun": an unlabeled molten sphere. Hot cream heart
        // off-centre, gold mid, deep-ember rim — no gloss dot, no glyph.
        const disc = ctx.createRadialGradient(
          cx - base * 0.24,
          cy - base * 0.3,
          0,
          cx,
          cy,
          base
        )
        disc.addColorStop(0, "#FFF0D0")
        disc.addColorStop(0.22, "#FBBE72")
        disc.addColorStop(0.52, "#EE7A31")
        disc.addColorStop(0.76, "#CE4E15")
        disc.addColorStop(1, "#8F2F08")
        ctx.fillStyle = disc
        ctx.beginPath()
        ctx.arc(cx, cy, base, 0, Math.PI * 2)
        ctx.fill()

        // Slow-drifting heat spot keeps the surface molten, not plastic.
        const hx = cx - base * 0.18 + Math.sin(time / 4200) * base * 0.16
        const hy = cy - base * 0.22 + Math.cos(time / 5300) * base * 0.12
        const heat = ctx.createRadialGradient(hx, hy, 0, hx, hy, base * 0.72)
        heat.addColorStop(0, `rgba(255,246,224,${0.5 * glow})`)
        heat.addColorStop(0.55, `rgba(255,206,140,${0.18 * glow})`)
        heat.addColorStop(1, "rgba(255,206,140,0)")
        ctx.fillStyle = heat
        ctx.beginPath()
        ctx.arc(cx, cy, base, 0, Math.PI * 2)
        ctx.fill()

        // Rim shading toward the lower-right seats the sphere in the light.
        const rim = ctx.createRadialGradient(
          cx + base * 0.28,
          cy + base * 0.34,
          base * 0.35,
          cx,
          cy,
          base
        )
        rim.addColorStop(0, "rgba(101,28,3,0)")
        rim.addColorStop(0.75, "rgba(101,28,3,0.08)")
        rim.addColorStop(1, "rgba(101,28,3,0.42)")
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(cx, cy, base, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = "rgba(178,59,14,0.4)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, base, 0, Math.PI * 2)
        ctx.stroke()
        return
      }

      // 6. Core disc: white -> warm cream -> ember rim.
      const disc = ctx.createRadialGradient(cx, cy - base * 0.12, 0, cx, cy, base)
      disc.addColorStop(0, "rgba(255,255,255,0.98)")
      disc.addColorStop(0.5, "rgba(255,241,228,0.98)")
      disc.addColorStop(0.82, "rgba(250,202,160,0.96)")
      disc.addColorStop(1, "rgba(242,101,34,0.92)")
      ctx.fillStyle = disc
      ctx.beginPath()
      ctx.arc(cx, cy, base, 0, Math.PI * 2)
      ctx.fill()
      // crisp ember rim
      ctx.strokeStyle = "rgba(226,78,18,0.55)"
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx, cy, base, 0, Math.PI * 2)
      ctx.stroke()

      // 7. "mA" glyph in an ember vertical gradient.
      const fs = base * 0.92
      ctx.font = `700 ${fs}px Inter, -apple-system, 'Segoe UI', Roboto, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const gg = ctx.createLinearGradient(cx, cy - fs * 0.5, cx, cy + fs * 0.5)
      gg.addColorStop(0, "#F58A4E")
      gg.addColorStop(1, "#D9450F")
      ctx.fillStyle = gg
      ctx.fillText("mA", cx, cy + base * 0.04)
    }

    if (reduce) {
      // Static: single composed frame, no loop.
      const p = propsRef.current
      const st = p.state
      const glow = st === "thinking" ? 1 : st === "speaking" ? 0.9 : st === "listening" ? 0.8 : 0.65
      draw(1600, glow, 0, Math.min(0.2, p.level || 0), 1)
      return () => ro.disconnect()
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const time = now - start
      const dt = 1 / 60
      const p = propsRef.current
      const st = p.state
      const anyRunning = (p.activities || []).some((a) => a.state === "running")
      const tGlow =
        st === "thinking" || anyRunning ? 1.0 : st === "speaking" ? 0.9 : st === "listening" ? 0.82 : 0.65
      const tSpeed =
        st === "thinking" || anyRunning ? 0.7 : st === "listening" ? 0.34 : st === "speaking" ? 0.5 : 0.15
      const tLevel = Math.max(0, Math.min(1, p.level || 0))
      sGlow = approach(sGlow, tGlow, 4, dt)
      sSpeed = approach(sSpeed, tSpeed, 3, dt)
      sLevel = approach(sLevel, tLevel, 9, dt)
      sEnter = approach(sEnter, 1, 2.2, dt)
      draw(time, sGlow, sSpeed, sLevel, sEnter)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full block" />
    </div>
  )
}
