"use client";

import { useState } from "react";
import AnimatedSection from "./AnimatedSection";

const QA = [
  {
    q: "What is mAutomate?",
    a: "mAutomate is an all-in-one AI business automation platform that helps you build websites, create AI content, automate marketing, support customers, and manage your business from a single dashboard.",
  },
  {
    q: "Can I automate my social media?",
    a: "Yes. Plan, generate, schedule, and publish content across every connected platform, then track performance—all from one place.",
  },
  {
    q: "Do I need any coding skills?",
    a: "None at all. The drag-and-drop website builder and AI assistants handle the technical work so you can focus on your business.",
  },
  {
    q: "How quickly can I launch my business?",
    a: "Most brands go live the same day. Tell the AI about your brand and it builds your storefront, domain, email, and first campaigns for you.",
  },
  {
    q: "Can I use my own custom domain?",
    a: "Absolutely. Connect an existing domain or register a new one, plus a matching business email, in just a few clicks.",
  },
  {
    q: "What can the AI create for me?",
    a: "Websites, product pages, marketing copy, social posts, ad campaigns, email flows, and customer-support replies—reviewed and approved by you.",
  },
];

export default function Faq() {
  // Accordion: one card open at a time (start with the first). Clicking the
  // open card closes it.
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="shell scroll-mt-24 pb-16 lg:pb-24">
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="eyebrow justify-center">FAQ</span>
        <h2 className="mt-4 text-[28px]/[36px] xl:text-[48px]/[56px] tracking-[-0.02em] xl:tracking-[-0.028em] font-semibold text-ink">
          Questions? We&apos;ve got answers.
        </h2>

        <p className="mt-4 text-base text-muted">
          Learn more about how mAutomate works, what it offers, and how it can
          help automate your business.
        </p>
      </AnimatedSection>

      <AnimatedSection delay={120} className="mx-auto mt-12 max-w-3xl space-y-3">
        {QA.map((item, i) => {
          const isOpen = i === open;
          return (
            <div
              key={item.q}
              className={`rounded-3xl transition-all duration-300 ease-smooth ${
                isOpen
                  ? "bg-white shadow-card"
                  : "bg-surface-alt hover:bg-line/60"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-8 sm:py-6 cursor-pointer"
              >
                <span className="text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
                  {item.q}
                </span>
                <PlusToggle open={isOpen} />
              </button>

              {/* collapsible answer */}
              <div
                className={`grid transition-all duration-300 ease-smooth ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-2xl px-6 pb-6 text-sm leading-relaxed text-muted sm:px-8 sm:pb-7">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </AnimatedSection>
    </section>
  );
}

// A plus that rotates 45° into a "×" when its card is open.
function PlusToggle({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 flex-none text-muted-light transition-transform duration-300 ease-smooth ${
        open ? "rotate-45" : ""
      }`}
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
