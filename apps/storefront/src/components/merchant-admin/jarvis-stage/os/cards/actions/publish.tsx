"use client"

/* Page & post publish/draft previews. */

import React from "react"
import type { ConfirmPreviewProps } from "../../card-registry"
import { registerConfirmPreview } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Panel, Row, Tag, Chips, str, list, stripHtml } from "./_kit"

function SlugLine({ slug }: { slug: string | null }) {
  if (!slug) return null
  const clean = slug.replace(/^\//, "")
  return (
    <span
      style={{
        ...t.bodyStrong,
        color: os.textDim,
        fontFeatureSettings: '"tnum" 1',
        wordBreak: "break-all",
      }}
    >
      /{clean}
    </span>
  )
}

/* publish_blog_post — { post, slug }  /  publish_page — { page, slug } */
function PublishLivePreview({ details }: ConfirmPreviewProps) {
  const title = str(details.post) ?? str(details.page) ?? "This content"
  const slug = str(details.slug)
  return (
    <Panel eyebrow="Publish · Going live" accentColor={os.emberDeep} bar>
      <Row label="Title" value={title} strong />
      <Row label="Address" value={<SlugLine slug={slug} />} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag tone="run">Live to every visitor</Tag>
      </div>
    </Panel>
  )
}

/* create_page — { title, slug, preview } */
function CreatePagePreview({ args, details }: ConfirmPreviewProps) {
  const title = str(details.title) ?? str(args.title) ?? "Untitled page"
  const slug = str(details.slug)
  const body = stripHtml(details.preview)
  return (
    <Panel eyebrow="Page · Draft" accentColor={os.muted} bar>
      <Row label="Title" value={title} strong />
      <Row label="Address" value={<SlugLine slug={slug} />} />
      {body && (
        <span
          style={{
            ...t.body,
            color: os.muted,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {body}
        </span>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <Tag tone="idle">Hidden until published</Tag>
      </div>
    </Panel>
  )
}

/* update_page — { page, slug, changes } */
function UpdatePagePreview({ details }: ConfirmPreviewProps) {
  const page = str(details.page) ?? "This page"
  const slug = str(details.slug)
  const changes = list(details.changes)
  return (
    <Panel eyebrow="Page · Edit" accentColor={os.muted} bar>
      <Row label="Page" value={page} strong />
      <Row label="Address" value={<SlugLine slug={slug} />} />
      {changes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...t.micro, color: os.muted }}>Changes</span>
          <Chips items={changes} />
        </div>
      )}
    </Panel>
  )
}

registerConfirmPreview("publish_blog_post", PublishLivePreview)
registerConfirmPreview("publish_page", PublishLivePreview)
registerConfirmPreview("create_page", CreatePagePreview)
registerConfirmPreview("update_page", UpdatePagePreview)
