/**
 * Forever Finds CMS — deal_of_day block editor (Phase 4).
 *
 * A reusable, controlled editor for `deal_of_day` section data. It is rendered
 * by the page-builder block-editor registry (registry.ts) for any section whose
 * type is "deal_of_day".
 *
 * DATA SHAPE (matches the backend block registry schema EXACTLY — see
 * modules/cms/registry/deal-of-day.ts, schemaVersion 1):
 *
 *   {
 *     image: string               // LOCALE-INVARIANT media URL (required)
 *     title: string               // i18n locale string (required)
 *     description?: string        // i18n locale string (optional)
 *     countdown_to: string        // LOCALE-INVARIANT ISO date string (required)
 *     cta: {
 *       label?: string            // i18n locale string (optional)
 *       href: string              // LOCALE-INVARIANT link target (required)
 *     }
 *   }
 *
 * LOCALIZATION CONTRACT:
 *   `locale` tells the editor which locale slice it is editing.
 *   - "en"  (default locale): the FULL editor — set the image, countdown target,
 *     link and the EN text.
 *   - non-"en" (e.g. "bn"): STRUCTURE IS LOCKED (image, countdown_to and cta.href
 *     are locale-invariant and shown read-only). Only the translatable text
 *     fields (title, description, cta.label) are editable — these become the
 *     sparse per-locale override. Leave a field blank to fall back to the
 *     English value at publish time.
 *
 * Props:
 *   value     current deal_of_day data (en payload, or the locale working copy)
 *   onChange  (data) — called with the full updated data object on every edit
 *   locale    the locale currently being edited ("en" | "bn" | ...)
 *
 * This component is import-only (lives under src/admin/components, not scanned
 * as a route) and depends only on @medusajs/ui + the shared ImagePicker.
 */
import { Input, Label, Text, Textarea, clx } from "@medusajs/ui"
import { useCallback } from "react"
import { ImagePicker } from "../image-picker"

/* ------------------------------------------------------------------ */
/* Types (mirror the backend registry deal_of_day schema)             */
/* ------------------------------------------------------------------ */

export type DealOfDayCta = {
  label?: string
  href: string
}

export type DealOfDayData = {
  image: string
  title: string
  description?: string
  countdown_to: string
  cta: DealOfDayCta
}

export type DealOfDayEditorProps = {
  value: DealOfDayData | null | undefined
  onChange: (data: DealOfDayData) => void
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Defaults & helpers                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_COUNTDOWN = "2026-07-10T00:00:00.000Z"

/** Always return a well-formed, mutable working copy of the data. */
const normalize = (value: DealOfDayData | null | undefined): DealOfDayData => ({
  image: typeof value?.image === "string" ? value.image : "",
  title: typeof value?.title === "string" ? value.title : "",
  description: typeof value?.description === "string" ? value.description : "",
  countdown_to:
    typeof value?.countdown_to === "string" && value.countdown_to
      ? value.countdown_to
      : DEFAULT_COUNTDOWN,
  cta: {
    label: typeof value?.cta?.label === "string" ? value.cta.label : "",
    href: typeof value?.cta?.href === "string" ? value.cta.href : "",
  },
})

/**
 * Convert an ISO datetime into the value a `datetime-local` input expects
 * (`YYYY-MM-DDTHH:mm`), and back. We keep storage as a full ISO string.
 */
const isoToLocalInput = (iso: string): string => {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ""
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

const localInputToIso = (local: string): string => {
  const t = Date.parse(local)
  if (Number.isNaN(t)) return ""
  return new Date(t).toISOString()
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function DealOfDayEditor({
  value,
  onChange,
  locale = "en",
}: DealOfDayEditorProps) {
  const data = normalize(value)
  const isDefaultLocale = locale === "en"
  const localeLabel = locale.toUpperCase()

  /** Emit a new data object built from an in-place mutation of a fresh copy. */
  const commit = useCallback(
    (mutate: (draft: DealOfDayData) => void) => {
      const draft = normalize(value)
      mutate(draft)
      onChange(draft)
    },
    [value, onChange]
  )

  const update = (patch: Partial<DealOfDayData>) =>
    commit((d) => {
      Object.assign(d, patch)
    })

  const updateCta = (patch: Partial<DealOfDayCta>) =>
    commit((d) => {
      d.cta = { ...d.cta, ...patch }
    })

  return (
    <div className="flex flex-col gap-y-6">
      {!isDefaultLocale && (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Editing {localeLabel} translations. The image, countdown target and
            link are managed in the EN tab — only the text is editable here.
            Leave a field empty to use the English value.
          </Text>
        </div>
      )}

      {/* Image (locale-invariant) */}
      <ImagePicker
        label="Image"
        hint="Product image shown beside the countdown (shared across all languages)."
        clearable
        disabled={!isDefaultLocale}
        value={data.image}
        onChange={(url) => update({ image: url })}
      />

      {/* Title (localized) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Title{!isDefaultLocale && ` · ${localeLabel}`}
        </Label>
        <Input
          value={data.title}
          placeholder={isDefaultLocale ? "Deal of the day" : undefined}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>

      {/* Description (localized) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Description{!isDefaultLocale && ` · ${localeLabel}`}
        </Label>
        <Textarea
          value={data.description ?? ""}
          rows={4}
          placeholder={
            isDefaultLocale
              ? "Years of experience brought about by our skilled craftsmen…"
              : undefined
          }
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>

      {/* Countdown target (locale-invariant) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Countdown ends
        </Label>
        <Input
          type="datetime-local"
          value={isoToLocalInput(data.countdown_to)}
          disabled={!isDefaultLocale}
          onChange={(e) =>
            update({
              countdown_to:
                localInputToIso(e.target.value) || DEFAULT_COUNTDOWN,
            })
          }
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          The date &amp; time the live timer counts down to (shared across all
          languages).
        </Text>
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-1.5">
          <Label size="small" weight="plus">
            CTA label{!isDefaultLocale && ` · ${localeLabel}`}
          </Label>
          <Input
            value={data.cta.label ?? ""}
            placeholder={isDefaultLocale ? "Shop Now" : undefined}
            onChange={(e) => updateCta({ label: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-y-1.5">
          <Label size="small" weight="plus">
            CTA link
          </Label>
          <Input
            value={data.cta.href}
            disabled={!isDefaultLocale}
            placeholder="/store"
            className={clx(!isDefaultLocale && "font-mono")}
            onChange={(e) => updateCta({ href: e.target.value })}
          />
          <Text size="xsmall" className="text-ui-fg-muted">
            Where the button links to (shared across all languages).
          </Text>
        </div>
      </div>
    </div>
  )
}

export default DealOfDayEditor
