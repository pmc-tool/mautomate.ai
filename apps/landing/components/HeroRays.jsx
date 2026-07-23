// Decorative background: thin brand-tinted rays fanning out from a central
// hub, with a soft light glow behind them. Purely ornamental (aria-hidden).

const CENTER = { x: 500, y: 340 };
const RAY_COUNT = 72;

// Rays fan out to an ellipse wider than it is tall, so they spread mostly
// sideways like the reference. Endpoints overshoot the viewBox; the radial
// mask fades them near the centre and the outer edges.
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const angle = (i / RAY_COUNT) * Math.PI * 2;
  return {
    x2: +(CENTER.x + Math.cos(angle) * 760).toFixed(1),
    y2: +(CENTER.y + Math.sin(angle) * 500).toFixed(1),
  };
});

const RAY_MASK =
  "radial-gradient(circle at 50% 50%, transparent 3%, black 20%, black 46%, transparent 76%)";

export default function HeroRays() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* soft light glow */}
      <div className="absolute left-1/2 top-[42%] h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(241,90,41,0.10),transparent)]" />

      {/* radiating lines */}
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        className="absolute left-1/2 top-[42%] h-[860px] w-[1440px] -translate-x-1/2 -translate-y-1/2"
        style={{ maskImage: RAY_MASK, WebkitMaskImage: RAY_MASK }}
      >
        <g stroke="#F15A29" strokeWidth="1" strokeOpacity="0.18">
          {RAYS.map((r, i) => (
            <line
              key={i}
              x1={CENTER.x}
              y1={CENTER.y}
              x2={r.x2}
              y2={r.y2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
