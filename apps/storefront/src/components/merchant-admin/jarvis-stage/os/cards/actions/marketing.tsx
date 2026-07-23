"use client"

/* Marketing composer previews — email + social. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Panel, Row, Tag, str, num, dateLabel } from "./_kit"

/* create_email_campaign — details:
   { subject, audience, recipients_estimate, note } */
function EmailCampaignPreview({ details }: ConfirmPreviewProps) {
  const subject = str(details.subject) ?? "Untitled campaign"
  const audience = str(details.audience)
  const reach = num(details.recipients_estimate)
  return (
    <Panel eyebrow="Email composer" accentColor={os.muted} bar>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ ...t.micro, color: os.muted }}>Subject</span>
        <span style={{ ...t.title, color: os.text }}>{subject}</span>
      </div>
      <Row label="Channel" value="Email" />
      {audience && <Row label="Audience" value={audience} />}
      <Row
        label="Recipients"
        value={reach !== null ? `~${reach.toLocaleString()}` : "—"}
        strong
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="idle">Saved to review — not sent yet</Tag>
        <Tag tone="warn">Email can't be unsent</Tag>
      </div>
    </Panel>
  )
}

/* create_social_post — { product, platform, when, schedule_at, has_caption }
   schedule_social_post — { product, platform, schedule_at, has_caption } */
function SocialPostPreview({ details }: ConfirmPreviewProps) {
  const product = str(details.product)
  const platform = str(details.platform) ?? "Social"
  const when = str(details.when)
  const scheduleAt = dateLabel(details.schedule_at)
  const hasCaption = details.has_caption === true
  const scheduled = when === "scheduled" || !!details.schedule_at

  return (
    <Panel eyebrow="Social composer" accentColor={os.muted} bar>
      <Row label="Channel" value={platform} strong />
      {product && <Row label="About" value={product} />}
      <Row
        label="When"
        value={scheduled ? scheduleAt ?? "Scheduled" : "Now"}
        strong
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone={scheduled ? "idle" : "run"}>{scheduled ? "Scheduled" : "Posts now"}</Tag>
        <Tag tone="idle">{hasCaption ? "Your caption" : "AI-written caption"}</Tag>
      </div>
    </Panel>
  )
}

registerConfirmPreview("create_email_campaign", EmailCampaignPreview)
registerConfirmPreview("create_social_post", SocialPostPreview)
registerConfirmPreview("schedule_social_post", SocialPostPreview)
