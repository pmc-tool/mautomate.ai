/**
 * Forever Finds CMS — rich_text block editor (Phase 4).
 *
 * A controlled editor for the `rich_text` section data. It mirrors the backend
 * registry shape EXACTLY (src/modules/cms/registry/rich-text.ts, schemaVersion 1):
 *
 *   {
 *     html: string                                   ·i18n (required)
 *     width?: "narrow" | "normal" | "wide" | "full"  (locale-invariant)
 *   }
 *
 * EDITOR SURFACE:
 *   This build has NO TipTap dependency installed (`@tiptap/*` is absent from the
 *   workspace), so per the block spec this editor uses the styled-textarea
 *   fallback: a monospace HTML textarea whose raw value IS the stored `html`
 *   string, plus a small toolbar that wraps the current selection in common tags
 *   (bold, italic, h2, paragraph, link, list). The textarea always stores HTML —
 *   when TipTap is later added, swap only the EditorSurface below; the data
 *   contract is unchanged. Image insertion uses the shared ImagePicker (it
 *   appends an <img> tag at the caret).
 *
 * LOCALIZATION CONTRACT (phase-0-architecture.md §2):
 *   - `width` is locale-invariant STRUCTURE: editable ONLY on the default locale
 *     (en); rendered read-only on a non-default locale (bn).
 *   - `html` is TRANSLATABLE: editable on every locale. On a non-default locale
 *     the textarea holds that locale's sparse override (leave empty to fall back
 *     to the English body at publish time).
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }. Self-contained — depends only on
 * @medusajs/ui, @medusajs/icons and the shared ImagePicker.
 */
import {
  Button,
  Label,
  Select,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui"
import { useCallback, useRef } from "react"

import { ImagePicker } from "../image-picker"
import {
  RICH_TEXT_WIDTHS,
  type RichTextData,
  type RichTextWidth,
} from "../../../../modules/cms/registry/rich-text"

const DEFAULT_LOCALE = "en"
const DEFAULT_WIDTH: RichTextWidth = "normal"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type RichTextEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<RichTextData> | null | undefined
  /** Receives the next data object on every edit. */
  onChange: (next: Partial<RichTextData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const WIDTH_LABELS: Record<RichTextWidth, string> = {
  narrow: "Narrow (centered reading column)",
  normal: "Normal (standard container)",
  wide: "Wide (full-bleed with gutters)",
  full: "Full (edge to edge)",
}

const normalizeWidth = (w: unknown): RichTextWidth =>
  (RICH_TEXT_WIDTHS as readonly string[]).includes(w as string)
    ? (w as RichTextWidth)
    : DEFAULT_WIDTH

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function RichTextEditor({
  value,
  onChange,
  locale,
}: RichTextEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const localeLabel = (locale ?? DEFAULT_LOCALE).toUpperCase()

  const data: Partial<RichTextData> = value ?? {}
  const html = typeof data.html === "string" ? data.html : ""
  const width = normalizeWidth(data.width)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const patch = useCallback(
    (next: Partial<RichTextData>) => onChange({ ...data, ...next }),
    [data, onChange]
  )

  const setHtml = (next: string) => patch({ html: next })
  const setWidth = (next: RichTextWidth) => patch({ width: next })

  /**
   * Wrap the current textarea selection in `before`/`after` (or, when nothing is
   * selected, insert the pair with the caret between them) and commit the new
   * HTML string. Keeps the textarea value as the single source of truth.
   */
  const surround = (before: string, after: string, placeholder = "") => {
    const el = textareaRef.current
    const current = html
    if (!el) {
      setHtml(current + before + placeholder + after)
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const selected = current.slice(start, end) || placeholder
    const next =
      current.slice(0, start) + before + selected + after + current.slice(end)
    setHtml(next)
    // Restore a sensible caret/selection after React re-renders.
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      const caret = start + before.length
      node.focus()
      node.setSelectionRange(caret, caret + selected.length)
    })
  }

  const insertAtCaret = (snippet: string) => {
    const el = textareaRef.current
    const current = html
    if (!el) {
      setHtml(current + snippet)
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const next = current.slice(0, start) + snippet + current.slice(end)
    setHtml(next)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      const caret = start + snippet.length
      node.focus()
      node.setSelectionRange(caret, caret)
    })
  }

  const insertImage = (url: string) => {
    if (!url) return
    insertAtCaret(`\n<img src="${url}" alt="" />\n`)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{localeLabel}</span>{" "}
            — only the content body is editable. The container width is shared
            with the default language and stays locked. Leave the body empty to
            use the English content.
          </Text>
        </div>
      )}

      {/* Container width (locale-invariant) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Container width
        </Label>
        <Select
          value={width}
          disabled={!isDefault}
          onValueChange={(v) => setWidth(normalizeWidth(v))}
        >
          <Select.Trigger>
            <Select.Value placeholder="Select width" />
          </Select.Trigger>
          <Select.Content>
            {RICH_TEXT_WIDTHS.map((w) => (
              <Select.Item key={w} value={w}>
                {WIDTH_LABELS[w]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Text size="xsmall" className="text-ui-fg-muted">
          How wide the text column renders (shared across all languages).
        </Text>
      </div>

      {/* Content body (localized HTML) */}
      <div className="flex flex-col gap-y-1.5">
        <div className="flex items-center justify-between gap-x-2">
          <Label size="small" weight="plus">
            Content{!isDefault && ` · ${localeLabel}`}
          </Label>
        </div>

        {/* Lightweight formatting toolbar (wraps the textarea selection) */}
        <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-ui-border-base bg-ui-bg-subtle px-2 py-1.5">
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => surround("<h2>", "</h2>", "Heading")}
          >
            H2
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => surround("<h3>", "</h3>", "Subheading")}
          >
            H3
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => surround("<p>", "</p>", "Paragraph")}
          >
            P
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => surround("<strong>", "</strong>", "bold")}
          >
            <span className="font-bold">B</span>
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => surround("<em>", "</em>", "italic")}
          >
            <span className="italic">I</span>
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() =>
              surround('<a href="/store">', "</a>", "link text")
            }
          >
            Link
          </Button>
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() =>
              surround("<ul>\n  <li>", "</li>\n</ul>", "List item")
            }
          >
            List
          </Button>
        </div>

        <Textarea
          ref={textareaRef}
          value={html}
          rows={14}
          spellCheck={false}
          placeholder={
            isDefault
              ? "<h2>Our Story</h2>\n<p>Write your content here…</p>"
              : "Leave empty to use the English content."
          }
          className={clx(
            "rounded-t-none font-mono text-xs leading-relaxed",
          )}
          onChange={(e) => setHtml(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          Accepts simple HTML (headings, paragraphs, lists, links, bold/italic,
          images). Scripts, styles and inline event handlers are stripped when
          the page is published.
        </Text>
      </div>

      {/* Insert image — picking one appends an <img> tag at the caret. The
          picker value is intentionally never bound (it is an insert action,
          not a stored field), so it resets after each pick. */}
      <ImagePicker
        label="Insert image"
        hint="Pick or upload an image to drop an <img> tag into the content above."
        clearable={false}
        value=""
        onChange={(url) => insertImage(url)}
      />
    </div>
  )
}

export default RichTextEditor
