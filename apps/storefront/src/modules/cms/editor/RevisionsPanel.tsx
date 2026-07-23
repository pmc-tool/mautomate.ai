"use client"

/* ------------------------------------------------------------------ */
/* RevisionsPanel — the "Versions" tab of the dock's History panel      */
/* (Phase 4, 4D — ARCH-UX §5.4).                                        */
/*                                                                      */
/* History of this file: it began as a modal slide-over; 2C re-housed   */
/* its version list into the dock (HistoryPane) and the slide-over was  */
/* retired. 4D completes the move: this file now IS the versions list — */
/* the exact list 2C carried, unchanged in behavior — and HistoryPane   */
/* mounts it as History's second tab beside the new Actions list.       */
/*                                                                      */
/* Same endpoint (/api/puck/versions), same Live badge, same            */
/* Restore -> review -> Publish flow, same confirm copy.                */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  button,
  eyebrow,
  font,
  grey,
  hairline,
  radius,
  semantic,
  type,
} from "@modules/cms/editor/design"

type Version = {
  version: number
  is_live: boolean
  published_by: string | null
  created_at: string
}

/** Relative timestamp shared with the Actions tab ("4 min ago"). */
export function relTime(iso: string | number): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return d === 1 ? "yesterday" : `${d} days ago`
}

export function RevisionsPanel({
  slug,
  locale,
  editorKey,
  onRestored,
}: {
  slug: string
  locale: string
  editorKey: string
  /** The draft was replaced by the restored version; reload the editor. */
  onRestored: (version: number) => void
}) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setVersions(null)
    setErr(null)
    let alive = true
    fetch(
      `/api/puck/versions?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(
        locale
      )}&key=${encodeURIComponent(editorKey)}`
    )
      .then((r) => r.json())
      .then(
        (b) => alive && setVersions(Array.isArray(b?.versions) ? b.versions : [])
      )
      .catch(() => alive && setErr("Couldn't load version history."))
    return () => {
      alive = false
    }
  }, [slug, locale, editorKey])

  useEffect(() => load(), [load])

  const restore = async (v: number) => {
    if (
      !confirm(
        `Restore version ${v}? It replaces your current draft — review it, then Publish to make it live.`
      )
    ) {
      return
    }
    setBusy(v)
    setErr(null)
    try {
      const r = await fetch(
        `/api/puck/versions?key=${encodeURIComponent(editorKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, locale, version: v }),
        }
      )
      if (!r.ok) throw new Error()
      setBusy(null)
      onRestored(v)
      load()
    } catch {
      setErr("Restore failed. Please try again.")
      setBusy(null)
    }
  }

  const note: React.CSSProperties = {
    ...type.body,
    fontFamily: font,
    color: grey[50],
  }

  return (
    <div style={{ fontFamily: font }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={eyebrow()}>Published versions</span>
        <button
          onClick={load}
          title="Refresh"
          aria-label="Refresh version list"
          style={{
            border: 0,
            background: "none",
            color: grey[50],
            cursor: "pointer",
            display: "inline-flex",
            padding: 2,
          }}
        >
          <UiIcon name="reset" size={13} />
        </button>
      </div>

      {err && (
        <div style={{ ...type.body, fontFamily: font, padding: "8px 0", color: semantic.dangerFg }}>
          {err}
        </div>
      )}
      {versions === null && !err && (
        <div style={{ ...note, padding: "8px 0" }}>Loading…</div>
      )}
      {versions && versions.length === 0 && (
        <div style={{ ...note, padding: "8px 0" }}>
          No published versions yet. Once you Publish, each version appears
          here and you can restore any of them.
        </div>
      )}
      {versions &&
        versions.map((v) => (
          <div
            key={v.version}
            style={{
              padding: "10px 0",
              borderBottom: hairline,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                ...type.label,
                fontFamily: font,
                fontWeight: 600,
                width: 32,
                height: 32,
                borderRadius: radius.pill,
                background: v.is_live ? semantic.successBg : grey[10],
                color: v.is_live ? semantic.successFg : grey[60],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              v{v.version}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  ...type.bodyStrong,
                  fontFamily: font,
                  color: grey[90],
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Version {v.version}
                {v.is_live && (
                  <span
                    style={{
                      ...type.micro,
                      fontFamily: font,
                      color: semantic.successFg,
                      background: semantic.successBg,
                      border: `1px solid ${semantic.successBorder}`,
                      borderRadius: radius.pill,
                      padding: "1px 6px",
                    }}
                  >
                    Live
                  </span>
                )}
              </div>
              <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>
                {relTime(v.created_at)}
                {v.published_by ? ` · ${v.published_by}` : ""}
              </div>
            </div>
            {!v.is_live && (
              <button
                onClick={() => restore(v.version)}
                disabled={busy === v.version}
                style={{
                  ...button("secondary", "sm"),
                  cursor: busy === v.version ? "default" : "pointer",
                  opacity: busy === v.version ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <UiIcon name="reset" size={14} />
                {busy === v.version ? "Restoring…" : "Restore"}
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
