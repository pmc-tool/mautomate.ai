"use client";

import { useState } from "react";
import Image from "next/image";
import AnimatedSection from "./AnimatedSection";
import {
  WebsiteIcon,
  MarketingIcon,
  SocialIcon,
  SupportIcon,
  OperationsIcon,
  CallIcon,
  DomainIcon,
  MobileIcon,
} from "./icons";

// Each use-case maps to the app screenshot shown in the mockup on the right.
const ITEMS = [
  {
    icon: WebsiteIcon,
    title: "Storefront",
    body: "Launch a responsive, no-code store with your own domain in minutes.",
    img: "/assets/storefronts.png",
  },
  {
    icon: MarketingIcon,
    title: "Marketing Automation",
    body: "Generate campaigns across email, ads, and social — then optimize automatically.",
    img: "/assets/social-media-manager.png",
  },
  {
    icon: SocialIcon,
    title: "Social Media Manager",
    body: "Plan, schedule, and publish content across every channel from one place.",
    img: "/assets/social-media-manager.png",
  },
  {
    icon: SupportIcon,
    title: "AI Customer Support",
    body: "Answer customers 24/7 over chat, WhatsApp, and email with AI.",
    img: "/assets/ai-customer-supports.png",
  },
  {
    icon: OperationsIcon,
    title: "Business Operations",
    body: "Track products, orders, inventory, and revenue in real time.",
    img: "/assets/business-operations.png",
  },
  {
    icon: CallIcon,
    title: "AI Call Center",
    body: "Let AI answer calls, qualify leads, and route conversations around the clock.",
    img: "/assets/ai-call-center.png",
  },
  {
    icon: DomainIcon,
    title: "Custom Domain & Email",
    body: "Connect your own domain and business email in a few clicks.",
    img: "/assets/custom-domain.png",
  },
  {
    icon: MobileIcon,
    title: "Mobile App",
    body: "Give customers a branded iOS and Android app to shop and stay notified.",
    img: "/assets/mobile-app.png",
  },
];

// How long each use-case stays active before auto-advancing. Drives the
// progress-bar animation, whose `onAnimationEnd` advances to the next item —
// so the bar and the auto-play are always in sync, including pause/resume.
const AUTOPLAY_MS = 5000;

export default function ProductShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = ITEMS[active];

  const next = () => setActive((i) => (i + 1) % ITEMS.length);

  return (
    <section id="use-cases" className="shell scroll-mt-24 py-16 lg:py-24">
      {/* header */}
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="eyebrow justify-center">Use cases</span>
        <h2 className="mt-4 text-[28px]/[36px] xl:text-[48px]/[56px] tracking-[-0.02em] xl:tracking-[-0.028em] font-semibold text-ink">
          One platform for every
          <br className="hidden sm:block" /> part of your business
        </h2>

        <p className="mt-4 text-base text-muted">
          Stop paying for a dozen disconnected tools. mAutomate runs your store,
          marketing, and support from a single dashboard.
        </p>
      </AnimatedSection>

      {/* two-column body */}
      <div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-14">
        {/* use-case accordion (triggers the mockup) */}
        <AnimatedSection>
          <div
            className="divide-y divide-line border-b border-line"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {ITEMS.map((item, i) => {
              const isOpen = i === active;
              return (
                <div key={item.title} className="relative">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center gap-3 py-5 text-left cursor-pointer"
                  >
                    <item.icon
                      className={`h-7 w-7 flex-none transition-colors ${
                        isOpen
                          ? "text-brand"
                          : "text-muted group-hover:text-brand"
                      }`}
                    />
                    <span
                      className={`flex-1 text-2xl font-semibold transition-colors -tracking-[0.03em] ${
                        isOpen
                          ? "text-brand"
                          : "text-ink/80 group-hover:text-ink"
                      }`}
                    >
                      {item.title}
                    </span>
                  </button>

                  {/* collapsible panel */}
                  <div
                    className={`grid transition-all duration-300 ease-smooth ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-5 pl-8 pr-2 text-sm leading-relaxed text-muted">
                        {item.body}
                      </p>
                    </div>
                  </div>

                  {/* auto-play progress bar along the item's bottom border */}
                  {isOpen && (
                    <span
                      key={active}
                      aria-hidden="true"
                      onAnimationEnd={next}
                      style={{
                        "--progress-duration": `${AUTOPLAY_MS}ms`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand animate-progress motion-reduce:hidden"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </AnimatedSection>

        {/* app mockup — shows the selected use-case's screenshot */}
        <AnimatedSection delay={120}>
          <AppMockup src={current.img} alt={current.title} />
        </AnimatedSection>
      </div>
    </section>
  );
}

function AppMockup({ src, alt }) {
  return (
    <div className="relative">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -inset-x-6 -bottom-6 top-20 rounded-[2.5rem] bg-gradient-to-b from-brand-soft/60 to-transparent blur-2xl" />

      <div className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-float">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-surface-alt px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          <div className="ml-4 hidden flex-1 items-center rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-muted sm:flex">
            app.mautomate.com/{alt.toLowerCase().replace(/[^a-z]+/g, "-")}
          </div>
        </div>

        {/* screenshot */}
        <div className="relative aspect-[16/10] w-full bg-surface-alt">
          <Image
            key={src}
            src={src}
            alt={`${alt} preview`}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="animate-fade-up object-cover object-top"
          />
        </div>
      </div>
    </div>
  );
}
