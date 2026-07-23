import AnimatedSection from "./AnimatedSection";
import { ArrowRight } from "./icons";

// Ascending step columns. OFFSET pushes each column's content down on desktop
// so they climb left → right (equal-height columns keep the dividers full-height).
const STEPS = [
  {
    title: "Tell it your brand",
    body: "Your products, your voice, who you sell to. A conversation, not a setup wizard.",
  },
  {
    title: "AI builds and launches",
    body: "Storefront, domain, business email, and your first campaigns — live the same day.",
  },
  {
    title: "You approve, it grows",
    body: "Everything the AI does lands in your review queue. Approve once and it learns your taste.",
  },
];

const OFFSET = ["sm:pt-24", "sm:pt-12", "sm:pt-0"];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-[#fdf9f8] py-16 lg:py-24">
      <div className="shell">
        {/* header */}
        <AnimatedSection>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Simple &amp; streamlined
            </span>
            <h2 className="mt-4 text-display font-bold text-ink">
              Launch day is day one.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-muted lg:pb-2">
            Getting started is simple. Tell us about your brand and your AI store
            goes live — often the same day.
          </p>
        </div>
      </AnimatedSection>

      {/* ascending step columns */}
      <AnimatedSection delay={120}>
        <div className="mt-16 grid grid-cols-1 gap-y-8 sm:grid-cols-3 sm:gap-y-0">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className={`${OFFSET[i]} border-line border-t first:border-t-0 sm:border-t-0 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-2xl font-bold leading-tight text-ink">
                  {step.title}
                </h3>
                <span className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand/15 text-brand">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* closing CTA */}
      <AnimatedSection delay={200}>
        <div className="mt-16 flex flex-col items-center justify-center gap-5 text-center sm:flex-row sm:gap-8">
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
