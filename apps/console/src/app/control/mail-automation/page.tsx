"use client"

import { useMemo, useState } from "react"
import {
  EnvelopeContent,
  BellAlert,
  Sparkles,
  CreditCard,
  BuildingStorefront,
  UserGroup,
} from "@medusajs/icons"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ *
 * Mail Automation — superadmin catalog of every automated email the
 * platform ships. Self-contained (no backend call) so it always renders;
 * live toggle / send-test / delivery-log wire to the platform notify
 * backend as a follow-up.
 * ------------------------------------------------------------------ */

type PlatformEmail = {
  name: string
  trigger: string
  desc: string
}

// mAutomate -> merchant (the subscription / AI-credit lifecycle)
const PLATFORM_EMAILS: PlatformEmail[] = [
  { name: "Welcome", trigger: "Merchant signs up", desc: "Store is ready — first steps to get automated." },
  { name: "Subscription activated", trigger: "checkout.session.completed", desc: "Plan is live; included credits added to the wallet." },
  { name: "Renewal receipt", trigger: "invoice.paid", desc: "Payment received; plan credits refreshed." },
  { name: "Top-up receipt", trigger: "Credit top-up paid", desc: "Credits added to the wallet (top-ups never expire)." },
  { name: "Payment failed", trigger: "invoice.payment_failed", desc: "Dunning — update the card before service pauses." },
  { name: "Plan changed", trigger: "Plan upgrade / downgrade", desc: "Confirms the new plan, effective immediately." },
  { name: "Low AI credits", trigger: "Balance ≤ threshold (daily sweep)", desc: "Proactive nudge to top up before AI features pause." },
  { name: "Trial ending", trigger: "trial_ends_at within 3 days", desc: "Choose a plan so automations keep running." },
  { name: "Credit expired", trigger: "Plan credits expired", desc: "Notice that plan-cycle credits lapsed (top-ups don't)." },
  { name: "Account suspended", trigger: "Lifecycle → suspended", desc: "Data is safe; reactivate to resume automations." },
]

type Campaign = { name: string; subject: string }
type CampaignGroup = {
  key: string
  label: string
  blurb: string
  icon: React.ComponentType<{ className?: string }>
  tone: "brand" | "green" | "grey"
  items: Campaign[]
}

// The template library shipped with every store.
const CAMPAIGNS: CampaignGroup[] = [
  {
    key: "merchant",
    label: "Merchant onboarding & growth",
    blurb: "mAutomate → the store owner",
    icon: BuildingStorefront,
    tone: "brand",
    items: [
      { name: "Welcome — store ready", subject: "Welcome to mAutomate — your store is ready" },
      { name: "Finish setup", subject: "Finish setting up your store" },
      { name: "Add first product", subject: "Add your first product" },
      { name: "First sale", subject: "Congratulations on your first sale" },
      { name: "Store gone quiet", subject: "Let's get your store moving again" },
      { name: "Grow faster (tips)", subject: "Grow faster with mAutomate" },
      { name: "Store support", subject: "Need help with your store?" },
      { name: "Revenue milestone", subject: "You've hit a big milestone" },
    ],
  },
  {
    key: "shopper",
    label: "Store → shopper (white-label)",
    blurb: "The merchant's store → its customers",
    icon: UserGroup,
    tone: "green",
    items: [
      { name: "Welcome to store", subject: "Welcome to {{store_name}}" },
      { name: "New arrivals", subject: "New arrivals just landed" },
      { name: "Picked for you", subject: "Picked just for you" },
      { name: "Ready for first order", subject: "Ready for your first order?" },
      { name: "Order thanks", subject: "Thanks for your order" },
      { name: "Cart abandoned 1", subject: "You left something in your cart" },
      { name: "Cart abandoned 2", subject: "Your cart is still waiting" },
      { name: "Cart abandoned 3", subject: "Final reminder — your cart" },
      { name: "Checkout abandoned 1", subject: "You're one step from checking out" },
      { name: "Checkout abandoned 2", subject: "Last chance to complete your order" },
      { name: "Win-back 1", subject: "We miss you" },
      { name: "Win-back 2", subject: "We'd love you back" },
      { name: "Win-back 3", subject: "Staying in touch" },
      { name: "Order help", subject: "Need a hand with your order?" },
      { name: "Loyalty", subject: "Thanks for being a loyal customer" },
      { name: "VIP", subject: "Welcome to VIP" },
    ],
  },
  {
    key: "billing",
    label: "Billing & credits (campaign set)",
    blurb: "mAutomate → the store owner",
    icon: CreditCard,
    tone: "grey",
    items: [
      { name: "AI credits low", subject: "Your AI credits are running low" },
      { name: "Credits almost out", subject: "You're almost out of AI credits" },
      { name: "Payment failed", subject: "Action needed: your payment failed" },
      { name: "Credits added", subject: "Credits added to your wallet" },
    ],
  },
]

function Pill({
  children,
  tone = "grey",
}: {
  children: React.ReactNode
  tone?: "green" | "amber" | "grey" | "brand"
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    brand: "bg-cyan-50 text-cyan-700 border-cyan-200",
    grey: "bg-grey-10 text-grey-60 border-grey-20",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  )
}

export default function MailAutomationPage() {
  const [tab, setTab] = useState<"platform" | "campaigns">("platform")

  const campaignCount = useMemo(
    () => CAMPAIGNS.reduce((n, g) => n + g.items.length, 0),
    []
  )

  return (
    <div>
      <PageHeader
        title="Mail Automation"
        description="Every automated email the platform sends — lifecycle emails from mAutomate to merchants, and the campaign templates each merchant's store sends to its shoppers."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Platform lifecycle emails" value={PLATFORM_EMAILS.length} icon={BellAlert} tone="brand" />
        <KpiCard label="Store campaign templates" value={campaignCount} icon={Sparkles} tone="green" />
        <KpiCard label="Total automated emails" value={PLATFORM_EMAILS.length + campaignCount} icon={EnvelopeContent} />
        <KpiCard label="Sending domain" value={<span className="text-lg">mail.mautomate.ai</span>} icon={EnvelopeContent} />
      </div>

      {/* Activation note */}
      <div className="mt-6 rounded-large border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Activation</p>
        <p className="mt-1 text-sm text-amber-700">
          Templates and the send pipeline (DKIM-signed via mail.mautomate.ai) are in place. Platform lifecycle
          emails are gated behind <code className="rounded bg-amber-100 px-1">PLATFORM_LIFECYCLE_EMAILS=1</code> and
          activate once the backend engine is compiled in and enabled. Live toggle, per-type controls and a
          send-test are the next wiring step.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-grey-20">
        {[
          { k: "platform", label: `Platform lifecycle (${PLATFORM_EMAILS.length})` },
          { k: "campaigns", label: `Store campaigns (${campaignCount})` },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as "platform" | "campaigns")}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.k
                ? "border-cyan-600 text-grey-90"
                : "border-transparent text-grey-50 hover:text-grey-70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "platform" && (
        <div className="mt-6 overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-grey-20 bg-grey-10 text-xs uppercase tracking-wide text-grey-50">
              <tr>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Trigger</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">What it says</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-15">
              {PLATFORM_EMAILS.map((e) => (
                <tr key={e.name} className="hover:bg-grey-10/50">
                  <td className="px-5 py-3.5 font-medium text-grey-90">{e.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="rounded bg-grey-10 px-1.5 py-0.5 text-xs text-grey-60">{e.trigger}</code>
                  </td>
                  <td className="hidden px-5 py-3.5 text-grey-50 md:table-cell">{e.desc}</td>
                  <td className="px-5 py-3.5">
                    <Pill tone="amber">Ready · gated</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="mt-6 space-y-8">
          {CAMPAIGNS.map((g) => {
            const Icon = g.icon
            return (
              <section key={g.key}>
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-base p-2",
                      g.tone === "brand"
                        ? "bg-cyan-50 text-cyan-700"
                        : g.tone === "green"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-grey-10 text-grey-60"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-grey-90">{g.label}</h3>
                    <p className="text-xs text-grey-50">
                      {g.blurb} · {g.items.length} templates
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((c) => (
                    <div
                      key={c.name}
                      className="rounded-large border border-grey-20 bg-white p-4 shadow-borders-base transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <p className="text-sm font-semibold text-grey-90">{c.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-grey-50">
                        Subject: <span className="text-grey-60">{c.subject}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
