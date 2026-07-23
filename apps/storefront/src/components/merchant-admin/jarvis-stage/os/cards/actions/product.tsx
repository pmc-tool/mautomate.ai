"use client"

/* Product action summaries — create, price, restock. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os } from "../../tokens"
import { Panel, Row, Tag, str, num } from "./_kit"

/* create_product — { title, price, status } */
function CreateProductPreview({ args, details }: ConfirmPreviewProps) {
  const title = str(details.title) ?? str(args.title) ?? "New product"
  const price = str(details.price)
  const status = str(details.status)
  return (
    <Panel eyebrow="New product" accentColor={os.emberDeep} bar>
      <Row label="Name" value={title} strong />
      {price && <Row label="Price" value={price} strong />}
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone={status === "published" ? "ok" : "idle"}>
          {status === "published" ? "Published — buyable" : status ?? "Draft"}
        </Tag>
      </div>
    </Panel>
  )
}

/* set_product_price — { product, variants, price } */
function SetPricePreview({ details }: ConfirmPreviewProps) {
  const product = str(details.product) ?? "This product"
  const variants = num(details.variants)
  const price = str(details.price)
  return (
    <Panel eyebrow="Set price" accentColor={os.emberDeep} bar>
      <Row label="Product" value={product} strong />
      <Row label="New price" value={price ?? "—"} strong />
      {variants !== null && (
        <Row label="Variants" value={`${variants} ${variants === 1 ? "variant" : "variants"}`} />
      )}
    </Panel>
  )
}

/* restock_variant — { product, variants, quantity } */
function RestockPreview({ details }: ConfirmPreviewProps) {
  const product = str(details.product) ?? "This product"
  const variants = num(details.variants)
  const quantity = num(details.quantity)
  return (
    <Panel eyebrow="Restock" accentColor={os.emberDeep} bar>
      <Row label="Product" value={product} strong />
      <Row label="New quantity" value={quantity !== null ? String(quantity) : "—"} strong />
      {variants !== null && (
        <Row label="Variants" value={`${variants} ${variants === 1 ? "variant" : "variants"}`} />
      )}
    </Panel>
  )
}

registerConfirmPreview("create_product", CreateProductPreview)
registerConfirmPreview("set_product_price", SetPricePreview)
registerConfirmPreview("restock_variant", RestockPreview)
