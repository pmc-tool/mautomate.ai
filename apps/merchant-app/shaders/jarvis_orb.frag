#version 460 core
#include <flutter/runtime_effect.glsl>

// mAutomate — Jarvis orb.
// A single living, fluid, glowing molten sphere, ported 1:1 from the accepted
// web v3 shader (apps/storefront/.../jarvis-stage/jarvis-core.tsx). Domain-warped
// fbm gives an organic liquid surface; a hot core fades through gold and ember to
// a deep rim; an iridescent shimmer rides the edge; a tight ember bloom haloes it
// on a clean dark field. No particles, no lines — just the orb. Driven entirely by
// the uniforms below (state + audio amplitude eased on the Dart side).

// Uniforms are set by float index in declaration order (see jarvis_orb.dart):
//   0,1 uSize | 2 uTime | 3 uLevel | 4 uSpeed | 5 uEnter | 6 uHue
uniform vec2 uSize;    // canvas size in px
uniform float uTime;   // seconds
uniform float uLevel;  // 0..1 audio / intensity
uniform float uSpeed;  // motion speed (eased by state)
uniform float uEnter;  // 0..1 entrance
uniform float uHue;    // iridescence / thinking accent

out vec4 fragColor;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 frag = FlutterFragCoord().xy;
  vec2 uv = (frag - 0.5 * uSize) / uSize.y;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = uTime * uSpeed;
  float lvl = uLevel;

  // Domain-warped fluid — kept INSIDE the orb so the field stays clean.
  vec2 q = uv * 3.0;
  float w = fbm(q + vec2(t * 0.8, -t * 0.5));
  float flow = fbm(q * 1.4 + vec2(w, w) + vec2(0.0, t));

  // Contained radius with a gentle breath, audio swell, and a liquid wobble.
  float breathe = 0.5 + 0.5 * sin(uTime * 0.7);
  float R = (0.205 + 0.018 * breathe + 0.085 * lvl) * mix(0.25, 1.0, smoothstep(0.0, 1.0, uEnter));
  float Rw = R + 0.035 * (flow - 0.5);

  float edge = smoothstep(Rw + 0.012, Rw - 0.06, r);  // crisp-ish body, soft inner
  float halo = exp(-8.5 * max(0.0, r - Rw));           // tight bloom -> clean dark field

  float depth = clamp(1.0 - r / max(Rw, 0.001), 0.0, 1.0); // 0 rim .. 1 centre
  float surf = 0.55 + 0.9 * (flow - 0.5);                   // liquid brightness

  // Molten palette.
  vec3 deep = vec3(0.38, 0.05, 0.04);
  vec3 emb  = vec3(0.97, 0.38, 0.12);
  vec3 gold = vec3(1.00, 0.72, 0.32);
  vec3 hotW = vec3(1.00, 0.95, 0.86);

  vec3 col = mix(deep, emb, smoothstep(0.05, 0.75, depth * surf + 0.25));
  col = mix(col, gold, smoothstep(0.5, 0.9, depth));
  col = mix(col, hotW, smoothstep(0.88, 1.0, depth) * 0.7); // small hot heart

  // Iridescent flowing rim — a cool shimmer riding the liquid edge.
  float rim = smoothstep(Rw - 0.07, Rw - 0.005, r) * smoothstep(Rw + 0.03, Rw - 0.01, r);
  vec3 iri = mix(vec3(0.30, 0.55, 1.0), vec3(0.85, 0.35, 0.95),
                 0.5 + 0.5 * sin(ang * 3.0 + flow * 5.0 + uTime * 0.6 + uHue));
  col += iri * rim * (0.40 + 0.25 * lvl);

  // Fluid contained inside the body; tight ember bloom outside.
  vec3 outCol = col * edge + emb * halo * (0.28 + 0.65 * lvl);
  outCol *= (0.92 + 0.40 * lvl);

  fragColor = vec4(outCol, 1.0);
}
