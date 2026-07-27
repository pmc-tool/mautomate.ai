"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
  InboxSolid,
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
  ChartPie,
  Phone,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  apiUrl,
  setActiveStoreId,
  type OwnedStore,
} from "@lib/merchant-admin/api"
import { CreditsBadge } from "./credits-badge"

/**
 * Multi-store switcher (M1). Renders only when the login owns 2+ stores, so
 * the entire feature is invisible to single-store merchants (dark launch).
 * Switching stores stores the id (validated server-side on every request)
 * and hard-reloads so every surface refetches under the new context.
 */
/**
 * Full-screen choreography while a new store provisions (~5-15s of real
 * backend work). Staged lines advance on a timer; the final line holds until
 * the request resolves. Mirrors the Pixi boot-sequence pattern so waits read
 * as deliberate work, not a stall.
 */
const CREATE_STEPS = [
  "Reserving your address",
  "Building your storefront",
  "Stocking starter content",
  "Opening the doors",
]

function StoreCreatingOverlay({ mode }: { mode: "create" | "checkout" }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = window.setInterval(
      () => setStep((v) => Math.min(v + 1, CREATE_STEPS.length - 1)),
      2600
    )
    return () => window.clearInterval(id)
  }, [])
  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-[#0B0C10]"
      role="dialog"
      aria-modal="true"
      aria-label="Creating your store"
      aria-live="polite"
    >
      <div className="relative mb-12 flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#F26522]/20 [animation-duration:2s] motion-reduce:animate-none" />
        <div className="absolute inset-3 animate-pulse rounded-full bg-[#F26522]/30 [animation-duration:1.5s] motion-reduce:animate-none" />
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#F26522] to-[#B33A0E] shadow-[0_0_70px_rgba(242,101,34,0.5)]" />
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="relative" aria-hidden="true">
          <path d="M3 9.5 5 4h14l2 5.5" />
          <path d="M4 9.5h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10Z" />
          <path d="M9 20.5v-6h6v6" />
        </svg>
      </div>
      {mode === "checkout" ? (
        <p className="text-lg font-medium text-white">
          Taking you to secure payment
          <span className="jv-boot-dots" />
        </p>
      ) : (
        <>
          <p key={step} className="animate-[fadeUp_.4s_ease-out] text-xl font-semibold text-white">
            {CREATE_STEPS[step]}
            <span className="jv-boot-dots" />
          </p>
          <div className="mt-7 flex items-center gap-2">
            {CREATE_STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === step ? 24 : 8,
                  background: i <= step ? "#F26522" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
          <p className="mt-10 text-sm text-white/50">
            Your new store is being built - this takes a few seconds.
          </p>
        </>
      )}
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .jv-boot-dots::after { content: ""; animation: sbDots 1.4s steps(4, end) infinite; }
        @keyframes sbDots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
      `}</style>
    </div>
  )
}

function StoreSwitcher({
  stores,
  activeName,
  planKey,
  token,
}: {
  stores: OwnedStore[]
  activeName: string
  planKey: string
  token: string | null
}) {
  // The + row NEVER hides (product rule: always invite, sell on click).
  // Eligibility decides what the click does: open the create form, or raise
  // the upgrade modal via the same typed payloads the backend gates emit.
  const isScale = planKey === "scale"
  const atCap = isScale && stores.length >= 10
  const canAdd = isScale && !atCap

  const raiseUpsell = () => {
    window.dispatchEvent(
      new CustomEvent("mautomate:gate-denied", {
        detail: atCap
          ? {
              code: "limit_reached",
              limit: "stores",
              max: 10,
              used: stores.length,
              required_plan: "scale",
              required_plan_label: "Scale",
              message:
                "You are running the maximum of 10 stores on this account.",
            }
          : {
              code: "entitlement_locked",
              feature: "multi_store",
              required_plan: "scale",
              required_plan_label: "Scale",
              message: `Your plan includes 1 store. Upgrade to Scale to run up to 10 stores - 3 are included with the plan.`,
            },
      })
    )
  }
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newSlug, setNewSlug] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState<null | "create" | "checkout">(null)
  const [err, setErr] = useState<string | null>(null)

  const submitNewStore = async () => {
    if (!token || !newSlug.trim()) {
      setErr("Choose a store address first.")
      return
    }
    setBusy(true)
    setErr(null)
    setCreating("create")
    try {
      const { createAddonStore } = await import("@lib/merchant-admin/api")
      const out = await createAddonStore(token, {
        slug: newSlug.trim().toLowerCase(),
        name: newName.trim() || undefined,
      })
      if (out.store?.id) {
        // Included with the plan — provisioned immediately; jump into it.
        setActiveStoreId(out.store.id)
        window.location.assign("/dashboard/overview")
        return
      }
      // Paid add-on: Paddle overlay first, the webhook provisions after.
      if (out.checkout_url) {
        setCreating("checkout")
        window.location.assign(out.checkout_url)
      } else {
        setCreating(null)
        setErr("Unexpected response - try again.")
      }
    } catch (e: any) {
      setCreating(null)
      setErr(e?.message ?? "Could not start store creation.")
      setBusy(false)
    }
  }
  return (
    <div className="relative">
      {creating && <StoreCreatingOverlay mode={creating} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Switch store"
        className="flex w-full items-center gap-1 rounded-base text-left outline-none transition-colors hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <h2 className="truncate text-base font-semibold text-grey-90">
          {activeName}
        </h2>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn("shrink-0 text-grey-50 transition-transform", open && "rotate-180")}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-large border border-grey-20 bg-white p-1.5 shadow-lg">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-grey-40">
            Your stores
          </p>
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.is_active) {
                  setOpen(false)
                  return
                }
                setActiveStoreId(s.id)
                window.location.assign("/dashboard/overview")
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-base px-2.5 py-2 text-left text-sm transition-colors",
                s.is_active
                  ? "bg-grey-10 font-semibold text-grey-90"
                  : "text-grey-70 hover:bg-grey-10"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{s.name}</span>
                <span className="block truncate text-[11px] font-normal text-grey-40">
                  {s.slug}.mautomate.ai
                </span>
              </span>
              {s.is_active && (
                <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              )}
            </button>
          ))}
          {!adding && (
            <button
              type="button"
              onClick={() => {
                if (!canAdd) {
                  setOpen(false)
                  raiseUpsell()
                  return
                }
                setAdding(true)
              }}
              className="mt-1 flex w-full items-center gap-1.5 rounded-base border-t border-grey-20 px-2.5 py-2 text-left text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
            >
              + New store
              <span className="ml-auto text-[11px] font-normal text-grey-40">
                {atCap
                  ? "10 of 10 used"
                  : isScale
                    ? stores.length < 3
                      ? "included with Scale"
                      : "$49/mo"
                    : "Scale plan"}
              </span>
            </button>
          )}
          {canAdd && adding && (
            <div className="mt-1 space-y-2 border-t border-grey-20 px-2.5 py-2.5">
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="store-address"
                autoComplete="off"
                className="w-full rounded-base border border-grey-20 px-2.5 py-1.5 text-sm outline-none focus:border-grey-40"
              />
              <p className="text-[11px] text-grey-40">
                {(newSlug.trim() || "store-address").toLowerCase()}.mautomate.ai
              </p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Store name (optional)"
                autoComplete="off"
                className="w-full rounded-base border border-grey-20 px-2.5 py-1.5 text-sm outline-none focus:border-grey-40"
              />
              {err && <p className="text-[11px] text-red-600">{err}</p>}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setErr(null)
                  }}
                  disabled={busy}
                  className="flex-1 rounded-base border border-grey-20 px-2 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitNewStore}
                  disabled={busy}
                  className="flex-1 rounded-base bg-grey-90 px-2 py-1.5 text-xs font-semibold text-white hover:bg-grey-80 disabled:opacity-60"
                >
                  {busy ? "Starting..." : "Create store"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
import { cn } from "@lib/util/cn"

/**
 * Unread-inbox counter for the sidebar badge: the number of conversations
 * with unread messages. Polled every 45s and re-fetched on every route
 * change, so reading a thread in the inbox clears the badge on the next
 * navigation without waiting for the timer.
 */
function useInboxUnread(token: string | null, pathname: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!token) return
    let alive = true
    const load = async () => {
      try {
        const r = await fetch(
          apiUrl("/merchant/marketing/conversations?unread=true&limit=1"),
          { headers: { authorization: `Bearer ${token}` } }
        )
        if (!r.ok) return
        const d = await r.json().catch(() => null)
        if (alive && d && typeof d.count === "number") setCount(d.count)
      } catch {
        /* keep the last known count */
      }
    }
    load()
    const timer = setInterval(load, 45_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [token, pathname])
  return count
}

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
  { href: "/dashboard/assistant", label: "Assistant", icon: Sparkles },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartBar },
  {
    id: "orders",
    label: "Orders",
    icon: DocumentText,
    children: [
      { href: "/dashboard/orders", label: "Orders", icon: DocumentText },
      { href: "/dashboard/draft-orders", label: "Draft orders", icon: PencilSquare },
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
      { href: "/dashboard/product-options", label: "Product options", icon: Swatch },
      { href: "/dashboard/gift-cards", label: "Gift cards", icon: GiftSolid },
      { href: "/dashboard/price-lists", label: "Price lists", icon: ListBullet },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: CubeSolid,
    children: [
      { href: "/dashboard/inventory", label: "Inventory", icon: CubeSolid },
      { href: "/dashboard/reservations", label: "Reservations", icon: DocumentText },
    ],
  },
  {
    id: "promotions",
    label: "Promotions",
    icon: ReceiptPercent,
    children: [
      { href: "/dashboard/promotions", label: "Promotions", icon: ReceiptPercent },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Sparkles },
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
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxSolid },
  { href: "/dashboard/contact", label: "Contact messages", icon: Envelope },
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
    ],
  },
  {
    id: "advertising",
    label: "Advertising",
    icon: ChartPie,
    children: [
      { href: "/dashboard/advertising", label: "Overview", icon: ChartPie },
      { href: "/dashboard/advertising/new", label: "New campaign", icon: Sparkles },
      { href: "/dashboard/advertising/autopilot", label: "Autopilot", icon: Robot },
      { href: "/dashboard/advertising/connect", label: "Ad accounts", icon: Globe },
    ],
  },
  // AI agents (A-6) — every AI surface reads as ONE system: chat agents
  // (the chatbots), social agents (post drafting + scheduling), the brand voice
  // they all speak in, and a link across to the voice agents that live under
  // Call Center. ROUTES ARE UNCHANGED; this only regroups the navigation.
  {
    id: "ai-agents",
    label: "AI agents",
    icon: Robot,
    children: [
      { href: "/dashboard/marketing/chatbots", label: "Chat agents", icon: ChatBubbleLeftRight },
      { href: "/dashboard/marketing/agents", label: "Social agents", icon: Robot },
      { href: "/dashboard/calls/agents", label: "Voice agents", icon: Bolt },
      { href: "/dashboard/marketing/brand-voice", label: "Brand voice", icon: Swatch },
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
      // "Agents" is NOT repeated here. It is the same route as AI agents ->
      // Voice agents (/dashboard/calls/agents), and a route listed in two groups
      // lights up BOTH of them — clicking "Voice agents" also turned Call Center
      // dark, so the nav claimed you were in two places at once. One route, one
      // owner.
    ],
  },
  { href: "/dashboard/domains", label: "Domains", icon: Globe },
  { href: "/dashboard/mobile-app", label: "Mobile App", icon: Phone },
  { href: "/dashboard/design", label: "Design", icon: Palette },
  {
    id: "blog",
    label: "Blog",
    icon: BookOpen,
    children: [
      { href: "/dashboard/blog", label: "Posts", icon: DocumentText },
      { href: "/dashboard/blog/categories", label: "Categories", icon: Tag },
    ],
  },
  { href: "/dashboard/billing", label: "Billing", icon: CurrencyDollar },
  { href: "/dashboard/referrals", label: "Refer & earn", icon: GiftSolid },
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
      { href: "/dashboard/settings/refund-reasons", label: "Refund reasons", icon: CurrencyDollar },
      { href: "/dashboard/settings/product-types", label: "Product types", icon: Tag },
      { href: "/dashboard/settings/product-tags", label: "Product tags", icon: Tag },
    ],
  },
]

// A link matches when the path is the link itself or lives under it. Several
// links can match at once - the AI agent pages sit under /dashboard/marketing/*,
// so they also match Marketing's "/dashboard/marketing" overview link, and
// "/dashboard/marketing/email/notifications" matches the email templates link.
// Only the MOST SPECIFIC (longest) matching link may be active, so exactly one
// nav entry and one group ever highlight.
function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function resolveActiveHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null
  const consider = (href: string) => {
    if (!matches(pathname, href)) return
    if (best === null || href.length > best.length) best = href
  }
  for (const item of items) {
    if ("children" in item) {
      for (const child of item.children) consider(child.href)
    } else {
      consider(item.href)
    }
  }
  return best
}

/**
 * The group that OWNS the active route — and only that one.
 *
 * `isChildActive` used to answer "does this group contain the active href?",
 * which is true for every group that lists it. With the same route in two groups
 * both rendered as active. Ownership is now singular: the FIRST group that
 * declares a route owns it, so a duplicate can never again highlight two.
 */
function owningGroupId(items: NavItem[], activeHref: string | null): string | null {
  if (activeHref === null) return null
  for (const item of items) {
    if ("children" in item && item.children.some((c) => c.href === activeHref)) {
      return item.id
    }
  }
  return null
}

/**
 * `overlay` is how the inbox borrows the main navigation back. The inbox replaces
 * this nav with its channel rail, so "Menu" in the rail mounts the very same
 * component on top of it — same links, same active state, no second copy of the
 * nav to keep in sync — and dismisses it once the merchant has gone somewhere.
 */
export function Sidebar({
  overlay = false,
  onClose,
}: {
  overlay?: boolean
  onClose?: () => void
} = {}) {
  const pathname = usePathname()
  const { me, token, logout } = useMerchantAuth()
  const [open, setOpen] = useState(false)
  const inboxUnread = useInboxUnread(token ?? null, pathname)

  const dismiss = () => {
    setOpen(false)
    onClose?.()
  }

  const activeHref = useMemo(() => resolveActiveHref(pathname, navItems), [pathname])

  const activeGroupId = useMemo(
    () => owningGroupId(navItems, activeHref),
    [activeHref]
  )

  const initiallyOpen = useMemo(() => {
    const ids = new Set<string>()
    if (activeGroupId) ids.add(activeGroupId)
    return ids
  }, [activeGroupId])

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
      {!overlay && (
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
      )}

      <aside
        id="merchant-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 w-64 transform border-r border-grey-20 bg-white transition-transform",
          overlay
            ? "z-50 translate-x-0 shadow-xl"
            : cn("z-40 lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")
        )}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-6 border-b border-grey-10 pb-5">
            {overlay && (
              <button
                type="button"
                onClick={dismiss}
                className="mb-4 flex items-center gap-1.5 rounded-base px-2 py-1 text-xs font-medium text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
              >
                <XMark className="h-4 w-4" />
                Back to the inbox
              </button>
            )}
            <div className="flex items-center gap-2">
              <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAL3ElEQVR42u2beXBV1R3HP79z78vL9pIAEgW1EpBWUbBYq7hQFRUXQECdblitTlvGpbV1rFOdWlunM606HbWj49KqU9EuUJcpjku1yqJVKaKVRaNVsaiABJKQ5OUt995f/zjnvvcSA0lqkACemTv3vXtvXs73t3x/y7lH6GGoqgFURNR9PhGYAUwGRgFDGZxjC7AWWAosBJ4VkUhVBRARiXr9BVX1Sj6fr6rLddcdy1X1/J6wbQu8785jVXVRtx8LVDVU1WgQA47cHINu1xep6thSjPGQUvAiEqjqCcCDzswDwLhjVxyRO3znHmeLyKIYa0EAqmqcrxwPPAZUOvA+u8eIsaSBM0RkcYxZYsJz5PYKUAuEgMfuNWJMrcBER5ZSatrzHPhgNwSPwxQ4jPPii8aFhjnAsbuZ2fc0fIfxWGBO7AIesAIY7wjDY/ceoSP1lcDhoqpTgH84HhD2jBFjPckAs0tCxp4yYqyzDXBc95xgDxgx1uNEVZuBukHjAqqgPRijMQM5vRhri6iqDh7DjBzQbU076ha5ByYsDBJaUgu+5SNY+Ry6/m0Ic0hVDTSMh4OPAb9swIXgDwpCVkAEFt6JPnU/NL0PUR58g3oCldUwZgIy4/vwhWN6t5T+kMFOd4EoAhH03p/DE3+AZBmM/SIcNhmpGQpbm9DXn4d1q6Eqhcy5Dg6bOmCWsHMFEIVgPHjiPvR3P4WaOmTmXJj+XWvu8cim4cm70MX3WyFcejfUjx4QIZid6/MedLSij95tgZz8DZh1CXgJK5z4SFbCmT+EI2dAy0Z06R8HbBo7UQAu1K1ZBhveg/r9kDPn2uuxcOIjCkEVmfJtSA2Dt5dDpt0K7RMasPnUtR6GXY91b0EmDZ87CFJDLSegXS0gFtiQEVA/Clo3QetGey0Kuj43qKOACHiu1orPRBZ0WdJd386UjAflVaCBBS4GPLMLhEFVC76jFV58HHIZG/qMQd9eacGr2mPxfMhnrYBEbL5mxH0WaNsM4lmSXLcS3l8JiaR1jc9Ptvf6kdT6nwp4gEwavf578O+lUFburqvVaLLCCSBEF9xkk6HycgvcE6tl31ihVKYcNyTQxiXw9B1QOxyiDHxpFnLqFRa8MIgEYAysexPeehXq93e+68hODGQ7wU+A8a1AaoZBWVlXAcSHAOoiQ6ICKmuhsga0ChoXw9HnQu3IotXtfBJ0FvDhO7B1M7Q2wdYtEOS65gLprejDt8KWjRZ4GHQlwgLRRdb8V/4d1iwBPwlB3v1WAG2buv7fgUiEwrArw3qOwDRSIo1QVQRBjGC6p6hRZHvT770BjSsg14l5ZyWy6gVo3QzVtQXzJ8xBVcppPtZ6NwvwBBIJCDPWapLOUnwf8u3I9KvhoJOLgh0IF/A8r0eheJ6H162DFstTRIiiCGOMXVhoGAcN44p/v34t5pHb4dm/Or/2IZnsvYw3ns0BypKuOFKwK1+girZu7FfR3KsA8vk8zy9aSi6XQ0QQY5h8wmSS5eV8+P6HrPjXcjau30BVdTWHHjaeQw8b7xQfFaxhxbKXaVzzOum2Nkbuty+TJh/DkBGjiC66Hhm+L8y/BVK1lhe2FdaMZ7mjrQUmToVhI2HZg7ZQkmKJL20bByYMqioiQkd7B3PP+w6bmzZjRKiqrualNSt44N7buP3mW2lpbiGKIkSE8vIkZ8yawa9vvoEhw4bS+HojV132Y5b98yWy2SyqijGGfUaO4OpfXM3Xzz+X6JwfIO+uhpefgZrabWu9sw2qqmHGD5ETzod3lqMvznfhTgtC0rZNVh59rBH83nMXIZVKkc9ZohleP5yf/+QaFjzwF2pqaxg6bChixPKEwgP3zyMMQ6674ZfMmfk11r33X+qG1JGqSaFqOaO1pYVLLryIuro6Tps5nXDWxZjXlkKk1sdLtU4E7c0w7mjkrCtgxFh7r6IGyipcSi0ltcWWPvv/dkkwtoDWllZOPOI4NjdtJpFIoKrk83mCfIC4RCXIBwWAIoKIMGpMA6v/vQpF8X2fXDZHWbKMZDKJ8Tw62to4ZMJ4HlvypOWYa78Ka9dAVZUNX2UJyLZDZRWc/h3k5Avs9TCw2WJHM3rHBZBPW1L0BEShMoWcewdU1PUpFPY7DBpjCIKA6bNn8KeFC3joyb9x7oXfIp1OY4xBVVFVVr+2iiFDh3Dtr67jkace5Y55v+eAhgPIZjJoFFFRWclbjW/yduObiDFE+421odF4NpxtbYIDJyI/ugc55cJiPRCnyhU1UFVnny2o04NcB6Sb+xwK+5UIeZ5Ha0sL02efyV0P3FO4ftSxk/jg/Q9Y/PSigiV4xuOmO3/L1GmnAfClo45g9JjRzDx5GpEqRoRcNkdLs5ts7V7FBklqCHLaj2DKN4vVoPGK6W1s7jXDoeldq+W4qxRkoL0JhjUMfDWoqogxfPfSuagquVyuQG4nnnISuVwWz/Po6Ohg/MQJTJ12GkEQEAYhYRgyfuIERo1uIJvJWPdxHGNn4nQR5pHDp8CRpxf9uLs/x6V07d4uOZJisRWGEEcCHUALECzRVVdXU7/P3ogIvu8XIkAikXCcIAT5PAc0HFDgBGMMIkIQBB9PlLr0BhUSSfTZ+fDCQth3NHLSHPjytGL3Jy6aAOpG9ghSt/Y9FzD9q2ZtctM9MyxNgEqflW4EJH3IzVG1SY4IvPFSEWB8FrE8EEXIkBEfb46KKabDg6MW+D8XbrKdcPAkOOKMrmz+0VpoXm+B1wwHr6y40hUXXh1NRWHsMusC3RsnYYDMuMQCKnR7InTBddD8ITL7Shh9BFSkLPElfOtGxoZIgqwtlHrpDfh9r+msP+dzedId6R0H3k9A8wY483sw7phi2ez56KJ58N5KqEyhf74GDvmKbYbkO7uGwsxWyLRCdX2vvRHT//Jee+SAAdG679tmyNHTkbMvd+BD6/NvLoPHb4fyatcaq4bG5622jVcM+WKsQDr6lguY/s9TtsPk2+kI9WWNoGUTHH8OMvdGByq0LfL/rkbvu8q6gxjXOY4gWdXVz9W1z8I8tG8auI5QzOjGGKIoIpvN9vyMkS7nQpMzCgtN0Pi34ucK5JZIwrevRc65zGo+iiz4t5aj914JuU6oiHN/U5IPyMcJNOqWC8gnEICqks1kyHRmUFXa29sLHFAa+oIgIJPvJJPJkMl2ksu7Ls3WLVA7tNDbz2azZDozGGPIdGaI1M3u9AuQikqbyMT9hyXz0Yd+Y7VaXu6EIn2LIm0fDUxHKAgCVr36GvkgwIgQhhEHHXIQNbW1XZofG9dvYO0775JIJMjn8+xVX8+YMQ1EvzwPM2suTJiMAqteeZXOjjSeZwjDiIMPHUeqthYVKSrqg/+gC2+DV56CqhrLDYZtd4hMyfeEB0EaDjwWOf1nvS6f7di1wUwHevmp0LwJzroYmTqnmPN3H53tsHY1+sKj8PKTdj0wVQdGe2+RlQrA9yDKwj5jkbNv7jUZ8vu2gOtCEYKihdS2u6tEUYQgqEaIMZj2VsjnrX/PvwV9ZgHRqINtG7uiyrJwpt0KaMNa2LLeLnpUp2ynNwodAOlfE9bzId0CubQlyu3EQr+vJXBfiLLQO1RHbsmKYhiqGw7pNsyrSxwflIQ/49nmZkW1NeGSDg/Gabhw9Pbdsw1TL2Fzip2SCYoUylqmzoH7bygufcUrPFK6XpiHzrzVmGdKTN6zJu6bj7tA6bXYBfz4viATz7Fp8k7lgDiHf/FxdNULRUvs6V8acUtgxr2fXvrZFO+XHlL63S2aJBLImKNh/8P71BEaXC9J7Qjh98EFWnb4a3Kxz8unWExtvxIsvCbnY18b/+IOFYDxBuursmsN8Fy/FtN2n3eFAZ4zwMODuzmyY2zSnR/e41+XNyISAjd2XWPaI16Vv1FEwtI9Q0vZ/XeNxNiex24Clc82Tbk9QyIi7wIzsVvL4g1Gu5PmPYdtpsMqIhIZV8hEbjPhYmAadpNhvMFoV95JEpWY/RZgmtsz6Mf7iE1JNRe4G4uAScBi94emxISiQU6U6uYYloQ732GZ1H3X6Gebp7eV+u5J2+f/B1WEofHV3lTqAAAAAElFTkSuQmCC"
                alt="mAutomate"
                className="h-8 w-8 shrink-0 rounded-base"
              />
              <div className="min-w-0 flex-1">
                {me?.stores && me.stores.length > 0 ? (
                  <StoreSwitcher
                    stores={me.stores}
                    activeName={me?.store.name || "Store Admin"}
                    planKey={me?.store.plan?.key ?? ""}
                    token={token ?? null}
                  />
                ) : (
                  <h2 className="truncate text-base font-semibold text-grey-90">
                    {me?.store.name || "Store Admin"}
                  </h2>
                )}
                <p className="truncate text-xs text-grey-50">{me?.merchant.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto -mr-2 pr-2" aria-label="Main navigation">
            {navItems.map((item) => {
              if ("children" in item) {
                const active = item.id === activeGroupId
                const sectionOpen = openSections.has(item.id)
                const Icon = item.icon
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSection(item.id)}
                      aria-expanded={sectionOpen}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-base px-3 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                        active
                          ? "bg-brand-50 text-grey-90 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand-500 relative"
                          : "text-grey-60 hover:bg-grey-10 hover:text-grey-90"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-brand-600" : "text-grey-40 group-hover:text-grey-90"
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
                          const childActive = child.href === activeHref
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={dismiss}
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

              const active = item.href === activeHref
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={dismiss}
                  className={cn(
                    "group flex items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                    active
                      ? "bg-brand-50 text-grey-90 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand-500 relative"
                      : "text-grey-60 hover:bg-grey-10 hover:text-grey-90"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active ? "text-brand-600" : "text-grey-40 group-hover:text-grey-90"
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/dashboard/inbox" && inboxUnread > 0 && (
                    <span
                      aria-label={`${inboxUnread} unread conversation${inboxUnread === 1 ? "" : "s"}`}
                      className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                    >
                      {inboxUnread > 99 ? "99+" : inboxUnread}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <CreditsBadge />
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            <ArrowRightOnRectangle className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      {(open || overlay) && (
        <div
          onClick={dismiss}
          className={cn(
            "fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity",
            overlay ? "z-40" : "z-30 lg:hidden"
          )}
          aria-hidden="true"
        />
      )}
    </>
  )
}
