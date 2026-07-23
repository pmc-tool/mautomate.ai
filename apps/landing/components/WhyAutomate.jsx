import AnimatedSection from "./AnimatedSection";
import {
  WebsiteIcon,
  MarketingIcon,
  SupportIcon,
  OperationsIcon,
} from "./icons";

const FEATURES = [
  {
    icon: WebsiteIcon,
    title: "Website Builder",
    lead: "Build professional websites without code.",
    body: "Create beautiful, responsive websites using an intuitive drag-and-drop builder. Connect your custom domain, customize every section, and launch your business in minutes.",
  },
  {
    icon: MarketingIcon,
    title: "Marketing Automation",
    lead: "Automate your marketing across every channel.",
    body: "Generate AI-powered content, schedule social posts, launch campaigns, and track performance—all from one dashboard.",
  },
  {
    icon: SupportIcon,
    title: "AI Customer Support",
    lead: "Support customers 24/7 with AI.",
    body: "Deliver instant responses through AI chat, WhatsApp, Messenger, and email. Resolve customer questions faster without increasing your support team.",
  },
  {
    icon: OperationsIcon,
    title: "Business Operations",
    lead: "Manage your business from one dashboard.",
    body: "Track products, inventory, orders, customers, sales, and performance in real time. Everything you need to operate and grow your business from a single dashboard.",
  },
];

export default function WhyAutomate() {
  return (
    <section id="platform" className="shell scroll-mt-24">
      <div className="rounded-3xl bg-surface-alt px-5 py-14 sm:px-10 lg:px-16 lg:py-20">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Why mAutomate</span>
          <h2 className="mt-4 text-h2 font-bold text-ink">Why mAutomate</h2>
          <p className="mt-4 text-base text-muted">
            From websites and marketing to customer support, inventory, sales, and
            analytics—everything runs from one intelligent platform.
          </p>
        </AnimatedSection>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <AnimatedSection
              key={feature.title}
              delay={i * 90}
              className="group card-base hover:-translate-y-1 hover:border-brand/30 hover:shadow-card-hover"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm font-semibold text-ink">{feature.lead}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
