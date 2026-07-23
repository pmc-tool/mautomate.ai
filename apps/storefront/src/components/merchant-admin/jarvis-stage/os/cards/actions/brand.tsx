"use client"

/* Brand previews — logo generation, set logo, theme switch. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Panel, Row, Tag, str, num } from "./_kit"

/* generate_logo — { brief, count, note } */
function GenerateLogoPreview({ details }: ConfirmPreviewProps) {
  const brief = str(details.brief)
  const count = num(details.count) ?? 1
  return (
    <Panel eyebrow="Logo generator · AI" accentColor={os.emberDeep} bar>
      {brief && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...t.micro, color: os.muted }}>Brief</span>
          <span style={{ ...t.body, color: os.textDim }}>{brief}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Array.from({ length: Math.min(Math.max(count, 1), 6) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.md,
              border: `1px dashed ${os.emberHairlineFocus}`,
              background: os.emberSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: os.faint,
              ...t.micro,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="run">Uses AI image credits</Tag>
        <Tag tone="idle">Nothing changes until you apply one</Tag>
      </div>
    </Panel>
  )
}

/* set_logo — { logo_url, replacing } */
function SetLogoPreview({ details }: ConfirmPreviewProps) {
  const url = str(details.logo_url)
  const replacing = str(details.replacing)
  return (
    <Panel eyebrow="Set store logo" accentColor={os.emberDeep} bar>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {url ? (
          <img
            src={url}
            alt="New logo"
            style={{
              width: 64,
              height: 64,
              objectFit: "contain",
              borderRadius: radius.md,
              border: `1px solid ${os.hairline}`,
              background: os.glassSolid,
              padding: 4,
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              border: `1px solid ${os.hairline}`,
              background: os.emberSoft,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...t.bodyStrong, color: os.text }}>New logo</span>
          <span style={{ ...t.label, color: os.muted }}>
            {replacing ? "Replaces your current logo" : "Sets your store logo"}
          </span>
        </div>
      </div>
    </Panel>
  )
}

/* switch_theme — { theme, theme_id, engine, mode, from } */
function SwitchThemePreview({ details }: ConfirmPreviewProps) {
  const theme = str(details.theme) ?? "New theme"
  const from = str(details.from)
  const mode = str(details.mode) // "fresh" | "keep"
  const engine = str(details.engine)
  return (
    <Panel eyebrow="Switch theme · Live storefront" accentColor={os.emberDeep} bar>
      <Row label="New theme" value={theme} strong />
      {from && <Row label="Current" value={from} />}
      {engine && <Row label="Engine" value={engine} />}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="run">Changes how your store looks to everyone</Tag>
        <Tag tone="idle">
          {mode === "keep" ? "Keeps your home content" : "Resets home (restorable)"}
        </Tag>
      </div>
    </Panel>
  )
}

registerConfirmPreview("generate_logo", GenerateLogoPreview)
registerConfirmPreview("set_logo", SetLogoPreview)
registerConfirmPreview("switch_theme", SwitchThemePreview)
