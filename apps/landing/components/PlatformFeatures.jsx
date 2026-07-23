"use client";

import { useState } from "react";
import AnimatedSection from "./AnimatedSection";
import {
  SocialIcon,
  OperationsIcon,
  CallIcon,
  MarketingIcon,
  WebsiteIcon,
  DomainIcon,
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
} from "./icons";

const ITEMS = [
  {
    icon: SocialIcon,
    title: "Social Media Manager",
    body: "Plan, schedule, publish, and track your social media content across multiple platforms from one dashboard.",
  },
  {
    icon: OperationsIcon,
    title: "Business Operations",
    body: "Monitor inventory, orders, customers, and revenue in real time from a single operations hub.",
  },
  {
    icon: CallIcon,
    title: "AI Call Center",
    body: "Let AI answer calls around the clock, qualify leads, and route conversations to the right place.",
  },
  {
    icon: MarketingIcon,
    title: "Marketing Automation",
    body: "Launch AI-generated campaigns across email, ads, and social—then optimize automatically.",
  },
  {
    icon: WebsiteIcon,
    title: "Website Builder",
    body: "Design and launch a responsive storefront with a no-code, drag-and-drop builder.",
  },
  {
    icon: DomainIcon,
    title: "Custom Domain",
    body: "Connect your own domain and business email in a few clicks for a branded presence.",
  },
];

export default function PlatformFeatures() {
  const [active, setActive] = useState(0);

  return (
    <section className="shell grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
      {/* Visual */}
      <AnimatedSection className="order-2 lg:order-1">
        <PlatformVisual />
      </AnimatedSection>

      {/* Accordion */}
      <AnimatedSection delay={120} className="order-1 lg:order-2">
        <span className="eyebrow">Features Overview</span>
        <h2 className="mt-4 text-h2 font-bold text-ink">
          Your AI Automate
          <br className="hidden sm:block" /> ecommerce platform
        </h2>

        <div className="mt-8 divide-y divide-line rounded-3xl border border-line bg-white p-2 shadow-card">
          {ITEMS.map((item, i) => {
            const isOpen = active === i;
            return (
              <div key={item.title} className="px-2">
                <button
                  type="button"
                  onClick={() => setActive(isOpen ? -1 : i)}
                  className="flex w-full items-center gap-3 py-4 text-left transition-colors"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-colors duration-300 ${
                      isOpen
                        ? "bg-gradient-to-br from-accent-green-light to-accent-green text-white"
                        : "bg-surface-alt text-muted"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`flex-1 text-base font-semibold transition-colors ${
                      isOpen ? "text-ink" : "text-ink/80"
                    }`}
                  >
                    {item.title}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-smooth ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 pl-[52px] pr-2 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AnimatedSection>
    </section>
  );
}

function PlatformVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div className="absolute inset-6 rounded-3xl bg-surface-alt" />

      {/* floating social bubbles */}
      <div className="absolute left-8 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card">
        <FacebookIcon className="h-6 w-6" />
      </div>
      <div className="absolute left-4 top-1/3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card">
        <InstagramIcon className="h-6 w-6" />
      </div>
      <div className="absolute right-10 top-8 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card">
        <WhatsappIcon className="h-6 w-6" />
      </div>
      <div className="absolute right-6 top-1/3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-muted shadow-card">
        +
      </div>

      {/* phone card */}
      <div className="absolute left-1/2 top-1/2 w-[52%] -translate-x-1/2 -translate-y-[42%] rounded-2xl border border-line bg-white p-2.5 shadow-float">
        <div className="rounded-xl bg-gradient-to-br from-brand-soft to-white p-2">
          <p className="text-[10px] font-bold leading-tight text-ink">
            Now your business automate in a your hand
          </p>
          <div className="mt-2 h-16 rounded-lg bg-gradient-to-br from-brand-light to-brand-dark" />
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[9px] text-brand">♥</span>
            <span className="text-[9px] text-muted">•</span>
            <span className="text-[9px] text-muted">•</span>
          </div>
        </div>
      </div>

      {/* orb accent */}
      <div className="absolute bottom-6 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-light to-brand-dark shadow-[0_20px_50px_-15px_rgba(241,90,41,0.6)]" />
    </div>
  );
}
