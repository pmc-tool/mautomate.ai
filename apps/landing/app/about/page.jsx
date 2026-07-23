import PageShell, { PageHero } from "@/components/PageShell";
import {
  WebsiteIcon,
  MarketingIcon,
  SupportIcon,
  OperationsIcon,
  CheckIcon,
  ArrowRight,
} from "@/components/icons";

export const metadata = {
  title: "About mAutomate — merchants first, AI second",
  description:
    "Why we built mAutomate: software gave everyone a store, nobody got the staff. Meet the AI team that builds, markets, and answers — with you in charge.",
};

// The AI "roles" that make up the team you hire when you open a store.
const roles = [
  {
    icon: WebsiteIcon,
    title: "AI Storefront Studio",
    body: "Designs, builds, and edits your storefront from a conversation — themes, pages, product copy, and imagery, ready to sell.",
  },
  {
    icon: MarketingIcon,
    title: "AI Marketing Suite",
    body: "Writes and schedules your social posts, runs your ads and SEO, and sends the emails — so growth happens while you sleep.",
  },
  {
    icon: SupportIcon,
    title: "AI Customer Support",
    body: "Answers shoppers on chat, email, and voice around the clock, in your brand's voice, and escalates only when it should.",
  },
  {
    icon: OperationsIcon,
    title: "Business Operations",
    body: "Watches orders, inventory, and payments, flags what needs you, and handles the routine work so nothing slips.",
  },
];

// What we refuse to compromise on.
const principles = [
  {
    title: "You approve every action",
    body: "The AI proposes; you decide. Nothing ships, spends, or replies without your sign-off unless you turn autopilot on.",
  },
  {
    title: "Your data is yours",
    body: "Your customers, catalog, and content belong to you — always exportable, never sold, never someone else's training set.",
  },
  {
    title: "Pay for work, not seats",
    body: "You're charged for the work the AI does, not for how many logins you have. The team scales with your store.",
  },
  {
    title: "Merchants first",
    body: "Every feature earns its place by making a real merchant's day easier. The technology serves the shop, never the reverse.",
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="About"
        title="Merchants first, AI second"
        subtitle="Software gave everyone a store, but nobody got the staff. mAutomate is the AI team that builds your storefront, runs your marketing, and answers your customers — with you in charge."
      />

      {/* The problem */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">The problem we kept seeing</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            Opening a store got easy. Running one alone stayed impossible.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted">
            <p>
              Over the last decade, software solved the hard part of starting a
              business — or so it looked. Anyone can spin up a store in an
              afternoon. The templates are beautiful, the checkout works, the
              payments clear.
            </p>
            <p>
              Then the real work begins. The product descriptions that need
              writing. The social posts, every single day. The ad campaigns, the
              SEO, the abandoned-cart emails. The customer asking a question at
              midnight who buys only if someone answers.
            </p>
            <p>
              That work takes a team — a copywriter, a marketer, a support rep, an
              operator. Most founders can&apos;t hire even one of them, so it all
              lands on the same pair of hands. The tools multiplied. The team
              never showed up. That gap is the reason we exist.
            </p>
          </div>
        </div>
      </section>

      {/* What we built */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow justify-center">What we built</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            Not another tool. A team.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            mAutomate is an AI team that works your store the way real staff
            would — each role focused on the job it does best, all of it
            reporting to you.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.title} className="card-base flex gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink">
                    {role.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-muted">
                    {role.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Our principles */}
      <section className="shell pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Our principles</span>
          <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-ink">
            The rules the AI plays by.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Powerful automation is only worth having if you can trust it. These
            are the commitments that shape every decision we make.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
          {principles.map((principle) => (
            <div key={principle.title} className="card-base">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-accent-green">
                <CheckIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-ink">
                {principle.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted">
                {principle.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA band */}
      <section className="shell pb-20 lg:pb-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center shadow-card sm:px-12 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <span className="eyebrow justify-center text-brand-light">
              Your team is ready
            </span>
            <h2 className="mt-4 text-h2 font-semibold tracking-[-0.02em] text-white">
              Hire the AI team. Keep the last word.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Build your storefront, launch your marketing, and answer every
              customer — starting today, with you in charge of it all.
            </p>
            <div className="mt-9 flex justify-center">
              <a href="/get-started" className="btn-primary">
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
