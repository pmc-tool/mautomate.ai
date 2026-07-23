import PageShell, { PageHero } from "@/components/PageShell";
import GetStarted from "@/components/GetStarted";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata = {
  title: "Get started — start your 7-day free trial | mAutomate",
  description:
    "Pick a plan and launch your AI-run store today. Every plan starts with a 7-day free trial — your plan begins automatically when the trial ends, cancel any time before then.",
};

// How the trial works — three plain-language steps.
const STEPS = [
  {
    title: "Pick a plan and start today",
    body: "Choose the pack that fits your store. Your 7 days of full access begin the moment you sign up — every feature, no limits.",
  },
  {
    title: "Build and sell, free for 7 days",
    body: "Let the AI build your storefront, run your marketing, and handle operations. Explore the whole suite while the trial runs.",
  },
  {
    title: "Keep going, or cancel",
    body: "We remind you before the trial ends. Do nothing and your plan starts automatically — or cancel before day 7 and you won't be charged.",
  },
];

// Reassurance points shown under the steps.
const TRUST = [
  {
    title: `${TRIAL_DAYS} days, full access`,
    body: "Every plan, every feature. Explore the entire suite before you commit.",
  },
  {
    title: "One clear price",
    body: "Pay for the work your store does — not per seat. Your plan and price are shown before you start.",
  },
  {
    title: "Cancel anytime",
    body: "No lock-in and no exit fees. Leave whenever it stops earning its keep.",
  },
  {
    title: "You approve every AI action",
    body: "The AI drafts and recommends. Nothing goes live until you say so.",
  },
];

export default function GetStartedPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Get started"
        title="Start your 7-day free trial"
        subtitle="Pick a plan and launch your store today. You get full access for 7 days — when the trial ends your plan begins automatically, and you can cancel any time before then."
      />

      {/* Pack picker + billing toggle. */}
      <GetStarted />

      {/* How the trial works. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">How the trial works</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            Free for 7 days. Then your store keeps running.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="card-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 text-base font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Reassurance strip. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => (
            <div key={item.title} className="card-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path
                    d="M20 6 9 17l-5-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final reassurance band. */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rounded-3xl bg-brand-soft px-6 py-14 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center">Questions first?</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              Talk to us before you start.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              Not sure which plan fits? Tell us about your store and we&apos;ll
              point you to the right one.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/contact" className="btn-ghost">
                Contact us
              </a>
              <a href="/pricing" className="btn-primary">
                Compare plans
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
