import { notFound } from "next/navigation";
import Link from "next/link";
import PageShell, { PageHero } from "@/components/PageShell";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { VERTICALS, getVertical } from "@/lib/verticals";
import { GET_STARTED_URL } from "@/lib/site";
import { CheckIcon, ArrowRight } from "@/components/icons";

export function generateStaticParams() {
  return VERTICALS.map((v) => ({ vertical: v.slug }));
}

export async function generateMetadata({ params }) {
  const { vertical: slug } = await params;
  const vertical = getVertical(slug);
  if (!vertical) return { title: "Solution not found — mAutomate" };
  return {
    title: vertical.metaTitle,
    description: vertical.metaDescription,
    alternates: { canonical: `/solutions/${vertical.slug}` },
  };
}

// The "why mAutomate" comparison — same framing for every vertical, since the
// contrast (piecing tools together vs. one AI team) is what the whole product
// argues, but the audience label is filled in per page.
function comparisonRows() {
  return [
    {
      before: "A page builder, an email tool, a chatbot, and a payment plugin that never quite talk to each other",
      after: "One AI that builds the store, markets it, supports customers, and handles payments from a single dashboard",
    },
    {
      before: "Hours writing product copy, sales pages, and posts before anything can go live",
      after: "The AI drafts your pages, listings, emails, and posts — you review and approve",
    },
    {
      before: "Customer questions wait until you're back at your desk",
      after: "AI support answers on chat and email around the clock, in your brand voice",
    },
    {
      before: "A subdomain or marketplace profile you don't really own",
      after: "Your own custom domain, your brand, your customer relationships",
    },
  ];
}

export default async function VerticalPage({ params }) {
  const { vertical: slug } = await params;
  const vertical = getVertical(slug);
  if (!vertical) notFound();

  const rows = comparisonRows();

  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Solutions", path: "/solutions" },
            { name: vertical.audience, path: `/solutions/${vertical.slug}` },
          ]),
          faqSchema(vertical.faq),
        ]}
      />

      <PageHero
        eyebrow={`For ${vertical.audience}`}
        title={vertical.h1}
        subtitle={vertical.intro}
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={GET_STARTED_URL} className="btn-primary">
            Start your 14-day free trial
            <ArrowRight className="h-4 w-4" />
          </a>
          <Link href="/solutions" className="btn-ghost">
            See all solutions
          </Link>
        </div>
      </PageHero>

      {/* Pain points — the reason this audience is here. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Sound familiar?</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            What&apos;s getting in the way today.
          </h2>
          <ul className="mt-8 space-y-4">
            {vertical.painPoints.map((point) => (
              <li key={point} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                />
                <p className="text-lg leading-relaxed text-muted">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Benefits grid. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow justify-center">How mAutomate helps</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            An AI team built around your workflow.
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
          {vertical.benefits.map((benefit) => (
            <div key={benefit.title} className="card-base">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-accent-green">
                <CheckIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-ink">
                {benefit.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted">
                {benefit.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why mAutomate — before/after comparison. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow justify-center">Why mAutomate</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              Stop wiring tools together. Hire the team.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface-alt p-6 sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                On your own
              </h3>
              <ul className="mt-6 space-y-4">
                {rows.map((row) => (
                  <li key={row.before} className="text-base leading-relaxed text-muted">
                    {row.before}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-brand/30 bg-brand-soft p-6 shadow-card sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">
                With mAutomate
              </h3>
              <ul className="mt-6 space-y-4">
                {rows.map((row) => (
                  <li key={row.after} className="flex gap-3 text-base leading-relaxed text-ink">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {row.after}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Questions</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            {vertical.audience}, answered.
          </h2>
          <dl className="mt-8 divide-y divide-line border-t border-line">
            {vertical.faq.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="text-lg font-semibold text-ink">{item.q}</dt>
                <dd className="mt-3 text-base leading-relaxed text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA band. */}
      <section className="shell pb-20 lg:pb-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center text-brand-light">
              Built for {vertical.audience.toLowerCase()}
            </span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-white">
              Let the AI run the store. You do the work you love.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Build your storefront, launch your marketing, and answer every
              customer — free for 14 days, cancel any time before your trial
              ends.
            </p>
            <div className="mt-9 flex justify-center">
              <a href={GET_STARTED_URL} className="btn-primary">
                Start your store
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
