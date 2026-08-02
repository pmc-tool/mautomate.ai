import Link from "next/link";
import PageShell, { PageHero } from "@/components/PageShell";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { GET_STARTED_URL } from "@/lib/site";
import { ArrowRight, SparkIcon } from "@/components/icons";

export const metadata = {
  title: "Free tools for online store owners | mAutomate",
  description:
    "Free tools to help you start and grow an online store — brandable store name ideas, with more on the way. No sign-up required.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    href: "/tools/store-name-generator",
    name: "Store Name Generator",
    body: "Enter your niche and get 20+ brandable store-name ideas in seconds, each with a matching domain you can claim. Free, no sign-up.",
    available: true,
  },
  {
    href: null,
    name: "Product Description Generator",
    body: "Turn a product name and a few details into a polished, SEO-friendly product description. Coming soon.",
    available: false,
  },
];

export default function ToolsPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Free tools", path: "/tools" },
        ])}
      />

      <PageHero
        eyebrow="Free tools"
        title="Free tools for store owners"
        subtitle="Small, useful tools to help you start and grow an online store — free, no sign-up. When you're ready to build the whole thing, the AI takes it from here."
      />

      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {TOOLS.map((tool) =>
            tool.available ? (
              <Link
                key={tool.name}
                href={tool.href}
                className="card-base group flex flex-col hover:border-brand/40 hover:shadow-card"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <SparkIcon className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-ink">
                  {tool.name}
                </h2>
                <p className="mt-2 flex-1 text-base leading-relaxed text-muted">
                  {tool.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors group-hover:text-brand-dark">
                  Open tool
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ) : (
              <div
                key={tool.name}
                className="card-base flex flex-col opacity-70"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-alt text-muted">
                  <SparkIcon className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-ink">
                  {tool.name}
                </h2>
                <p className="mt-2 flex-1 text-base leading-relaxed text-muted">
                  {tool.body}
                </p>
                <span className="mt-6 inline-flex w-fit items-center rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Coming soon
                </span>
              </div>
            )
          )}
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        <div className="rounded-3xl bg-brand-soft px-6 py-14 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center">Beyond the tools</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              Let the AI build and run the whole store.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              These tools are a taste. mAutomate builds your storefront, writes
              your pages, markets it, and answers customers — free for 14 days.
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
