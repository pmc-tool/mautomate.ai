import Link from "next/link";
import PageShell, { PageHero } from "@/components/PageShell";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { VERTICALS } from "@/lib/verticals";
import { GET_STARTED_URL } from "@/lib/site";
import { ArrowRight } from "@/components/icons";

export const metadata = {
  title: "Solutions by business — mAutomate AI store builder",
  description:
    "See how mAutomate's AI store builder, marketing, and support work for your business — coaches, artists, print-on-demand, digital products, handmade, and subscription boxes.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Solutions", path: "/solutions" },
        ])}
      />

      <PageHero
        eyebrow="Solutions"
        title="Built for how you actually sell"
        subtitle="mAutomate is one AI team — store builder, marketing, and support — but the work looks different for every business. Pick yours to see how the AI runs a store shaped around your products and your day."
      />

      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          {VERTICALS.map((vertical) => (
            <Link
              key={vertical.slug}
              href={`/solutions/${vertical.slug}`}
              className="card-base group flex flex-col hover:border-brand/40 hover:shadow-card"
            >
              <span className="eyebrow">For {vertical.audience}</span>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-ink">
                {vertical.h1}
              </h2>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted">
                {vertical.metaDescription}
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors group-hover:text-brand-dark">
                Explore this solution
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        <div className="rounded-3xl bg-brand-soft px-6 py-14 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center">Don&apos;t see yours?</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              If you sell it, the AI can run it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              mAutomate builds and runs a store around whatever you sell. Start
              free for 14 days and see it work for your business.
            </p>
            <div className="mt-8 flex justify-center">
              <a href={GET_STARTED_URL} className="btn-primary">
                Start your 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
