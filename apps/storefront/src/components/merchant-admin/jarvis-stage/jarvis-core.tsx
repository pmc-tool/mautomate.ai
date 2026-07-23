"use client"

import React, { useEffect, useRef } from "react"

/**
 * JarvisCore — a single living, fluid, glowing orb (Siri / orb-ui style).
 *
 * One WebGL fragment shader draws a molten sphere: domain-warped fbm gives it an
 * organic liquid surface, a hot core fades through gold and ember to a deep rim,
 * an iridescent shimmer rides the edge, and a soft bloom haloes it. It is
 * audio-reactive (voice level swells and brightens it) and eases smoothly between
 * idle / listening / thinking / speaking. No particles, no lines — just the orb.
 *
 * Pure WebGL + a CSS-gradient fallback. No dependencies. Driven entirely by props.
 */

export type JarvisState = "idle" | "listening" | "thinking" | "speaking"

export type JarvisActivity = {
  id: string
  label: string
  state: "running" | "done"
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;   // 0..1 audio
uniform float uSpeed;   // motion speed (eased by state)
uniform float uEnter;   // 0..1 entrance
uniform float uHue;     // iridescence / thinking accent

float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.55;
  for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02+vec2(1.7,9.2); a*=0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = uTime * uSpeed;
  float lvl = uLevel;

  // Domain-warped fluid — kept INSIDE the orb so the background stays clean.
  vec2 q = uv * 3.0;
  float w  = fbm(q + vec2(t*0.8, -t*0.5));
  float flow = fbm(q*1.4 + vec2(w, w) + vec2(0.0, t));

  // Contained radius with a gentle breath, audio swell, and a liquid wobble.
  float breathe = 0.5 + 0.5*sin(uTime*0.7);
  float R = (0.205 + 0.018*breathe + 0.085*lvl) * mix(0.25, 1.0, smoothstep(0.0,1.0,uEnter));
  float Rw = R + 0.035*(flow-0.5);

  float edge = smoothstep(Rw+0.012, Rw-0.06, r);   // crisp-ish body, soft inner
  float halo = exp(-8.5 * max(0.0, r-Rw));          // tight bloom → clean dark field

  float depth = clamp(1.0 - r/max(Rw,0.001), 0.0, 1.0); // 0 rim .. 1 centre
  float surf  = 0.55 + 0.9*(flow-0.5);                  // liquid brightness

  // Molten palette.
  vec3 deep = vec3(0.38, 0.05, 0.04);
  vec3 emb  = vec3(0.97, 0.38, 0.12);
  vec3 gold = vec3(1.00, 0.72, 0.32);
  vec3 hotW = vec3(1.00, 0.95, 0.86);

  vec3 col = mix(deep, emb, smoothstep(0.05, 0.75, depth*surf + 0.25));
  col = mix(col, gold, smoothstep(0.5, 0.9, depth));
  col = mix(col, hotW, smoothstep(0.88, 1.0, depth) * 0.7); // small hot heart

  // Iridescent flowing rim — a cool shimmer riding the liquid edge.
  float rim = smoothstep(Rw-0.07, Rw-0.005, r) * smoothstep(Rw+0.03, Rw-0.01, r);
  vec3 iri = mix(vec3(0.30,0.55,1.0), vec3(0.85,0.35,0.95),
                 0.5 + 0.5*sin(ang*3.0 + flow*5.0 + uTime*0.6 + uHue));
  col += iri * rim * (0.40 + 0.25*lvl);

  // Fluid contained inside the body; tight ember bloom outside.
  vec3 outCol = col*edge + emb*halo*(0.28 + 0.65*lvl);
  outCol *= (0.92 + 0.40*lvl);

  gl_FragColor = vec4(outCol, 1.0);
}
`

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`

type CoreProps = { state: JarvisState; level: number; activities?: JarvisActivity[] }

export function JarvisCore({ state, level, activities }: CoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef({ state, level, activities })
  propsRef.current = { state, level, activities }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

    const gl =
      (canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false }) ||
        canvas.getContext("experimental-webgl", { alpha: false })) as WebGLRenderingContext | null

    // No WebGL → show the CSS fallback glow, skip the GL path.
    if (!gl) {
      if (fallbackRef.current) fallbackRef.current.style.display = "block"
      return
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (fallbackRef.current) fallbackRef.current.style.display = "block"
      return
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const U = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      level: gl.getUniformLocation(prog, "uLevel"),
      speed: gl.getUniformLocation(prog, "uSpeed"),
      enter: gl.getUniformLocation(prog, "uEnter"),
      hue: gl.getUniformLocation(prog, "uHue"),
    }

    let raf = 0
    let start = 0
    // eased scene values
    let sLevel = 0
    let sSpeed = 0.16
    let sEnter = 0
    let sHue = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor(canvas.clientWidth * dpr)
      const h = Math.floor(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const approach = (cur: number, target: number, rate: number, dt: number) =>
      cur + (target - cur) * (1 - Math.exp(-rate * dt))

    const frame = (now: number) => {
      if (!start) start = now
      const time = (now - start) / 1000
      const dt = 1 / 60

      const p = propsRef.current
      const st = p.state
      const anyRunning = (p.activities || []).some((a) => a.state === "running")

      // targets by state
      const tSpeed = st === "thinking" ? 0.78 : st === "listening" ? 0.42 : st === "speaking" ? 0.5 : 0.17
      const baseLevel = st === "thinking" ? 0.34 : st === "listening" ? 0.12 : st === "speaking" ? 0.18 : 0.06
      const audio = Math.max(0, Math.min(1, p.level || 0))
      const tLevel = Math.max(baseLevel, audio) + (anyRunning ? 0.08 : 0)
      const tHue = st === "thinking" || anyRunning ? 1 : 0

      sSpeed = approach(sSpeed, reduce ? 0.05 : tSpeed, 3, dt)
      sLevel = approach(sLevel, reduce ? Math.min(0.2, tLevel) : tLevel, 9, dt)
      sEnter = approach(sEnter, 1, 2.2, dt)
      sHue = approach(sHue, tHue, 1.5, dt)

      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.time, reduce ? 6.0 : time)
      gl.uniform1f(U.level, sLevel)
      gl.uniform1f(U.speed, sSpeed)
      gl.uniform1f(U.enter, sEnter)
      gl.uniform1f(U.hue, sHue * 3.14159)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      try {
        gl.getExtension("WEBGL_lose_context")?.loseContext()
      } catch {
        /* noop */
      }
    }
  }, [])

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={canvasRef} className="h-full w-full block" />
      {/* CSS fallback when WebGL is unavailable */}
      <div
        ref={fallbackRef}
        style={{
          display: "none",
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "44vmin",
          height: "44vmin",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 45%, #fff2e0 0%, #ffb055 22%, #f26522 48%, #7a1508 78%, rgba(0,0,0,0) 100%)",
          filter: "blur(2px)",
          animation: "jvbreath 4s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes jvbreath{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.05)}}`}</style>
    </div>
  )
}
