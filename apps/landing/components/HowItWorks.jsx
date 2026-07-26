import AnimatedSection from "./AnimatedSection";
import { ArrowRight, ChatBubbleIcon, BotIcon, CheckIcon } from "./icons";

// Step columns. Each card carries a "Step 0X" pill, a glyph, and body copy;
// solid connector arrows hop up (1 → 2) and down (2 → 3) between the cards.
const STEPS = [
  {
    label: "Step 01",
    title: "Tell it your brand",
    body: "Your products, your voice, who you sell to. A conversation, not a setup wizard.",
    Icon: ChatBubbleIcon,
  },
  {
    label: "Step 02",
    title: "AI builds and launches",
    body: "Storefront, domain, business email, and your first campaigns — live the same day.",
    Icon: BotIcon,
  },
  {
    label: "Step 03",
    title: "You approve, it grows",
    body: "Everything the AI does lands in your review queue. Approve once and it learns your taste.",
    Icon: CheckIcon,
  },
];

// Connector that rises left → right, for the hop between steps 1 → 2.
function ArrowHop({ className = "" }) {
  return (
    <svg viewBox="0 0 164 50" fill="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M153.253 30.662c-.623 1.252-2.24 2.567-3.611 2.936l-22.351 6.025c-1.371.37-1.978-.345-1.355-1.597s2.24-2.566 3.611-2.936l19.867-5.355 9.024-18.133c.623-1.252 2.24-2.566 3.611-2.936 1.372-.37 1.979.346 1.356 1.597l-10.152 20.4zM.379 47.356C35.467 18.83 64.89 3.39 90.084.75c24.96-2.615 45.322 7.394 63.239 28.506l-5.107 4.152C130.407 12.423 110.527 2.982 86.939 5.454 63.584 7.9 36.156 22.087 2.296 49.614L.379 47.356z"
      />
    </svg>
  );
}

// Connector that dips down left → right, for the hop between steps 2 → 3.
function ArrowDip({ className = "" }) {
  return (
    <svg viewBox="0 0 167 43" fill="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M153.942 6.057c-.769-1.174-2.533-2.3-3.939-2.514L127.086.054c-1.406-.214-1.922.564-1.153 1.739.769 1.174 2.533 2.3 3.939 2.513l20.371 3.102 11.143 17.008c.769 1.174 2.533 2.3 3.939 2.514 1.406.214 1.923-.564 1.153-1.738L153.942 6.057zM.148 6.553c38.273 24.423 69.347 36.476 94.678 36.284 25.097-.19 44.108-12.41 59.356-35.39l-5.571-3.555c-15.155 22.84-33.757 34.444-57.474 34.623-23.483.178-52.424-10.852-89.357-34.42L.148 6.552z"
      />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-surface-alt py-16 lg:py-24">
      <div className="shell">
        {/* header */}
        <AnimatedSection>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Simple &amp; streamlined
            </span>
            <h2 className="mt-4 text-[28px]/[36px] xl:text-[48px]/[56px] tracking-[-0.02em] xl:tracking-[-0.028em] font-semibold text-ink">
              Launch day is day one.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-muted lg:pb-2">
            Getting started is simple. Tell us about your brand and your AI store
            goes live — often the same day.
          </p>
        </div>
      </AnimatedSection>

      {/* step columns */}
      <AnimatedSection delay={120}>
        <div className="relative mt-20 grid grid-cols-1 items-stretch gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-0">
          {/* connectors — desktop only: hop up over the gap 1→2, dip below 2→3 */}
          <ArrowHop className="pointer-events-none absolute left-[27%] -top-4 hidden w-44 -translate-x-1/2 text-[#d9d9d9] sm:block" />
          <ArrowDip className="pointer-events-none absolute left-[64%] top-full hidden w-44 -translate-x-1/2 translate-y-1 text-[#d9d9d9] sm:block" />

          {STEPS.map((step) => (
            <div key={step.title} className="relative flex flex-col">
              {/* step pill */}
              <span className="inline-flex w-fit items-center text-xs font-semibold tracking-wide text-ink uppercase">
                {step.label}
              </span>

              {/* card */}
              <div className="mt-3 flex-1 rounded-2xl bg-surface p-6 transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-card sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold leading-tight text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-alt text-ink">
                    <step.Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* closing CTA */}
      <AnimatedSection delay={200}>
        <div className="mt-24 flex flex-col items-center justify-center gap-5 text-center sm:flex-row sm:gap-8">
          <p className="text-xl font-bold text-ink sm:text-2xl">
            Lock founding pricing for life — early access is open now.
          </p>
          <a
            href="#pricing"
            className="inline-flex flex-none items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-ink-soft"
          >
            Claim founding access
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
