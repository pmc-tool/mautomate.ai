import PageShell, { PageHero } from "@/components/PageShell";
import StoreNameGenerator from "@/components/StoreNameGenerator";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { GET_STARTED_URL } from "@/lib/site";
import { ArrowRight } from "@/components/icons";

export const metadata = {
  title: "Free AI Store Name Generator | mAutomate",
  description:
    "Generate a brandable online store name in seconds. Enter your niche, get 20+ name ideas, check the matching domain, and build the store for free with AI.",
  alternates: { canonical: "/tools/store-name-generator" },
};

const FAQ = [
  {
    q: "Is the store name generator free?",
    a: "Yes, completely free with no sign-up. Enter a keyword, generate as many batches of names as you like, and copy any you love. You only create an account when you're ready to build the store.",
  },
  {
    q: "How do I choose the right name for my store?",
    a: "Pick a name that's short, easy to spell, and easy to say out loud. Make sure the matching domain is available, check it isn't trademarked in your category, and say it aloud to a few people before you commit.",
  },
  {
    q: "Can I get the domain for a name I like?",
    a: "Every idea shows a matching yourname.mautomate.ai address you can claim instantly, and mAutomate can connect a custom domain like yourname.com when you build your store.",
  },
  {
    q: "What makes a good online store name?",
    a: "A good store name is memorable, hints at what you sell, works as a domain and social handle, and leaves room to grow. Avoid hard-to-spell words, numbers, and hyphens that people forget.",
  },
  {
    q: "Can mAutomate build the store once I pick a name?",
    a: "Yes. Choose a name, start your free 14-day trial, and the AI builds your storefront, writes your product pages, sets up payments, and markets it — all from a conversation.",
  },
];

// WebApplication schema for this free tool — declares it as a free web app so
// AI engines and rich results can surface it directly.
const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Free Store Name Generator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const TIPS = [
  {
    title: "Keep it short and speakable",
    body: "The best store names are one or two words you can say once and someone can spell. Short names fit logos, handles, and word-of-mouth better than clever long ones.",
  },
  {
    title: "Hint at what you sell",
    body: "A name that nods to your product or feeling — cozy, fresh, handmade — helps shoppers and search engines understand your store before they read a word of copy.",
  },
  {
    title: "Check the domain and handles",
    body: "Before you fall in love, confirm the domain is free and the social handles are open. A consistent name across your site and channels is worth more than the perfect word.",
  },
  {
    title: "Leave room to grow",
    body: "Avoid boxing yourself in with one product in the name. \"Bean\" beats \"OnlyDarkRoast\" if you might sell more than one thing next year.",
  },
];

export default function StoreNameGeneratorPage() {
  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Free tools", path: "/tools" },
            {
              name: "Store name generator",
              path: "/tools/store-name-generator",
            },
          ]),
          faqSchema(FAQ),
          webAppSchema,
        ]}
      />

      <PageHero
        eyebrow="Free tool"
        title="Free AI store name generator"
        subtitle="Enter your niche and get 20+ brandable store-name ideas in seconds — each with a matching domain you can claim. Free, no sign-up, and when you find the one, the AI builds the whole store around it."
      />

      {/* The interactive generator. */}
      <StoreNameGenerator />

      {/* SEO content — answer-first. */}
      <section className="shell pt-12 pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-h2 font-semibold tracking-[-0.02em] text-ink">
            How to come up with an online store name
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            To come up with an online store name, start with one or two words
            that describe what you sell or how it makes people feel, then combine
            them with a prefix or suffix like Studio, Co, House, or Supply until
            something sticks. The generator above does exactly this instantly —
            enter your niche and it returns 20+ brandable combinations, each with
            a domain you can claim on the spot.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            The name you pick will live on your storefront, your domain, your
            social handles, and every order confirmation your customers receive,
            so it&apos;s worth a few minutes to get right. Use these tips to
            narrow a shortlist down to the one.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {TIPS.map((tip) => (
              <div key={tip.title} className="card-base">
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink">
                  {tip.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-muted">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ. */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Questions</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            Store name generator FAQ
          </h2>
          <dl className="mt-8 divide-y divide-line border-t border-line">
            {FAQ.map((item) => (
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
        <div className="rounded-3xl bg-brand-soft px-6 py-14 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center">Got your name?</span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
              Let the AI build the store behind it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              Claim your name and the AI builds your storefront, writes your
              product pages, sets up payments, and markets it — free for 14 days.
            </p>
            <div className="mt-8 flex justify-center">
              <a href={GET_STARTED_URL} className="btn-primary">
                Build my store free
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
