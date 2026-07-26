"use client";

import { useCallback, useRef } from "react";
import AnimatedSection from "./AnimatedSection";
import { ArrowRight } from "./icons";

// Reliability / infrastructure proof-points, shown as a horizontally
// scrollable carousel. Each card pairs a headline stat with a small
// bespoke SVG visual (see the *Visual components below) so nothing
// depends on external image assets.
const CARDS = [
  {
    title: "Google Cloud servers.",
    body: "Fast, reliable hosting on Google's cloud infrastructure.",
    Visual: CloudVisual,
  },
  {
    title: "Your own domain.",
    body: "Buy a new domain, connect one you already own, or transfer one in — managed in one place.",
    Visual: DomainVisual,
  },
  {
    title: "90+ PageSpeed score.",
    body: "Automatic high-performance and Core Web Vitals compliance.",
    Visual: PageSpeedVisual,
  },
  {
    title: "99.99% Uptime.",
    body: "Experience virtually no downtime for your website.",
    Visual: UptimeVisual,
  },
  {
    title: "Bot & DDoS protection.",
    body: "24/7 protection against malicious attacks.",
    Visual: ShieldVisual,
  },
  {
    title: "Automated backups.",
    body: "Restore your site anytime from automatic daily backups.",
    Visual: BackupVisual,
  },
  {
    title: "Cloudflare Enterprise.",
    body: "Advanced CDN, security, and SSL with Cloudflare.",
    Visual: CloudflareVisual,
  },
  {
    title: "24/7 Support.",
    body: "Get help anytime with live chat support.",
    Visual: SupportVisual,
  },
];

export default function Infrastructure() {
  const trackRef = useRef(null);

  // Scroll by roughly one card (measured from the first child) in either
  // direction. Falls back to a sensible default width if the ref is empty.
  const scrollByCard = useCallback((dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild;
    const step = card ? card.offsetWidth + 24 : 320;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <section
      id="infrastructure"
      className="scroll-mt-24 overflow-hidden pt-16 lg:pt-24"
    >
      <div className="shell">
        {/* header row: copy on the left, CTA on the right */}
        <AnimatedSection>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <span className="eyebrow">Built to scale</span>
              <h2 className="mt-4 text-[28px]/[36px] xl:text-[44px]/[52px] font-semibold tracking-[-0.02em] text-ink">
                Launch your store instantly,
                <br className="hidden sm:block" /> no technical hassles.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
                With mAutomate's AI ecommerce builder, launching your store is
                quick, secure, and requires zero technical knowledge.
              </p>
            </div>

            {/* <div className="flex items-center gap-3 lg:flex-col lg:items-end">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-ink-soft"
              >
                Launch your store
                <ArrowRight className="h-4 w-4" />
              </a>
            </div> */}
          </div>
        </AnimatedSection>
      </div>

      {/* carousel */}
      <AnimatedSection delay={120}>
        <div className="relative mt-12">
          {/* arrows */}
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollByCard(-1)}
            className="absolute -left-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition-all duration-300 ease-smooth hover:-translate-y-[calc(50%+2px)] hover:border-brand/40 hover:text-brand lg:flex"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollByCard(1)}
            className="absolute -right-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition-all duration-300 ease-smooth hover:-translate-y-[calc(50%+2px)] hover:border-brand/40 hover:text-brand lg:flex"
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          {/* scroll track — snap, with shell padding as edge gutters */}
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-6 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CARDS.map(({ title, body, Visual }) => (
              <article
                key={title}
                className="group flex w-[80vw] flex-none snap-start flex-col overflow-hidden rounded-3xl bg-surface-alt transition-shadow duration-300 ease-smooth hover:shadow-card sm:w-[340px]"
              >
                <div className="px-7 pt-7">
                  <h3 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {body}
                  </p>
                </div>
                {/* visual well */}
                <div className="mt-6 flex flex-1 items-center justify-center px-6 pb-8">
                  <Visual />
                </div>
              </article>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

/* ---------- Card visuals (self-contained SVG) ---------- */

function CloudVisual() {
  // Outlined Google-Cloud-style mark with a multi-colour stroke gradient.
  return (
    <svg
      viewBox="0 0 200 130"
      className="h-40 w-full"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gc-stroke" x1="0" y1="0" x2="200" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EA4335" />
          <stop offset="0.35" stopColor="#FBBC05" />
          <stop offset="0.7" stopColor="#34A853" />
          <stop offset="1" stopColor="#4285F4" />
        </linearGradient>
      </defs>
      <path
        d="M58 100a30 30 0 0 1-4-59.6A40 40 0 0 1 131 46a28 28 0 0 1 8 54H58Z"
        stroke="url(#gc-stroke)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DomainVisual() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="text-sm text-muted-light/70">soundscapes.io</span>
      <div className="flex w-full items-center gap-3 rounded-full bg-ink px-5 py-3.5 shadow-float">
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-white" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="text-[15px] font-medium text-white">yourdomain.com</span>
      </div>
      <span className="text-sm text-muted-light/70">studiovibes.org</span>
    </div>
  );
}

function PageSpeedVisual() {
  // Circular progress ring stopping at 90%.
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = 0.9;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 130 130" className="h-40 w-40 -rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#E4EFE7" strokeWidth="11" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="#2FB457"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="absolute text-4xl font-semibold text-accent-green">90</span>
    </div>
  );
}

function UptimeVisual() {
  // Black status panel with a run of "operational" ticks.
  return (
    <div className="w-full rounded-2xl bg-ink p-4 shadow-float">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/70">Oregon (US) DC</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-accent-green-light">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green-light" />
          Operational
        </span>
      </div>
      <div className="mt-3 flex h-9 items-end gap-[3px]">
        {Array.from({ length: 34 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-accent-green"
            style={{ height: `${70 + ((i * 37) % 30)}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/45">
        <span>90 days ago</span>
        <span>100.0% uptime</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function ShieldVisual() {
  return (
    <div className="relative flex h-40 w-full items-center justify-center">
      <svg viewBox="0 0 120 130" className="h-40" aria-hidden="true">
        <defs>
          <linearGradient id="shield-fill" x1="0" y1="0" x2="120" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F3F4F6" />
            <stop offset="0.5" stopColor="#C9CDD4" />
            <stop offset="1" stopColor="#9AA0AA" />
          </linearGradient>
        </defs>
        <path
          d="M60 6 18 22v40c0 30 20 50 42 62 22-12 42-32 42-62V22L60 6Z"
          fill="url(#shield-fill)"
          stroke="#B7BCC4"
          strokeWidth="1.5"
        />
      </svg>
      {/* secured badge */}
      <div className="absolute flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-float">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-green text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-ink">Website Secured</span>
      </div>
    </div>
  );
}

function BackupVisual() {
  // Miniature dashboard frame with a sidebar + restore-point rows.
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-line bg-white shadow-float">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" />
      </div>
      <div className="flex">
        <div className="w-1/3 space-y-2 border-r border-line p-3">
          {["Overview", "Domains", "Hosting", "Backups"].map((label, i) => (
            <div
              key={label}
              className={`h-2 rounded-full ${i === 3 ? "bg-brand w-full" : "bg-line w-4/5"}`}
            />
          ))}
        </div>
        <div className="flex-1 space-y-2.5 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-surface-alt px-2.5 py-2">
              <span className="h-1.5 w-1/2 rounded-full bg-muted-light/40" />
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-soft text-brand">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                  <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v3.5h3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CloudflareVisual() {
  // Tablet frame showing the Cloudflare wordmark + cloud mark.
  return (
    <div className="w-full rounded-[1.75rem] border-[6px] border-ink bg-white p-6 shadow-float">
      <div className="flex flex-col items-center gap-3 py-4">
        <svg viewBox="0 0 120 54" className="h-12" aria-hidden="true">
          {/* cloud mark */}
          <path
            fill="#F6821F"
            d="M92 34c1-3 .6-5.8-1-7.8-1.5-1.9-4-3-7-3.2l-30-.4a.6.6 0 0 1-.5-.3.6.6 0 0 1 0-.6.8.8 0 0 1 .6-.4l30.3-.4c3.6-.2 7.5-3 8.9-6.6l1.7-4.6a1 1 0 0 0 .1-.5A19.5 19.5 0 0 0 59.9 18a8.6 8.6 0 0 0-13.4 6 .7.7 0 0 1-.6.6c-6 .8-10 6-9.5 12a.6.6 0 0 0 .6.5h53.2a.8.8 0 0 0 .7-.5L92 34Z"
          />
          <path
            fill="#FBAD41"
            d="M99 22.5h-.9a.5.5 0 0 0-.4.3l-1.1 4c-1 3-.6 5.8 1 7.8 1.5 1.9 4 3 7 3.2l6.4.4a.6.6 0 0 1 .5.3.6.6 0 0 1 0 .6.8.8 0 0 1-.6.4l-6.6.4c-3.6.2-7.5 3-8.9 6.6l-.5 1.3c-.1.3 0 .5.3.5h22.9a.7.7 0 0 0 .7-.5 16 16 0 0 0-15.3-25.8Z"
          />
        </svg>
        <span className="text-lg font-bold tracking-[0.25em] text-ink">
          CLOUDFLARE
        </span>
      </div>
    </div>
  );
}

function SupportVisual() {
  // White heart-in-a-speech-bubble, cut out with an even-odd fill rule.
  return (
    <div className="flex h-40 w-full items-center justify-center">
      <svg viewBox="0 0 130 132" className="h-40 drop-shadow-[0_18px_30px_rgba(20,20,20,0.18)]" aria-hidden="true">
        <defs>
          <linearGradient id="cf-support" x1="10" y1="8" x2="120" y2="124" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DCDEE3" />
          </linearGradient>
        </defs>
        <path
          fill="url(#cf-support)"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M65 8a55 55 0 0 0-33 99l-8 20 26-9A55 55 0 1 0 65 8Zm0 33c6-9 22-6 22 7 0 9-9 16-22 26-13-10-22-17-22-26 0-13 16-16 22-7Z"
        />
      </svg>
    </div>
  );
}
