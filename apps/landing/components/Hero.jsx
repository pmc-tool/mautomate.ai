import Image from "next/image";
import AnimatedSection from "./AnimatedSection";
import HeroBento from "./HeroBento";
// import HeroRays from "./HeroRays";
import LogoCloud from "./LogoCloud";
import WhyChoose from "./WhyChoose";
import { ArrowRight } from "./icons";

const AVATARS = [
  "/assets/avatar-1.jpg",
  "/assets/avatar-2.jpg",
  "/assets/avatar-3.jpg",
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-surface-alt">
      {/* <HeroRays /> */}
      <HeroStripe />
      <div className="shell relative z-10 flex flex-col items-center pt-28 pb-20 text-center lg:pt-32 lg:pb-28">
        <AnimatedSection className="flex flex-col items-center">
          {/* reviews pill */}
          <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white pe-3 ps-1 py-1">
            <div className="flex -space-x-2.5">
              {AVATARS.map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-ink">
              2.4k+ <span className="font-medium text-muted">Reviews</span>
            </span>
            <span className="h-4 w-px bg-line" />
            <span className="text-sm font-semibold text-ink">5.0</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} />
              ))}
            </div>
          </div>

          {/* heading — decorative shapes woven between the words (sized in em
              so they scale with the responsive type) */}
          {/* <h1 className="mt-8 max-w-5xl text-balance text-[2.25rem] font-semibold leading-[1.05] text-ink tracking-tighter sm:text-[3rem] lg:text-[3.75rem]">
            Your store <PieShape /> run by AI <ArrowPill /> it builds, sells{" "}
            <RingShape /> and supports.
          </h1> */}
          <h1 className="mt-8 max-w-5xl text-balance text-[2.25rem] font-semibold leading-[1.05] text-ink tracking-tighter sm:text-[3rem] lg:text-[3.75rem]">
            Your store, run by AI — it builds, sells, and supports.
          </h1>

          {/* subtext */}
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            Close more deals with mAutomate&apos;s automated lead scoring,
            AI-powered outreach, and seamless CRM integration.
          </p>

          {/* CTA */}
          <div className="mt-9 flex flex-col items-center gap-3">
            {/* CTA button */}
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white shadow-float transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-ink-soft"
            >
              Start your 14-day free trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-xs font-medium text-muted">
              14 days free — cancel any time before your trial ends.
            </p>
          </div>
        </AnimatedSection>

        {/* bento showcase */}
        <AnimatedSection delay={160} className="mt-16 w-full">
          <HeroBento />
        </AnimatedSection>

        {/* trusted-by logo cloud */}
        <AnimatedSection delay={200} className="mt-16 w-full">
          <LogoCloud />
        </AnimatedSection>

        {/* why choose — sits under the trusted-by logos, within the hero */}
        <WhyChoose />
      </div>
    </section>
  );
}

function Star() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="#F15A29"
      aria-hidden="true"
    >
      <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6Z" />
    </svg>
  );
}

// Decorative "Stripe" background: two side bands of vertical light-gradient
// columns, each band masked so the stripes fade toward the centre, plus a
// vertical mask so the whole set fades out toward the bottom of the hero.
const STRIPE_BG =
  "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)";

function StripeColumns() {
  return Array.from({ length: 8 }).map((_, i) => (
    <span
      key={i}
      className="h-full min-w-17.5 max-w-20.5 flex-1"
      style={{ background: STRIPE_BG }}
    />
  ));
}

function HeroStripe() {
  return (
    <>
      {/* tiled noise/paper texture, overlay-blended and fading in from the top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 mix-blend-overlay mask-[linear-gradient(0deg,transparent_0%,black_100%)]"
        style={{
          backgroundImage: "url(/assets/6mcf62RlDfRfU61Yg5vb2pefpi4.avif)",
          backgroundRepeat: "repeat",
          backgroundPosition: "left top",
          backgroundSize: "128px auto",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex items-stretch justify-between mask-[linear-gradient(0deg,transparent_0%,black_100%)]"
      >
        {/* left band — fades toward the centre */}
        <div className="flex h-full w-[35%] overflow-hidden mask-[linear-gradient(270deg,transparent_0%,black_100%)]">
          <StripeColumns />
        </div>
        {/* right band — mirrored */}
        <div className="flex h-full w-[35%] justify-end overflow-hidden mask-[linear-gradient(90deg,transparent_0%,black_100%)]">
          <StripeColumns />
        </div>
      </div>
    </>
  );
}

/* ---- Inline heading decorations (em-scaled, purely decorative) ---- */

// Two-tone pie: brand orange + ink split down the middle.
function PieShape() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-block h-[0.72em] w-[0.72em] translate-y-[0.02em] rounded-full align-middle"
      style={{ background: "conic-gradient(#F15A29 0 50%, #141414 50% 100%)" }}
    />
  );
}

// Brand pill with a white arrow.
function ArrowPill() {
  return (
    <span
      aria-hidden="true"
      className="mx-1.5 inline-flex h-[0.7em] w-[1.7em] translate-y-[0.02em] items-center justify-center rounded-full bg-brand align-middle"
    >
      <ArrowRight className="h-[0.44em] w-[0.44em] text-white" />
    </span>
  );
}

// Target ring: ink outline with a green centre dot.
function RingShape() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-flex h-[0.78em] w-[0.78em] translate-y-[0.02em] items-center justify-center rounded-full border-[0.1em] border-ink align-middle"
    >
      <span className="h-[0.26em] w-[0.26em] rounded-full bg-accent-green" />
    </span>
  );
}
