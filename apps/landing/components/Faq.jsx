"use client";

import { Collapse } from "antd";
import AnimatedSection from "./AnimatedSection";
import { ChevronDown } from "./icons";

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
  const items = QA.map((item, i) => ({
    key: String(i),
    label: (
      <span className="text-lg font-semibold text-ink sm:text-xl tracking-[-0.02em]">
        {item.q}
      </span>
    ),
    children: (
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{item.a}</p>
    ),
  }));

  return (
    <section id="faq" className="shell scroll-mt-24 py-16 lg:py-24">
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

      <AnimatedSection delay={120} className="mx-auto mt-12 max-w-3xl">
        <Collapse
          items={items}
          defaultActiveKey={["0"]}
          variant="borderless"
          expandIconPosition="end"
          expandIcon={({ isActive }) => (
            <ChevronDown
              className={`h-5 w-5 text-muted transition-transform duration-300 ${
                isActive ? "rotate-180 text-brand" : ""
              }`}
            />
          )}
          className="faq-collapse divide-y divide-line border-y border-line !bg-transparent"
        />
      </AnimatedSection>
    </section>
  );
}
