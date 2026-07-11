/**
 * Forever Finds CMS — Blog content editor (Phase 8).
 *
 * A controlled rich-text surface for a blog post body. This build has NO TipTap
 * dependency installed (`@tiptap/*` is absent from the workspace), so per the
 * task spec this is the styled-HTML-textarea fallback: a monospace HTML textarea
 * whose raw value IS the stored `content` HTML string, plus a small toolbar that
 * wraps the current selection in common tags (h2/h3, paragraph, bold, italic,
 * blockquote, link, list) and an ImagePicker that drops an <img> at the caret.
 *
 * The textarea always stores HTML — when TipTap is later added, swap only this
 * component; the data contract (a plain HTML string) is unchanged. The storefront
 * sanitises this HTML at render time.
 *
 * Props: { value, onChange, placeholder?, disabled?, rows? }.
 */
import { Button, Textarea, clx } from "@medusajs/ui"
import { useRef } from "react"

import { ImagePicker } from "../../../components/cms/image-picker"

export type HtmlEditorProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
}

export function HtmlEditor({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 16,
}: HtmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const html = typeof value === "string" ? value : ""

  /**
   * Wrap the current textarea selection in `before`/`after` (or insert the pair
   * with the caret between them when nothing is selected) and commit the new
   * HTML. The textarea value stays the single source of truth.
   */
  const surround = (before: string, after: string, placeholderText = "") => {
    if (disabled) return
    const el = textareaRef.current
    const current = html
    if (!el) {
      onChange(current + before + placeholderText + after)
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const selected = current.slice(start, end) || placeholderText
    const next =
      current.slice(0, start) + before + selected + after + current.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      const caret = start + before.length
      node.focus()
      node.setSelectionRange(caret, caret + selected.length)
    })
  }

  const insertAtCaret = (snippet: string) => {
    if (disabled) return
    const el = textareaRef.current
    const current = html
    if (!el) {
      onChange(current + snippet)
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const next = current.slice(0, start) + snippet + current.slice(end)
    onChange(next)
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
    insertAtCaret(`\n<figure>\n  <img src="${url}" alt="" />\n</figure>\n`)
  }

  const ToolbarButton = ({
    label,
    onClick,
    title,
  }: {
    label: React.ReactNode
    onClick: () => void
    title?: string
  }) => (
    <Button
      size="small"
      variant="transparent"
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {label}
    </Button>
  )

  return (
    <div className="flex flex-col gap-y-2">
      {/* Lightweight formatting toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-ui-border-base bg-ui-bg-subtle px-2 py-1.5">
        <ToolbarButton
          label="H2"
          title="Heading"
          onClick={() => surround("<h2>", "</h2>", "Heading")}
        />
        <ToolbarButton
          label="H3"
          title="Subheading"
          onClick={() => surround("<h3>", "</h3>", "Subheading")}
        />
        <ToolbarButton
          label="P"
          title="Paragraph"
          onClick={() => surround("<p>", "</p>", "Paragraph")}
        />
        <ToolbarButton
          label={<span className="font-bold">B</span>}
          title="Bold"
          onClick={() => surround("<strong>", "</strong>", "bold")}
        />
        <ToolbarButton
          label={<span className="italic">I</span>}
          title="Italic"
          onClick={() => surround("<em>", "</em>", "italic")}
        />
        <ToolbarButton
          label="❝"
          title="Quote"
          onClick={() =>
            surround("<blockquote>", "</blockquote>", "Quote")
          }
        />
        <ToolbarButton
          label="Link"
          title="Link"
          onClick={() => surround('<a href="/">', "</a>", "link text")}
        />
        <ToolbarButton
          label="List"
          title="Bulleted list"
          onClick={() => surround("<ul>\n  <li>", "</li>\n</ul>", "List item")}
        />
      </div>

      <Textarea
        ref={textareaRef}
        value={html}
        rows={rows}
        spellCheck={false}
        disabled={disabled}
        placeholder={
          placeholder ??
          "<h2>Section heading</h2>\n<p>Write the post body here…</p>"
        }
        className={clx("rounded-t-none font-mono text-xs leading-relaxed")}
        onChange={(e) => onChange(e.target.value)}
      />

      {/* Insert image — picking one drops a <figure><img></figure> at the caret.
          The picker value is never bound (it is an insert action, not a stored
          field), so it resets after each pick. */}
      {!disabled && (
        <ImagePicker
          label="Insert image"
          hint="Pick or upload an image to drop it into the content above."
          clearable={false}
          value=""
          onChange={(url) => insertImage(url)}
        />
      )}
    </div>
  )
}

export default HtmlEditor
