"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  House,
  CubeSolid,
  DocumentText,
  Palette,
  Globe,
  CogSixTooth,
  BarsThree,
  XMark,
  ArrowRightOnRectangle,
  ChatBubbleLeftRight,
  RocketLaunch,
  Users,
  UsersSolid,
  Tag,
  Folder,
  ChevronDown,
  BuildingStorefront,
  GlobeEurope,
  ReceiptPercent,
  ArrowPath,
  PencilSquare,
  GiftSolid,
  ListBullet,
  Hashtag,
  Sparkles,
  Envelope,
  Bolt,
  BookOpen,
  ChartBar,
  Robot,
  BuildingTax,
  MapPin,
  ArrowUturnLeft,
  ExclamationCircle,
  Swatch,
  CurrencyDollar,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"

type NavChild = { href: string; label: string; icon?: React.ComponentType<{ className?: string }> }

type NavItem =
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
  | {
      id: string
      label: string
      icon: React.ComponentType<{ className?: string }>
      children: NavChild[]
    }

const navItems: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: House },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartBar },
  {
    id: "orders",
    label: "Orders",
    icon: DocumentText,
    children: [
      { href: "/dashboard/orders", label: "Orders", icon: DocumentText },
      { href: "/dashboard/draft-orders", label: "Draft orders", icon: PencilSquare },
      { href: "/dashboard/returns", label: "Returns", icon: ArrowPath },
      { href: "/dashboard/claims", label: "Claims", icon: ExclamationCircle },
      { href: "/dashboard/exchanges", label: "Exchanges", icon: Swatch },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: CubeSolid,
    children: [
      { href: "/dashboard/products", label: "Products", icon: CubeSolid },
      { href: "/dashboard/categories", label: "Categories", icon: Tag },
      { href: "/dashboard/collections", label: "Collections", icon: Folder },
      { href: "/dashboard/gift-cards", label: "Gift cards", icon: GiftSolid },
      { href: "/dashboard/price-lists", label: "Price lists", icon: ListBullet },
      { href: "/dashboard/discounts", label: "Discounts", icon: ReceiptPercent },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    children: [
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/customer-groups", label: "Customer groups", icon: UsersSolid },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: RocketLaunch,
    children: [
      { href: "/dashboard/marketing", label: "Overview", icon: RocketLaunch },
      { href: "/dashboard/marketing/connect", label: "Social accounts", icon: Globe },
      { href: "/dashboard/marketing/posts", label: "Posts", icon: DocumentText },
      { href: "/dashboard/marketing/journeys", label: "Journeys", icon: Sparkles },
      { href: "/dashboard/marketing/campaigns", label: "Campaigns", icon: Hashtag },
      { href: "/dashboard/marketing/email", label: "Email templates", icon: Envelope },
      { href: "/dashboard/marketing/email/notifications", label: "Email notifications", icon: Envelope },
      { href: "/dashboard/marketing/chatbots", label: "Chatbots", icon: ChatBubbleLeftRight },
    ],
  },
  {
    id: "calls",
    label: "Call Center",
    icon: ChatBubbleLeftRight,
    children: [
      { href: "/dashboard/calls", label: "Overview", icon: ChatBubbleLeftRight },
      { href: "/dashboard/calls/campaigns", label: "Campaigns", icon: Bolt },
      { href: "/dashboard/calls/calls", label: "Calls", icon: DocumentText },
      { href: "/dashboard/calls/playbooks", label: "Playbooks", icon: BookOpen },
      { href: "/dashboard/calls/analytics", label: "Analytics", icon: ChartBar },
      { href: "/dashboard/calls/agents", label: "Agents", icon: Robot },
    ],
  },
  { href: "/dashboard/domains", label: "Domains", icon: Globe },
  { href: "/dashboard/design", label: "Design", icon: Palette },
  { href: "/dashboard/billing", label: "Billing", icon: CurrencyDollar },
  {
    id: "settings",
    label: "Settings",
    icon: CogSixTooth,
    children: [
      { href: "/dashboard/settings", label: "General", icon: CogSixTooth },
      { href: "/dashboard/settings/store", label: "Store", icon: BuildingStorefront },
      { href: "/dashboard/settings/regions", label: "Regions", icon: GlobeEurope },
      { href: "/dashboard/settings/taxes", label: "Taxes", icon: BuildingTax },
      { href: "/dashboard/settings/locations", label: "Locations & shipping", icon: MapPin },
      { href: "/dashboard/settings/return-reasons", label: "Return reasons", icon: ArrowUturnLeft },
    ],
  },
]

function isChildActive(pathname: string, children: NavChild[]) {
  return children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
}

export function Sidebar() {
  const pathname = usePathname()
  const { me, logout } = useMerchantAuth()
  const [open, setOpen] = useState(false)

  const initiallyOpen = useMemo(() => {
    const ids = new Set<string>()
    for (const item of navItems) {
      if ("children" in item && isChildActive(pathname, item.children)) {
        ids.add(item.id)
      }
    }
    return ids
  }, [pathname])

  const [openSections, setOpenSections] = useState<Set<string>>(initiallyOpen)

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
        aria-controls="merchant-sidebar"
      >
        {open ? (
          <XMark className="h-5 w-5 text-grey-90" />
        ) : (
          <BarsThree className="h-5 w-5 text-grey-90" />
        )}
      </button>

      <aside
        id="merchant-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-grey-20 bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-6 border-b border-grey-10 pb-5">
            <div className="flex items-center gap-2">
              <img
                src="data:image/png;base64,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"
                alt="mAutomate"
                className="h-8 w-8 shrink-0 rounded-base"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-grey-90">
                  {me?.store.name || "Store Admin"}
                </h2>
                <p className="truncate text-xs text-grey-50">{me?.merchant.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto -mr-2 pr-2" aria-label="Main navigation">
            {navItems.map((item) => {
              if ("children" in item) {
                const active = isChildActive(pathname, item.children)
                const sectionOpen = openSections.has(item.id)
                const Icon = item.icon
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSection(item.id)}
                      aria-expanded={sectionOpen}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-base px-3 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90 focus-visible:ring-offset-2",
                        active
                          ? "bg-grey-90 text-white shadow-sm"
                          : "text-grey-60 hover:bg-grey-10 hover:text-grey-90"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-white" : "text-grey-40 group-hover:text-grey-90"
                          )}
                        />
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          sectionOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {sectionOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-grey-20 pl-2">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-base px-3 py-2 text-sm font-medium transition-colors",
                                childActive
                                  ? "bg-grey-10 text-grey-90"
                                  : "text-grey-60 hover:bg-grey-5 hover:text-grey-90"
                              )}
                              aria-current={childActive ? "page" : undefined}
                            >
                              {ChildIcon && <ChildIcon className="h-4 w-4" />}
                              {child.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90 focus-visible:ring-offset-2",
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
          </nav>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
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
