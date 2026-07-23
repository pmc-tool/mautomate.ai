"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Pill, CtaButton, Empty, humanize, fmtNum, tapRow, type Tone } from "./_shared"

type Product = {
  title?: string
  status?: string
  variants?: number
  variant_names?: string[]
}
type Data = { count?: number; products?: Product[] }

function statusTone(s: unknown): Tone {
  const v = String(s || "").toLowerCase()
  if (v === "published") return "success"
  if (v === "draft" || v === "proposed") return "warn"
  if (v === "rejected") return "danger"
  return "neutral"
}

export function SearchProductsBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't search your products.</Empty>
  if (!data) return <Empty>No product data.</Empty>
  const products = Array.isArray(data.products) ? data.products : []
  if (products.length === 0) return <Empty>No products found.</Empty>

  const count = data.count ?? products.length
  const more = count > products.length ? count - products.length : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {products.map((p, i) => {
        const names = Array.isArray(p.variant_names) ? p.variant_names : []
        return (
          <button
            key={i}
            type="button"
            onClick={() => send('Tell me about the product \"' + (p.title || '') + '\"')}
            style={{
              ...tapRow(),
              padding: "10px 11px",
              borderRadius: radius.md,
              border: "1px solid " + os.hairline,
              background: os.glass,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ ...t.bodyStrong, color: os.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title || "Untitled product"}
              </span>
              <Pill tone={statusTone(p.status)}>{humanize(p.status)}</Pill>
            </div>
            <div style={{ ...t.label, color: os.muted, marginTop: 4 }}>
              {fmtNum(p.variants ?? 0)} variant{(p.variants ?? 0) === 1 ? "" : "s"}
              {names.length > 0 ? " · " + names.join(", ") : ""}
            </div>
          </button>
        )
      })}
      {more > 0 && (
        <CtaButton label={"See all " + fmtNum(count) + " products"} onClick={() => send("List all my products")} />
      )}
    </div>
  )
}

registerCardBody("search_products", SearchProductsBody as CardBody)
