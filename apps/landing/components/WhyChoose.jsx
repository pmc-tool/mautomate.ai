import AnimatedSection from "./AnimatedSection";
import { SparkleIcon } from "./icons";

// Three benefit columns, each with its own accent colour for the spark bullets.
const COLUMNS = [
  {
    title: "Get to market faster",
    color: "text-brand",
    items: [
      "Launch a no-code store in minutes",
      "Generate product pages and copy with AI",
      "Build pages from composable, reusable blocks",
    ],
  },
  {
    title: "Sell on every channel",
    color: "text-accent-green",
    items: [
      "Publish your products anywhere your customers are",
      "Run marketing campaigns on full autopilot",
      "Answer every customer 24/7 with AI support",
    ],
  },
  {
    title: "Free your team",
    color: "text-ink",
    items: [
      "Easy for your whole team to adopt and scale",
      "Simple, elegant workflows that stay out of the way",
      "Every tool connected so everything just works together",
    ],
  },
];

export default function WhyChoose() {
  return (
    <section id="why" className="w-full scroll-mt-16 pt-16">
      {/* header */}
      <AnimatedSection className="mx-auto max-w-4xl text-center">
        <h2 className="mt-4 text-[28px]/[36px] xl:text-[48px]/[56px] tracking-[-0.02em] xl:tracking-[-0.028em] font-semibold text-ink">
          Why teams choose mAutomate
        </h2>
        <p className="mt-4 text-base text-muted sm:text-lg">
          The all-in-one platform that works{" "}
          <span className="font-semibold text-ink">
            for your store, marketing, and support
          </span>{" "}
          without any tradeoffs.
        </p>
      </AnimatedSection>

      {/* benefit columns */}
      <div className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-10">
        {COLUMNS.map((col, i) => (
          <AnimatedSection key={col.title} delay={i * 100}>
            <h3 className="text-xl font-bold text-ink text-left">
              {col.title}
            </h3>
            <ul className="mt-5 space-y-3.5">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <SparkleIcon className={`mt-1 h-4 w-4 flex-none ${col.color}`} />
                  <span className="text-[15px] leading-relaxed text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
