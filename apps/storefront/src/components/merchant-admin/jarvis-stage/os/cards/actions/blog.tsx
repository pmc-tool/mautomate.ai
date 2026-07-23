"use client"

/* Content Studio previews for the blog writer. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Panel, Row, Chips, Tag, str, list, stripHtml, wordCount } from "./_kit"

/* create_blog_post — details: { title, excerpt, category, cover, preview } */
function CreateBlogPreview({ args, details }: ConfirmPreviewProps) {
  const title = str(details.title) ?? str(args.title) ?? "Untitled draft"
  const excerpt = str(details.excerpt)
  const category = str(details.category)
  const cover = str(details.cover)
  const bodyText = stripHtml(details.preview) || stripHtml(args.content)
  const words = wordCount(details.preview) || wordCount(args.content)

  return (
    <Panel eyebrow="Content Studio · Draft" accentColor={os.emberDeep} bar>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...t.title, color: os.text }}>{title}</span>
        {excerpt && <span style={{ ...t.body, color: os.muted }}>{excerpt}</span>}
      </div>

      {bodyText && (
        <div
          style={{
            padding: "9px 11px",
            background: "rgba(15,19,25,0.03)",
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.md,
            maxHeight: 132,
            overflow: "auto",
          }}
        >
          <span
            style={{
              ...t.body,
              color: os.textDim,
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {bodyText}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="idle">{words > 0 ? `${words} words` : "Drafting"}</Tag>
        <Tag tone="idle">Hidden until published</Tag>
        {cover && <Tag tone="run">AI cover</Tag>}
        {category && <Chips items={[category]} />}
      </div>
    </Panel>
  )
}

/* update_blog_post — details: { post, changes } */
function UpdateBlogPreview({ details }: ConfirmPreviewProps) {
  const post = str(details.post) ?? "This post"
  const changes = list(details.changes)
  return (
    <Panel eyebrow="Content Studio · Edit" accentColor={os.emberDeep} bar>
      <Row label="Post" value={post} strong />
      {changes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...t.micro, color: os.muted }}>Changes</span>
          <Chips items={changes} />
        </div>
      ) : (
        <span style={{ ...t.body, color: os.muted }}>Updating the draft.</span>
      )}
    </Panel>
  )
}

registerConfirmPreview("create_blog_post", CreateBlogPreview)
registerConfirmPreview("update_blog_post", UpdateBlogPreview)
