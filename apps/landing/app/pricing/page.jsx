import PageShell from "@/components/PageShell";
import Pricing from "@/components/Pricing";

export const metadata = {
  title: "Pricing — mAutomate plans from $29/month",
  description:
    "Simple pricing for an AI-run store: pay for work done, not seats. Every plan starts with a 7-day free trial — your plan begins automatically when the trial ends.",
};

// Short reassurance points shown as compact trust cards under the plans.
const TRUST = [
  {
    title: "7-day free trial",
    body: "Every plan, every feature. Explore the whole suite before your plan begins.",
  },
  {
    title: "Only pay after 7 days",
    body: "Build today for free. Your plan starts automatically when the trial ends — cancel before then and you won't be charged.",
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

export default function PricingPage() {
  return (
    <PageShell>
      {/* Main pricing content — self-contained billing toggle + plan cards. */}
      <Pricing />

      {/* Everything-included reassurance strip. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Included on every plan</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            No surprises, no seat charges.
          </h2>
          <p className="mt-4 text-base text-muted">
            You pay for the work your store does — not for who logs in.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Final CTA band. */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rounded-3xl bg-brand-soft px-6 py-14 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center">Ready when you are</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              Start free. Let the store run itself.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              Spin up your storefront, marketing, and AI operator in minutes —
              free for 7 days, cancel any time before your trial ends.
            </p>
            <div className="mt-8 flex justify-center">
              <a href="/get-started" className="btn-primary">
                Start your 7-day free trial
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
