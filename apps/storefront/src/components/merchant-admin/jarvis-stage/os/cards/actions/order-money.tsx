"use client"

/* Money & fulfilment summaries — mark paid, capture, fulfil. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Panel, Row, Tag, Amount, str, num, money } from "./_kit"

/* mark_order_paid — { order_no, mode, outstanding, currency, captures? } */
function MarkPaidPreview({ details }: ConfirmPreviewProps) {
  const orderNo = str(details.order_no)
  const amount = num(details.outstanding)
  const currency = str(details.currency)
  const mode = str(details.mode)
  return (
    <Panel eyebrow="Mark as paid" accentColor={os.successFg} bar>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...t.micro, color: os.muted }}>Outstanding</span>
        <Amount tone={os.successFg}>{money(amount, currency)}</Amount>
      </div>
      {orderNo && <Row label="Order" value={`#${orderNo}`} strong />}
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone="ok">{mode === "capture" ? "Captures payment" : "Records as collected"}</Tag>
      </div>
    </Panel>
  )
}

/* capture_payment — { order_no, amount, currency, partial } */
function CapturePreview({ details }: ConfirmPreviewProps) {
  const orderNo = str(details.order_no)
  const amount = num(details.amount)
  const currency = str(details.currency)
  const partial = details.partial === true
  return (
    <Panel eyebrow="Capture payment" accentColor={os.successFg} bar>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...t.micro, color: os.muted }}>{partial ? "Partial capture" : "Capture"}</span>
        <Amount tone={os.successFg}>{money(amount, currency)}</Amount>
      </div>
      {orderNo && <Row label="Order" value={`#${orderNo}`} strong />}
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone="warn">A capture can't be reversed — refund instead</Tag>
      </div>
    </Panel>
  )
}

/* fulfil_order — { order_no, items, tracking_number } */
function FulfilPreview({ details }: ConfirmPreviewProps) {
  const orderNo = str(details.order_no)
  const items = num(details.items)
  const tracking = str(details.tracking_number)
  return (
    <Panel eyebrow="Fulfil order" accentColor={os.muted} bar>
      {orderNo && <Row label="Order" value={`#${orderNo}`} strong />}
      <Row
        label="Items"
        value={items !== null ? `${items} ${items === 1 ? "item" : "items"}` : "—"}
      />
      <Row label="Tracking" value={tracking ?? "None"} />
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone="ok">Marks ready to ship</Tag>
      </div>
    </Panel>
  )
}

registerConfirmPreview("mark_order_paid", MarkPaidPreview)
registerConfirmPreview("capture_payment", CapturePreview)
registerConfirmPreview("fulfil_order", FulfilPreview)
