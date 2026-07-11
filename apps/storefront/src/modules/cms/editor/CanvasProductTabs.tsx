"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsProductTabs from "@modules/home/components/learts/product-tabs"
import { PRODUCT_TABS_VIEWS } from "./canvas-views"

/* ------------------------------------------------------------------ */
/* Editor-canvas preview of the product_tabs block.                     */
/*                                                                      */
/* The live block is an async server component (it fetches region-scoped */
/* products server-side). The client canvas can't do that, so it POSTs   */
/* the block's tab config to an editor bridge that runs the SAME server  */
/* fetch, then renders the ACTIVE theme's OWN presentational View with    */
/* the resolved data — so the editor previews REAL products with the      */
/* REAL theme design (byte-identical to the storefront), not a Learts     */
/* stand-in.                                                             */
/*                                                                      */
/* - Non-learts themes (a View is registered in PRODUCT_TABS_VIEWS):      */
/*   POST /api/puck/product-tab-groups -> generic per-tab `groups` ->      */
/*   render <ThemeView groups .../>.                                      */
/* - Learts / unknown themes (no View): keep the original behavior —      */
/*   POST /api/puck/products -> Learts slots -> <LeartsProductTabs/>.      */
/* ------------------------------------------------------------------ */

type ProductTabGroup = {
  label: string
  products: HttpTypes.StoreProduct[]
}

type Slots = {
  newArrivals: HttpTypes.StoreProduct[]
  saleItems: HttpTypes.StoreProduct[]
  bestSellers: HttpTypes.StoreProduct[]
}

const EMPTY_SLOTS: Slots = { newArrivals: [], saleItems: [], bestSellers: [] }

export default function CanvasProductTabs(props: {
  tabs?: unknown
  themeId?: string
  sub_title?: string
  title?: string
  sectionScope?: string
  [k: string]: unknown
}) {
  const themeId = typeof props.themeId === "string" ? props.themeId : ""
  const ThemeView = themeId ? PRODUCT_TABS_VIEWS[themeId] : undefined

  // Non-learts theme: render its own View from generic per-tab groups.
  if (ThemeView) {
    return (
      <ThemeProductTabsPreview
        View={ThemeView}
        tabs={props.tabs}
        sub_title={props.sub_title}
        title={props.title}
        sectionScope={props.sectionScope}
      />
    )
  }

  // Learts / unknown: keep the original Learts slots preview.
  return <LeartsProductTabsPreview tabs={props.tabs} />
}

/* ---------- Theme-aware path (all non-learts themes) ---------- */

function ThemeProductTabsPreview({
  View,
  tabs,
  sub_title,
  title,
  sectionScope,
}: {
  View: React.ComponentType<any>
  tabs?: unknown
  sub_title?: string
  title?: string
  sectionScope?: string
}) {
  const search = useSearchParams()
  const key = search.get("key") || ""
  const tabList = Array.isArray(tabs) ? tabs : []
  const tabsKey = JSON.stringify(tabList)
  const [groups, setGroups] = useState<ProductTabGroup[] | null>(null)

  useEffect(() => {
    let active = true
    setGroups(null)
    fetch(`/api/puck/product-tab-groups?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: tabList }),
    })
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d: { groups?: ProductTabGroup[] }) => {
        if (active) setGroups(Array.isArray(d?.groups) ? d.groups : [])
      })
      .catch(() => active && setGroups([]))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey, key])

  if (!groups) {
    return <ProductTabsSkeleton />
  }

  const hasProducts = groups.some((g) => g.products.length > 0)
  if (!hasProducts) {
    return (
      <EmptyState label="Product Tabs — no products match the current tab settings." />
    )
  }

  return (
    <View
      groups={groups}
      sub_title={sub_title}
      title={title}
      sectionScope={sectionScope}
    />
  )
}

/* ---------- Learts fallback path (original behavior) ---------- */

function LeartsProductTabsPreview({ tabs }: { tabs?: unknown }) {
  const search = useSearchParams()
  const key = search.get("key") || ""
  const [slots, setSlots] = useState<Slots | null>(null)

  const tabList = Array.isArray(tabs) ? tabs : []
  const tabsKey = JSON.stringify(tabList)

  useEffect(() => {
    let active = true
    setSlots(null)
    fetch(`/api/puck/products?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: tabList }),
    })
      .then((r) => (r.ok ? r.json() : EMPTY_SLOTS))
      .then((d: Slots) => {
        if (active) setSlots(d ?? EMPTY_SLOTS)
      })
      .catch(() => active && setSlots(EMPTY_SLOTS))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey, key])

  if (!slots) {
    return <ProductTabsSkeleton learts />
  }

  const empty =
    !slots.newArrivals.length &&
    !slots.saleItems.length &&
    !slots.bestSellers.length

  if (empty) {
    return (
      <div
        className="section section-padding bg-white learts-theme"
        style={{ textAlign: "center", color: "#94a3b8", fontSize: 14 }}
      >
        Product Tabs — no products match the current tab settings.
      </div>
    )
  }

  return (
    <LeartsProductTabs
      newArrivals={slots.newArrivals}
      saleItems={slots.saleItems}
      bestSellers={slots.bestSellers}
    />
  )
}

/* ---------- Shared editor-only chrome ---------- */

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "#94a3b8",
        fontSize: 14,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {label}
    </div>
  )
}

/** Lightweight skeleton shown while the products load. */
function ProductTabsSkeleton({ learts }: { learts?: boolean }) {
  return (
    <div
      className={learts ? "section section-padding bg-white learts-theme" : ""}
      style={learts ? undefined : { padding: "40px 0" }}
    >
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 24,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: "#f1f5f9",
                  borderRadius: 8,
                }}
              />
              <div
                style={{
                  height: 12,
                  background: "#f1f5f9",
                  borderRadius: 4,
                  margin: "12px 0 6px",
                  width: "70%",
                }}
              />
              <div
                style={{
                  height: 12,
                  background: "#f1f5f9",
                  borderRadius: 4,
                  width: "40%",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
