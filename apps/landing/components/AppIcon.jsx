// 3D-style "mAutomate" app icon: a frosted, rounded-square tile holding a dark
// "m" and an orange shopping bag with a white upward arrow — a vector rendition
// of the attached app-icon asset. Swap in /assets/mautomate-icon.png if a
// pixel-exact raster is preferred (see public/assets/README.md).
export default function AppIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="mAutomate app icon"
    >
      <defs>
        <linearGradient id="tile" x1="12" y1="8" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EFEFEF" />
        </linearGradient>
        <linearGradient id="bag3d" x1="58" y1="40" x2="100" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#EE4E1E" />
        </linearGradient>
        <filter id="tileShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#141414" floodOpacity="0.14" />
        </filter>
      </defs>

      {/* frosted tile */}
      <rect
        x="8"
        y="8"
        width="104"
        height="104"
        rx="30"
        fill="url(#tile)"
        stroke="#FFFFFF"
        strokeWidth="2"
        filter="url(#tileShadow)"
      />
      <rect x="8" y="8" width="104" height="104" rx="30" fill="#ffffff" opacity="0.25" />

      {/* dark m */}
      <path
        d="M24 78V52c0-1 .8-1.8 1.8-1.8h1.2c1 0 1.8.8 1.8 1.8v1.4c1.4-2 3.4-3.2 5.8-3.2 2.6 0 4.6 1.2 5.7 3.4 1.5-2.2 3.7-3.4 6.5-3.4 4.5 0 7.2 2.9 7.2 7.8V78c0 1-.8 1.8-1.8 1.8h-1.2c-1 0-1.8-.8-1.8-1.8V59.4c0-2.6-1.3-4-3.5-4s-3.7 1.6-3.7 4.2V78c0 1-.8 1.8-1.8 1.8h-1.2c-1 0-1.8-.8-1.8-1.8V59.4c0-2.6-1.3-4-3.5-4s-3.7 1.6-3.7 4.3V78c0 1-.8 1.8-1.8 1.8h-1.2c-1 0-1.8-.8-1.8-1.8Z"
        fill="#1B1B1B"
      />

      {/* orange bag */}
      <path
        d="M64 60.5c0-1.4 1.1-2.5 2.5-2.5h27c1.4 0 2.5 1.1 2.5 2.5v26.5a5 5 0 0 1-5 5H69a5 5 0 0 1-5-5V60.5Z"
        fill="url(#bag3d)"
      />
      <path
        d="M72.5 58v-4.2a7.5 7.5 0 0 1 15 0V58"
        stroke="url(#bag3d)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* white upward arrow */}
      <path
        d="M74 80l10-10.5m0 0-6.5.2m6.5-.2.12 6.5"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
