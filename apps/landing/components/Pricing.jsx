"use client";

import { useState } from "react";
import AnimatedSection from "./AnimatedSection";
import { CheckIcon } from "./icons";
import { trialSignupUrl } from "@/lib/site";
// Single source of truth for plan copy/numbers — matches the ENFORCED
// entitlement matrix in the backend. Never hardcode plans in a component.
import { BILLING, PLANS, fmt } from "@/lib/plans";

export default function Pricing() {
  const [billing, setBilling] = useState("monthly");
  const active = BILLING.find((b) => b.id === billing);

  return (
    <section id="pricing" className="shell scroll-mt-24 py-16 lg:py-24">
      {/* header */}
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="eyebrow justify-center">Pricing</span>
        <h2 className="mt-4 text-[28px]/[36px] xl:text-[48px]/[56px] tracking-[-0.02em] xl:tracking-[-0.028em] font-semibold text-ink">
          One plan away from a store
          <br className="hidden sm:block" /> that runs itself.
        </h2>

        <p className="mt-4 text-base text-muted">
          Every plan starts with a 14-day free trial — no card needed. Buy AI
          credits any time; your purchased credits never expire.
        </p>
      </AnimatedSection>

      {/* billing-period toggle */}
      <AnimatedSection delay={80} className="mt-8 flex justify-center px-4 sm:px-0">
        <div className="flex w-full max-w-md items-center gap-1 rounded-full bg-surface-alt p-1.5 sm:inline-flex sm:w-auto sm:max-w-none">
          {BILLING.map((opt) => {
            const isActive = opt.id === billing;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBilling(opt.id)}
                aria-pressed={isActive}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2.5 text-xs font-semibold transition-all duration-300 ease-smooth sm:flex-none sm:flex-row sm:gap-2 sm:px-5 sm:text-sm ${
                  isActive
                    ? "bg-ink text-white shadow-[0_8px_20px_-8px_rgba(20,20,20,0.4)]"
                    : "text-ink hover:text-brand"
                }`}
              >
                {opt.label}
                {opt.save && (
                  <span
                    className={`text-xs font-bold ${
                      isActive ? "text-white/90" : "text-brand"
                    }`}
                  >
                    {opt.save}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </AnimatedSection>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan, i) => (
          <AnimatedSection
            key={plan.id}
            delay={i * 90}
            className={`group flex flex-col rounded-3xl border p-6 transition-all duration-300 ease-smooth hover:-translate-y-1 ${
              plan.highlighted
                ? "border-ink bg-white "
                : "border-line bg-surface-alt hover:border-ink/30 hover:shadow-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">{plan.name}</h3>
              {plan.badge && (
                <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {plan.badge}
                </span>
              )}
            </div>
            <p className="mt-2 min-h-10 text-xs leading-relaxed text-muted">
              {plan.audience}
            </p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-bold text-ink">
                {fmt(plan.price * (1 - active.discount))}
              </span>
              <span className="mb-1 text-sm text-muted">/mo</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand">
              {plan.credits}
            </p>
            <p className="mt-1 text-xs text-muted">{plan.note}</p>

            <ul className="mt-6 mb-8 space-y-3 border-t border-line pt-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                  <span className="text-xs leading-relaxed text-ink/80">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href={trialSignupUrl(plan.id, billing)}
              className={`mt-auto w-full ${plan.highlighted ? "btn-primary bg-ink shadow-none hover:bg-ink-soft" : "btn-ghost"}`}
            >
              {plan.cta}
            </a>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
