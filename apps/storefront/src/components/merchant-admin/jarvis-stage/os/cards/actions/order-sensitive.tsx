"use client"

/* SENSITIVE, IRREVERSIBLE order actions — refund & cancel. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t, statusTone } from "../../tokens"
import { Panel, Row, WarnBanner, Amount, str, num, money } from "./_kit"

const warn = statusTone("warn")

/* refund_order — { order_no, amount, currency, partial, note } */
function RefundPreview({ details }: ConfirmPreviewProps) {
  const orderNo = str(details.order_no)
  const amount = num(details.amount)
  const currency = str(details.currency)
  const partial = details.partial === true
  const note = str(details.note)

  return (
    <Panel eyebrow="Refund · Irreversible" accentColor={warn.fg} bar>
      <WarnBanner>This refund can't be reversed once it's sent.</WarnBanner>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ ...t.micro, color: os.muted }}>
          {partial ? "Partial refund" : "Refund amount"}
        </span>
        <Amount tone={warn.fg}>{money(amount, currency)}</Amount>
      </div>
      {orderNo && <Row label="Order" value={`#${orderNo}`} strong />}
      {note && <Row label="Note" value={note} />}
    </Panel>
  )
}

/* cancel_order — { order_no, total, currency, customer } */
function CancelPreview({ details }: ConfirmPreviewProps) {
  const orderNo = str(details.order_no)
  const total = num(details.total)
  const currency = str(details.currency)
  const customer = str(details.customer)

  return (
    <Panel eyebrow="Cancel order · Irreversible" accentColor={warn.fg} bar>
      <WarnBanner>Cancelling an order can't be undone.</WarnBanner>
      {orderNo && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ ...t.micro, color: os.muted }}>Order</span>
          <Amount tone={os.text}>{`#${orderNo}`}</Amount>
        </div>
      )}
      {total !== null && <Row label="Order total" value={money(total, currency)} strong />}
      {customer && <Row label="Customer" value={customer} />}
    </Panel>
  )
}

registerConfirmPreview("refund_order", RefundPreview)
registerConfirmPreview("cancel_order", CancelPreview)
