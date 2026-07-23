import PageShell from "@/components/PageShell";
import Faq from "@/components/Faq";

export const metadata = {
  title: "FAQ — mAutomate, the AI-powered commerce platform",
  description:
    "Answers about mAutomate: how the AI builds and runs your store, what AI actions cost, who owns your data, and how the 7-day free trial works.",
};

export default function FaqPage() {
  return (
    <PageShell>
      {/* The Faq component renders its own eyebrow + heading, so it serves as
          the page header — no PageHero needed. */}
      <Faq />

      <section className="shell pb-20 lg:pb-28">
        <div className="mx-auto max-w-4xl rounded-3xl bg-brand-soft px-6 py-12 text-center sm:px-12 lg:py-16">
          <span className="eyebrow justify-center">Still have questions?</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            We&apos;re here to help you launch.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            Talk to a real person about your brand, or jump straight in and let
            the AI build your store — free for 7 days, cancel any time before
            your trial ends.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/contact" className="btn-primary">
              Talk to us
            </a>
            <a href="/get-started" className="btn-ghost">
              Start free
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
