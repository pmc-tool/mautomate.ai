"use client"

/* ------------------------------------------------------------------ */
/* PagePane — the dock's "Page" tab (Phase 2, 2C).                      */
/*                                                                     */
/* RE-HOUSING of the page-level affordances that were scattered across  */
/* the shell chrome: the page identity, the page switcher / new-page    */
/* flow (panel header select) and "View live" (footer strip). All       */
/* behavior arrives via callbacks the shell already owns — this file    */
/* adds no new capability.                                              */
/*                                                                     */
/* Deliberately NOT here yet: the pageSchema settings form (SEO title / */
/* description / OG image / page background). ARCH-UX §1.1 specs it,    */
/* but it needs two new backend settings keys — that is U2 build work,  */
/* not Phase 2 re-housing. This pane is its future home.                */
/* ------------------------------------------------------------------ */

import React from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  button,
  eyebrow,
  field,
  font,
  grey,
  hairline,
  type,
} from "@modules/cms/editor/design"

export type PageListItem = { slug: string; title?: string }

export default function PagePane({
  slug,
  pages,
  onGoToPage,
  onNewPage,
  liveHref,
}: {
  /** The page open in the editor. */
  slug: string
  /** All pages of the store (the shell's existing list). */
  pages: PageListItem[]
  /** Navigate the editor to another page (shell's goToPage). */
  onGoToPage: (slug: string) => void
  /** The shell's existing new-page prompt flow. */
  onNewPage: () => void
  /** The published URL of this page ("/" for home). */
  liveHref: string
}) {
  const current = pages.find((p) => p.slug === slug)
  const title = current?.title || slug
  const path = slug === "home" ? "/" : `/${slug}`

  return (
    <div style={{ fontFamily: font }}>
      {/* Identity */}
      <div style={eyebrow()}>This page</div>
      <div
        style={{
          ...type.title,
          fontFamily: font,
          color: grey[90],
          margin: "6px 0 2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>
        {path}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          margin: "12px 0 16px",
          paddingBottom: 16,
          borderBottom: hairline,
        }}
      >
        <a
          href={liveHref}
          target="_blank"
          rel="noreferrer"
          style={{
            ...button("secondary", "sm"),
            textDecoration: "none",
            flex: 1,
          }}
          title="Open the published page in a new tab"
        >
          <UiIcon name="external-link" size={13} />
          View live
        </a>
      </div>

      {/* Switch / create — the header select, re-housed */}
      <div style={eyebrow()}>All pages</div>
      <select
        value={slug}
        onChange={(e) => {
          const v = e.target.value
          if (v === "__new__") {
            onNewPage()
          } else if (v && v !== slug) {
            onGoToPage(v)
          }
        }}
        title="Switch page"
        style={{ ...field(), ...type.label, fontFamily: font, margin: "6px 0 8px" }}
      >
        {!pages.find((p) => p.slug === slug) && (
          <option value={slug}>{slug}</option>
        )}
        {pages.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.title || p.slug} (/{p.slug === "home" ? "" : p.slug})
          </option>
        ))}
        <option value="__new__">+ New page…</option>
      </select>
      <button
        onClick={onNewPage}
        style={{ ...button("ghost", "sm"), width: "100%", color: grey[60] }}
      >
        <UiIcon name="plus" size={13} />
        New page
      </button>
    </div>
  )
}
