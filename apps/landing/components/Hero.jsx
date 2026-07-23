import AnimatedSection from "./AnimatedSection";
import HeroBento from "./HeroBento";
// import HeroRays from "./HeroRays";
import LogoCloud from "./LogoCloud";
import WhyChoose from "./WhyChoose";
import { ArrowRight } from "./icons";
import { GET_STARTED_URL } from "@/lib/site";

const AVATARS = [
  "from-brand-light to-brand-dark",
  "from-accent-green-light to-accent-green",
  "from-ink-soft to-ink",
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-[#fdf9f8]">
      {/* <HeroRays /> */}
      <div className="shell relative z-10 flex flex-col items-center pt-16 pb-20 text-center lg:pt-24 lg:pb-28">
        <AnimatedSection className="flex flex-col items-center">
          {/* reviews pill */}
          <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-3 py-1.5">
            <div className="flex -space-x-2.5">
              {AVATARS.map((grad, i) => (
                <span
                  key={i}
                  className={`h-7 w-7 rounded-full bg-gradient-to-br ${grad} ring-2 ring-white`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-ink">
              2.4k+ <span className="font-medium text-muted">Reviews</span>
            </span>
            <span className="h-4 w-px bg-line" />
            <span className="text-sm font-semibold text-ink">5.0</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} />
              ))}
            </div>
          </div>

          {/* heading */}
          <h1 className="mt-8 max-w-5xl text-balance text-[2.75rem] font-semibold leading-[1.05] text-ink tracking-[-.05em] sm:text-[3.75rem] lg:text-[4.75rem]">
            Your store, run by AI — it builds, sells, and supports.
          </h1>

          {/* subtext */}
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            Close more deals with mAutomate&apos;s automated lead scoring,
            AI-powered outreach, and seamless CRM integration.
          </p>

          {/* CTA */}
          <div className="mt-9 flex flex-col items-center gap-3">
            <a
              href={GET_STARTED_URL}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white shadow-float transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-ink-soft"
            >
              Start your 7-day free trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-xs font-medium text-muted">
              7 days free — cancel any time before your trial ends.
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
