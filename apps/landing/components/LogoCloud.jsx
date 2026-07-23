// Placeholder partner logos: a small glyph + wordmark, rendered in muted gray.
const LOGOS = [
  { name: "Epicurious", glyph: EpicuriousGlyph },
  { name: "Synthora", glyph: SynthoraGlyph },
  { name: "Nexivo", glyph: NexivoGlyph },
  { name: "Loopbit", glyph: LoopbitGlyph },
  { name: "Acme Corp", glyph: AcmeGlyph },
  { name: "Braina", glyph: BrainaGlyph },
];

export default function LogoCloud() {
  return (
    <div className="w-full text-center">
      <p className="text-sm font-medium text-muted">
        Trusted by 2,500+ businesses, globally
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
        {LOGOS.map(({ name, glyph: Glyph }) => (
          <div
            key={name}
            className="flex items-center gap-2 text-muted-light transition-colors duration-300 hover:text-ink"
          >
            <Glyph className="h-6 w-6 flex-none" />
            <span className="text-lg font-bold tracking-tight">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Simple geometric brand glyphs (inherit currentColor) ---- */

function EpicuriousGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M6 5h12M6 12h9M6 19h12"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SynthoraGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 2v20M4 7l16 10M20 7L4 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NexivoGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M8 16V8l8 8V8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoopbitGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="8.5" cy="12" r="5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="15.5" cy="12" r="5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function AcmeGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 3l9 16H3L12 3Z" />
    </svg>
  );
}

function BrainaGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 4l10 6-10 6V4Z"
        fill="currentColor"
      />
      <path d="M17 14v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
