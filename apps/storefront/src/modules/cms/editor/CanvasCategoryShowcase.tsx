"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { CATEGORY_SHOWCASE_VIEWS } from "./canvas-views"

/* ------------------------------------------------------------------ */
/* Editor-canvas preview of the category_showcase block.                */
/*                                                                      */
/* The live block is an async server component (it resolves live         */
/* category item counts + hrefs server-side). The client canvas can't    */
/* do that, so it POSTs the block's items to an editor bridge that runs   */
/* the SAME server resolver, then renders the ACTIVE theme's OWN          */
/* presentational View with the resolved tiles — REAL categories with     */
/* the REAL theme design (byte-identical to the storefront).             */
/*                                                                      */
/* - Non-learts themes (a View is registered in CATEGORY_SHOWCASE_VIEWS): */
/*   POST /api/puck/category-tiles -> resolved `tiles` -> <ThemeView/>.    */
/* - Learts / unknown themes (no View): keep the original Learts markup    */
/*   preview (renders from block data, omits live counts).                */
/* ------------------------------------------------------------------ */

interface Item {
  category_id?: string
  label?: string
  image?: string
  href?: string
}

interface CategoryTile {
  /** The tile's ORIGINAL index in props.items — dangling refs are dropped by
   *  the resolver, so render position can drift from stored position. */
  index: number
  label: string
  image: string
  href: string
  count?: number
}

export default function CanvasCategoryShowcase(props: {
  sub_title?: string
  title?: string
  items?: Item[]
  themeId?: string
  sectionScope?: string
  [k: string]: unknown
}) {
  const themeId = typeof props.themeId === "string" ? props.themeId : ""
  const ThemeView = themeId ? CATEGORY_SHOWCASE_VIEWS[themeId] : undefined

  if (ThemeView) {
    return <ThemeCategoryShowcasePreview View={ThemeView} {...props} />
  }

  return <LeartsCategoryShowcasePreview {...props} />
}

/* ---------- Theme-aware path (all non-learts themes) ---------- */

function ThemeCategoryShowcasePreview({
  View,
  sub_title,
  title,
  items,
  sectionScope,
}: {
  View: React.ComponentType<any>
  sub_title?: string
  title?: string
  items?: Item[]
  sectionScope?: string
}) {
  const search = useSearchParams()
  const key = search.get("key") || ""
  const itemList = Array.isArray(items) ? items : []
  const itemsKey = JSON.stringify(itemList)
  const [tiles, setTiles] = useState<CategoryTile[] | null>(null)

  useEffect(() => {
    let active = true
    setTiles(null)
    fetch(`/api/puck/category-tiles?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemList }),
    })
      .then((r) => (r.ok ? r.json() : { tiles: [] }))
      .then((d: { tiles?: CategoryTile[] }) => {
        if (active) setTiles(Array.isArray(d?.tiles) ? d.tiles : [])
      })
      .catch(() => active && setTiles([]))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, key])

  if (!tiles) {
    return <CategoryShowcaseSkeleton />
  }

  if (!tiles.length) {
    return null
  }

  return (
    <View
      sub_title={sub_title}
      title={title}
      tiles={tiles}
      sectionScope={sectionScope}
    />
  )
}

/* ---------- Learts fallback path (original behavior) ---------- */

const FALLBACK_IMAGES = [
  "/learts/assets/images/banner/category/banner-s5-1.webp",
  "/learts/assets/images/banner/category/banner-s5-2.webp",
  "/learts/assets/images/banner/category/banner-s5-3.webp",
  "/learts/assets/images/banner/category/banner-s5-4.webp",
  "/learts/assets/images/banner/category/banner-s5-5.webp",
]

function LeartsCategoryShowcasePreview(props: {
  sub_title?: string
  title?: string
  items?: Item[]
}) {
  const items = Array.isArray(props.items) ? props.items : []
  // Original index survives the validity filter — per-item editor ops
  // (duplicate/delete THIS tile) must address props.items, not the render row.
  const tiles = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it && (it.label || it.image))

  if (!tiles.length) {
    return null
  }

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        <div className="section-title text-center">
          {props.sub_title ? (
            <h3 className="sub-title">{props.sub_title}</h3>
          ) : null}
          {props.title ? (
            <h2 data-el="title" className="title title-icon-both">
              {props.title}
            </h2>
          ) : null}
        </div>

        <div className="row row-cols-xl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 learts-mb-n40">
          {tiles.map(({ it, i }, pos) => (
            <div className="col learts-mb-40" key={i}>
              <div
                className="category-banner5"
                data-el="tile"
                data-el-item={`items:${i}`}
              >
                <LocalizedClientLink
                  href={it.href || "/store"}
                  className="inner"
                >
                  <div className="image" data-el="image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        it.image ||
                        FALLBACK_IMAGES[pos % FALLBACK_IMAGES.length]
                      }
                      alt={it.label || ""}
                    />
                  </div>
                  <div className="content">
                    <h3 className="title" data-el="label">{it.label}</h3>
                    <span className="number" />
                  </div>
                </LocalizedClientLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Shared editor-only skeleton ---------- */

function CategoryShowcaseSkeleton() {
  return (
    <div style={{ padding: "40px 0" }}>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 24,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "4 / 5",
                background: "#f1f5f9",
                borderRadius: 8,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
