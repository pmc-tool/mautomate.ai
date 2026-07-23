"use client"

/* Ad Campaign Builder previews. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Panel, Row, Tag, Chips, Amount, str, num, list, money } from "./_kit"

/* create_ad_campaign — details:
   { product, daily_budget, currency, countries, objective, goal, starts } */
function CreateAdPreview({ details }: ConfirmPreviewProps) {
  const product = str(details.product)
  const budget = num(details.daily_budget)
  const currency = str(details.currency)
  const countries = list(details.countries)
  const objective = str(details.objective) ?? str(details.goal)
  const starts = str(details.starts)

  return (
    <Panel eyebrow="Ad Campaign Builder" accentColor={os.emberDeep} bar>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...t.micro, color: os.muted }}>Daily budget</span>
        <Amount tone={os.emberDeep}>
          {budget !== null ? `${money(budget, currency)}/day` : "—"}
        </Amount>
      </div>
      {product && <Row label="Promoting" value={product} strong />}
      {objective && <Row label="Objective" value={objective} />}
      {countries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...t.micro, color: os.muted }}>Audience</span>
          <Chips items={countries} />
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone={starts === "paused" ? "idle" : "run"}>
          {starts === "paused" ? "Starts paused — review before launch" : "Ready"}
        </Tag>
      </div>
    </Panel>
  )
}

/* launch_ad_campaign — details:
   { campaign, daily_budget, currency, platform, simulated } */
function LaunchAdPreview({ details }: ConfirmPreviewProps) {
  const campaign = str(details.campaign) ?? "This campaign"
  const budget = num(details.daily_budget)
  const currency = str(details.currency)
  const platform = str(details.platform)
  const simulated = details.simulated === true

  return (
    <Panel eyebrow="Launch Campaign · Going live" accentColor={os.emberDeep} bar>
      <Row label="Campaign" value={campaign} strong />
      {platform && <Row label="Platform" value={platform} />}
      <Row
        label="Spend"
        value={budget !== null ? `${money(budget, currency)}/day` : "Its set budget"}
        strong
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="run">Goes live &amp; starts spending</Tag>
        {simulated && <Tag tone="idle">Demo mode — no real money</Tag>}
      </div>
    </Panel>
  )
}

registerConfirmPreview("create_ad_campaign", CreateAdPreview)
registerConfirmPreview("launch_ad_campaign", LaunchAdPreview)
