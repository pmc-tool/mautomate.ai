/**
 * Forever Finds CMS — newsletter block editor (Phase 3).
 *
 * A controlled editor for the `newsletter` section data. It mirrors the backend
 * registry shape EXACTLY (src/modules/cms/registry/newsletter.ts):
 *
 *   {
 *     title: string         ·i18n
 *     subtitle?: string     ·i18n
 *     placeholder: string   ·i18n
 *     button: string        ·i18n
 *     provider_note?: string ·i18n
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - Every field on this block is TRANSLATABLE text. There is no locale-
 *     invariant structure to lock, so the editor surfaces the same controls on
 *     every locale; on a non-default locale (bn) the section translation simply
 *     stores a sparse override that is deep-merged over the en base at publish.
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }. `value` is the data object for the
 * locale being edited (full en payload, or the sparse bn override); `onChange`
 * receives the next data object.
 *
 * This file is intentionally self-contained — it only depends on @medusajs/ui.
 * ONLY this block's editor.
 */
import { Input, Label, Text, Textarea } from "@medusajs/ui"
import type { ReactNode } from "react"

import type { NewsletterData } from "../../../../modules/cms/registry/newsletter"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type NewsletterEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<NewsletterData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<NewsletterData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Small field primitives                                              */
/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  )
}

/** A translatable text input — always editable (text is localized). */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
  hint,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
  rows?: number
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      {textarea ? (
        <Textarea
          value={value ?? ""}
          rows={rows ?? 3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function NewsletterEditor({
  value,
  onChange,
  locale,
}: NewsletterEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const data: Partial<NewsletterData> = value ?? {}

  const patch = (next: Partial<NewsletterData>) =>
    onChange({ ...data, ...next })

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            every field on this block is text, so all of them are editable here.
          </Text>
        </div>
      )}

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="border-b border-ui-border-base px-4 py-3">
          <Text size="small" weight="plus">
            Newsletter
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Email signup section.
          </Text>
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          <TextField
            label="Title"
            value={data.title}
            placeholder="Sign up to Newsletter"
            onChange={(v) => patch({ title: v })}
          />
          <TextField
            label="Subtitle"
            value={data.subtitle}
            textarea
            rows={2}
            placeholder="...and receive $20 coupon for your first shopping."
            hint="Optional supporting copy shown under the title."
            onChange={(v) => patch({ subtitle: v })}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Input placeholder"
              value={data.placeholder}
              placeholder="Enter your email address"
              onChange={(v) => patch({ placeholder: v })}
            />
            <TextField
              label="Button label"
              value={data.button}
              placeholder="Subscribe"
              onChange={(v) => patch({ button: v })}
            />
          </div>
          <TextField
            label="Provider note"
            value={data.provider_note}
            placeholder="We respect your privacy. Unsubscribe at any time."
            hint="Optional small print shown beneath the form."
            onChange={(v) => patch({ provider_note: v })}
          />
        </div>
      </div>
    </div>
  )
}

export default NewsletterEditor
