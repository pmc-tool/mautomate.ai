"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  ShoppingBag,
  Link as LinkIcon,
  ArrowDownTray,
  Globe,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listDomains,
  listDomainContacts,
  searchDomainsForPurchase,
  Domain,
  DomainContact,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { BuyTab } from "./components/buy-tab"
import { ConnectTab } from "./components/connect-tab"
import { TransferTab } from "./components/transfer-tab"
import { YourDomains } from "./components/your-domains"
import { Callout } from "./components/ui"

type TabKey = "buy" | "connect" | "transfer"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "buy", label: "Buy new", icon: ShoppingBag },
  { key: "connect", label: "Connect a domain I own", icon: LinkIcon },
  { key: "transfer", label: "Transfer in", icon: ArrowDownTray },
]

export default function DomainsPage() {
  const { token, me } = useMerchantAuth()
  const [tab, setTab] = useState<TabKey>("buy")

  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<DomainContact[]>([])
  const [registrarConfigured, setRegistrarConfigured] = useState<boolean | null>(null)

  const fetchDomains = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await listDomains(token)
      setDomains(res.domains ?? [])
    } catch {
      setDomains([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchContacts = useCallback(async () => {
    if (!token) return
    try {
      const res = await listDomainContacts(token)
      setContacts(res.contacts ?? [])
    } catch {
      // profiles are optional until a purchase — ignore load errors
    }
  }, [token])

  // Probe whether the registrar (ResellerClub) is configured, so the UI can be
  // honest about degraded (manual-approval) mode across every flow.
  const probeRegistrar = useCallback(async () => {
    if (!token) return
    try {
      const res = await searchDomainsForPurchase(token, "example", ["com"])
      setRegistrarConfigured(!!res.configured)
    } catch {
      setRegistrarConfigured(null)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    fetchDomains()
    fetchContacts()
    probeRegistrar()
  }, [token, fetchDomains, fetchContacts, probeRegistrar])

  const hasProfile = contacts.length > 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="Domains"
        description="Buy a new domain, connect one you already own, or transfer one in — and manage everything in one place."
      />

      {registrarConfigured === false && (
        <Callout tone="warning" title="Live registration is being set up">
          Your store isn&apos;t connected to our domain registrar yet, so purchases
          and transfers are handled as requests that go to our team for approval,
          and prices are estimates. Everything below still works — you just
          won&apos;t get instant registration until this is switched on.
        </Callout>
      )}

      {me?.store?.plan && (me.store.plan.domains_limit ?? 0) <= 0 && (
        <Callout tone="warning" title="Custom domains are a Growth feature">
          Your store runs on its free mautomate.ai address. Upgrade to the Growth
          plan or above to connect or buy your own domain.{" "}
          <a href="/dashboard/billing" className="font-medium underline">
            View plans
          </a>
          .
        </Callout>
      )}

      {/* Flows */}
      <SectionCard
        title="Get a domain"
        description="Pick how you'd like to add a domain to your store."
        icon={Globe}
      >
        {/* Tab nav */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-grey-20">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-grey-90 text-grey-90"
                    : "border-transparent text-grey-50 hover:text-grey-80"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === "buy" && (
          <BuyTab
            token={token || ""}
            hasProfile={hasProfile}
            onProfileCreated={(c) => setContacts((prev) => [c, ...prev])}
            onPurchased={fetchDomains}
          />
        )}
        {tab === "connect" && (
          <ConnectTab token={token || ""} onConnected={fetchDomains} plan={me?.store?.plan} />
        )}
        {tab === "transfer" && (
          <TransferTab token={token || ""} onTransferred={fetchDomains} />
        )}
      </SectionCard>

      {/* Persistent management table */}
      <SectionCard
        title="Your domains"
        description="Your free mAutomate address plus any domain you've connected, bought or transferred in."
        icon={Globe}
      >
        <YourDomains
          token={token || ""}
          domains={domains}
          loading={loading}
          registrarConfigured={registrarConfigured}
          onChanged={fetchDomains}
        />
      </SectionCard>
    </div>
  )
}
