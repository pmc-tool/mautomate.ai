"use client";

import { useEffect, useState } from "react";
import AnimatedSection from "./AnimatedSection";
import { CheckIcon } from "./icons";
import { BILLING, PLANS, fmt, TRIAL_DAYS } from "@/lib/plans";
import { trialSignupUrl } from "@/lib/site";

// Interactive pack picker for the Get Started page. Every pack starts the same
// 7-day free trial — there is no separate "free trial" pack to choose. A plan
// and billing period can be pre-selected via ?plan=<id>&billing=<id> (set by
// the CTAs on the pricing section). We read them from the URL on mount instead
// of useSearchParams to avoid the static-export prerender bailout.
export default function GetStarted() {
  const [billing, setBilling] = useState("monthly");
  const [selected, setSelected] = useState("grow");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const plan = q.get("plan");
    const bill = q.get("billing");
    if (plan && PLANS.some((p) => p.id === plan)) setSelected(plan);
    if (bill && BILLING.some((b) => b.id === bill)) setBilling(bill);
  }, []);

  const active = BILLING.find((b) => b.id === billing);

  return (
    <section className="shell pb-16 lg:pb-20">
      {/* billing-period toggle */}
      <AnimatedSection className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface-alt p-1.5">
          {BILLING.map((opt) => {
            const isActive = opt.id === billing;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBilling(opt.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ease-smooth ${
                  isActive
                    ? "bg-brand text-white shadow-[0_8px_20px_-8px_rgba(241,90,41,0.6)]"
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

      {/* pack cards */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan, i) => {
          const isPicked = plan.id === selected;
          return (
            <AnimatedSection
              key={plan.id}
              delay={i * 80}
              className={`group relative flex flex-col rounded-3xl border p-6 text-left transition-all duration-300 ease-smooth ${
                isPicked
                  ? "border-brand bg-white shadow-card-hover ring-2 ring-brand/30"
                  : "border-line bg-brand-soft hover:-translate-y-1 hover:border-brand/30 hover:shadow-card"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={isPicked}
                className="absolute inset-0 z-0 rounded-3xl"
                aria-label={`Choose ${plan.name}`}
              />

              <div className="relative z-10 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                  {isPicked ? (
                    <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Your pick
                    </span>
                  ) : plan.badge ? (
                    <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {plan.badge}
                    </span>
                  ) : null}
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
                <p className="mt-1 text-xs font-medium text-accent-green">
                  Free for {TRIAL_DAYS} days
                </p>
                <p className="mt-2 text-sm font-semibold text-brand">
                  {plan.credits}
                </p>

                <ul className="mt-6 mb-8 space-y-3 border-t border-brand/30 pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-soft text-brand">
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
                  className={`relative z-10 mt-auto w-full ${
                    isPicked ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </AnimatedSection>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        No charge today. We&apos;ll remind you before your {TRIAL_DAYS} days are
        up — cancel any time before then and you won&apos;t be billed.
      </p>
    </section>
  );
}
