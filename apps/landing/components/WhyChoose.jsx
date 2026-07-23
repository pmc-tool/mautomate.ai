import AnimatedSection from "./AnimatedSection";
import { SparkleIcon } from "./icons";

// Three benefit columns, each with its own accent colour for the spark bullets.
const COLUMNS = [
  {
    title: "Get to market faster",
    color: "text-brand",
    items: [
      "No-code store builder",
      "AI content in minutes",
      "Composable blocks",
    ],
  },
  {
    title: "Sell on every channel",
    color: "text-accent-green",
    items: ["Publish anywhere", "Automated marketing", "24/7 AI support"],
  },
  {
    title: "Free your team",
    color: "text-ink",
    items: [
      "Easy to adopt & scale",
      "Simple, elegant workflows",
      "Everything works together",
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
      <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-14">
        {COLUMNS.map((col, i) => (
          <AnimatedSection key={col.title} delay={i * 100}>
            <h3 className="text-xl font-bold text-ink text-left">
              {col.title}
            </h3>
            <ul className="mt-5 space-y-3.5">
              {col.items.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <SparkleIcon className={`h-4 w-4 flex-none ${col.color}`} />
                  <span className="text-[15px] text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
