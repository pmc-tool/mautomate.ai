"use client"

/* Discount code preview — coupon-style. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Panel, Row, Tag, str, num, dateLabel } from "./_kit"

/* create_discount — details:
   { code, type, value, applies_to, currency, usage_limit, expires_at } */
function CreateDiscountPreview({ details }: ConfirmPreviewProps) {
  const code = str(details.code) ?? "CODE"
  const type = str(details.type) // "percentage" | "fixed"
  const value = num(details.value)
  const currency = str(details.currency)
  const appliesTo = str(details.applies_to)
  const usageLimit = num(details.usage_limit)
  const expires = dateLabel(details.expires_at)

  const valueLabel =
    value === null
      ? "—"
      : type === "percentage"
      ? `${value}% off`
      : `${currency ? currency + " " : ""}${value} off`

  const targetLabel =
    appliesTo === "shipping_methods"
      ? "Shipping"
      : appliesTo === "items"
      ? "Eligible items"
      : "Order total"

  return (
    <Panel eyebrow="Discount code" accentColor={os.emberDeep} bar>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          border: `1px dashed ${os.emberHairlineFocus}`,
          borderRadius: radius.md,
          background: os.emberSoft,
        }}
      >
        <span
          style={{
            ...t.title,
            color: os.text,
            letterSpacing: "0.06em",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {code}
        </span>
        <span style={{ ...t.title, color: os.emberDeep }}>{valueLabel}</span>
      </div>
      <Row label="Applies to" value={targetLabel} />
      <Row label="Usage" value={usageLimit !== null ? `Up to ${usageLimit}` : "Unlimited"} />
      <Row label="Expires" value={expires ?? "No expiry"} />
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone="run">Usable at checkout right away</Tag>
      </div>
    </Panel>
  )
}

registerConfirmPreview("create_discount", CreateDiscountPreview)
