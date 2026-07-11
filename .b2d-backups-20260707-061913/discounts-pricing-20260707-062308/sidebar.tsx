"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
  Tag,
  Folder,
  ChevronDown,
  BuildingStorefront,
  GlobeEuropeAfrica,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"

type NavItem =
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
  | {
      label: string
      icon: React.ComponentType<{ className?: string }>
      children: { href: string; label: string }[]
    }

const navItems: NavItem[] = [
  { href: "/merchant-admin/overview", label: "Overview", icon: House },
  { href: "/merchant-admin/products", label: "Products", icon: CubeSolid },
  { href: "/merchant-admin/categories", label: "Categories", icon: Tag },
  { href: "/merchant-admin/collections", label: "Collections", icon: Folder },
  { href: "/merchant-admin/orders", label: "Orders", icon: DocumentText },
  { href: "/merchant-admin/customers", label: "Customers", icon: Users },
  { href: "/merchant-admin/customer-groups", label: "Customer groups", icon: Users },
  { href: "/merchant-admin/design", label: "Design", icon: Palette },
  { href: "/merchant-admin/domains", label: "Domains", icon: Globe },
  {
    label: "Settings",
    icon: CogSixTooth,
    children: [
      { href: "/merchant-admin/settings", label: "General" },
      { href: "/merchant-admin/settings/store", label: "Store" },
      { href: "/merchant-admin/settings/regions", label: "Regions" },
    ],
  },
  { href: "/merchant-admin/marketing", label: "Marketing", icon: RocketLaunch },
  { href: "/merchant-admin/calls", label: "Call Center", icon: ChatBubbleLeftRight },
]

export function Sidebar() {
  const pathname = usePathname()
  const { me, logout } = useMerchantAuth()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/merchant-admin/settings/")
  )

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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-grey-90 text-white">
                <span className="text-xs font-bold">B2D</span>
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-grey-90">
                  {me?.store.name || "Store Admin"}
                </h2>
                <p className="truncate text-xs text-grey-50">{me?.merchant.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              if ("children" in item) {
                const active = item.children.some(
                  (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
                )
                const Icon = item.icon
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((s) => !s)}
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
                          settingsOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {settingsOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-grey-20 pl-2">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "block rounded-base px-3 py-2 text-sm font-medium transition-colors",
                                childActive
                                  ? "bg-grey-10 text-grey-90"
                                  : "text-grey-60 hover:bg-grey-5 hover:text-grey-90"
                              )}
                              aria-current={childActive ? "page" : undefined}
                            >
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
