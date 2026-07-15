"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  ChartBar,
  House,
  BuildingStorefront,
  CubeSolid,
  CreditCard,
  CurrencyDollar,
  CogSixTooth,
  BarsThree,
  XMark,
  ArrowRightOnRectangle,
  Globe,
  Puzzle,
  DocumentText,
  ChatBubbleLeftRight,
  UsersSolid,
  ShieldCheck,
  CloudSolid,
  Palette,
  Eye,
  UserGroup,
  Sparkles,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type NavSection = {
  label: string
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/control/overview/", label: "Dashboard", icon: House },
      { href: "/control/analytics/", label: "Analytics", icon: ChartBar },
    ],
  },
  {
    label: "Commerce Ops",
    items: [{ href: "/control/stores/", label: "Stores", icon: BuildingStorefront }],
  },
  {
    label: "Money",
    items: [
      { href: "/control/margin/", label: "Margin & P&L", icon: ChartBar },
      { href: "/control/billing/", label: "Billing & Finance", icon: CurrencyDollar },
      { href: "/control/credits/", label: "Credits & Economy", icon: CreditCard },
    ],
  },
  {
    label: "Catalog",
    items: [{ href: "/control/packages/", label: "Packages & Pricing", icon: CubeSolid }],
  },
  {
    label: "Platform",
    items: [
      { href: "/control/integrations/", label: "Integrations & Keys", icon: Puzzle },
      { href: "/control/domains/", label: "Domains", icon: Globe },
      { href: "/control/infra/", label: "Infrastructure", icon: CloudSolid },
      { href: "/control/themes/", label: "Themes", icon: Palette },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/control/blog/", label: "Marketing Site / Blog", icon: DocumentText },
      { href: "/control/support/", label: "Support & Inbox", icon: ChatBubbleLeftRight },
    ],
  },
  {
    label: "Trust & Reliability",
    items: [
      { href: "/control/observability/", label: "Observability", icon: Eye },
      { href: "/control/aiabuse/", label: "AI & Abuse", icon: Sparkles },
      { href: "/control/governance/", label: "Governance", icon: ShieldCheck },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/control/partners/", label: "Partners", icon: UserGroup }],
  },
  {
    label: "System",
    items: [
      { href: "/control/operators/", label: "Operators", icon: UsersSolid },
      { href: "/control/settings/", label: "Settings", icon: CogSixTooth },
    ],
  },
]

const allNavItems = navSections.flatMap((s) => s.items)

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useControlAuth()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-base border border-grey-20 bg-white shadow-borders-base transition-colors hover:bg-grey-10 lg:hidden",
          open && "border-grey-30 bg-grey-10"
        )}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="control-sidebar"
      >
        {open ? (
          <XMark className="h-5 w-5 text-grey-90" />
        ) : (
          <BarsThree className="h-5 w-5 text-grey-90" />
        )}
      </button>

      <aside
        id="control-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto border-r border-grey-20 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-6 border-b border-grey-10 pb-5">
            <img
              src="/mautomate-logo.png"
              alt="mAutomate"
              className="h-7 w-auto"
            />
            <span className="mt-3 inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-60">
              Control Plane
            </span>
          </div>

          <nav className="flex-1 space-y-6" aria-label="Main navigation">
            {navSections.map((section) => (
              <div key={section.label}>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-grey-40">
                  {section.label}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}`)
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-base px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90 focus-visible:ring-offset-2",
                          active
                            ? "bg-grey-90 text-white shadow-sm"
                            : "text-grey-60 hover:bg-grey-10 hover:text-grey-90"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-white" : "text-grey-40 group-hover:text-grey-90"
                          )}
                        />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <button
            onClick={logout}
            className="mt-6 flex w-full items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            <ArrowRightOnRectangle className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}
    </>
  )
}
