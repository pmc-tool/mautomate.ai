import AnimatedSection from "./AnimatedSection";
import CountUp from "./CountUp";

const STAT = { value: "1.2M+", label: "Stores launched" };

const TESTIMONIALS = [
  {
    quote:
      "With mAutomate, everything felt really obvious and on other platforms I used, it was more complicated. I also love the CRM tool.",
    name: "Meredith May",
    role: "Color Wonder Balloon Co.",
    tall: true,
  },
  {
    quote:
      "It's almost like I've added a whole team of web developers and marketers, but I don't have to pay them.",
    name: "Pietro Pirani",
    role: "Pietro Pirani Photography",
  },
  {
    quote:
      "You could be someone who has no idea how to turn on a computer and you could easily use mAutomate to build your store.",
    name: "Jessica Dennis",
    role: "Little Cooks Club",
  },
  {
    quote:
      "mAutomate has been instrumental in legitimizing and showcasing my brand, significantly broadening my reach and impact.",
    name: "Chef Igor",
    role: "Private chef",
  },
];

export default function Testimonials() {
  const [featured, ...rest] = TESTIMONIALS;

  return (
    <section id="reviews" className="scroll-mt-24 bg-white">
      <div className="shell pb-20 lg:pb-28">
        {/* header */}
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-7 w-7 text-accent-green" />
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-muted">
            4.8 stars on Trustpilot
          </p>

          <p className="mt-10 text-6xl font-bold tracking-tight text-ink sm:text-7xl">
            <CountUp value={500000} suffix="+" />
          </p>
          <p className="mt-3 text-lg text-muted">Businesses run on mAutomate</p>
        </AnimatedSection>

        {/* bento grid */}
        <AnimatedSection
          delay={120}
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {/* featured (tall) testimonial */}
          <TestimonialCard {...featured} className="lg:row-span-2" />

          {/* stat tile */}
          <div className="flex flex-col justify-center rounded-3xl bg-brand-soft p-6">
            <p className="text-4xl font-bold text-ink">{STAT.value}</p>
            <p className="mt-1 text-sm text-muted">{STAT.label}</p>
          </div>

          {/* remaining testimonials */}
          {rest.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

function TestimonialCard({ quote, name, role, tall = false, className = "" }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-3xl bg-brand-soft p-6 ${className}`}
    >
      <div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 text-[#F5B301]" />
          ))}
        </div>
        <p
          className={`mt-4 font-medium leading-relaxed text-ink ${
            tall ? "text-lg" : "text-[15px]"
          }`}
        >
          &ldquo;{quote}&rdquo;
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-sm font-semibold text-ink">
          {name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{role}</p>
        </div>
      </div>
    </div>
  );
}

function Star({ className = "" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6Z" />
    </svg>
  );
}
