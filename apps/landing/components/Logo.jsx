// mAutomate wordmark: lowercase "m" + orange shopping-bag glyph + "Automate".
export default function Logo({ className = "", light = false }) {
  const wordColor = light ? "#FFFFFF" : "#141414";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className="text-2xl font-bold leading-none tracking-tight"
        style={{ color: wordColor }}
      >
        m
      </span>
      <BrandBag className="-mx-px h-7 w-6.5" />
      <span
        className="text-2xl font-bold leading-none tracking-tight"
        style={{ color: wordColor }}
      >
        Automate
      </span>
    </span>
  );
}

export function BrandBag({ className = "" }) {
  return (
    <svg
      viewBox="0 0 26 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bagGrad" x1="2" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#F14E23" />
        </linearGradient>
      </defs>
      <path
        d="M4 9.2C4 8.54 4.54 8 5.2 8h15.6C21.46 8 22 8.54 22 9.2v14.3c0 1.38-1.12 2.5-2.5 2.5H6.5A2.5 2.5 0 0 1 4 23.5V9.2Z"
        fill="url(#bagGrad)"
      />
      <path
        d="M8.5 9V6.5a4.5 4.5 0 0 1 9 0V9"
        stroke="url(#bagGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 20l4-4.2m0 0-2.6.1m2.6-.1.05 2.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
