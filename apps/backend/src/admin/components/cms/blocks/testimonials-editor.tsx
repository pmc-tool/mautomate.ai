/**
 * Forever Finds CMS — Testimonials block editor (Phase 4).
 *
 * A controlled editor for `testimonials` section data. It is rendered by the
 * page-builder block-editor registry (registry.ts) for any section whose type
 * is "testimonials".
 *
 * DATA SHAPE (matches the backend block registry schema EXACTLY — see
 * modules/cms/registry/testimonials.ts, schemaVersion 1):
 *
 *   {
 *     title?: string              // i18n locale string (optional) — section heading
 *     items: Array<{
 *       quote: string             // i18n locale string (required)
 *       author: string            // LOCALE-INVARIANT person name (required)
 *       role?: string             // i18n locale string (optional)
 *       avatar?: string           // LOCALE-INVARIANT media URL (optional)
 *     }>
 *   }
 *
 * LOCALIZATION CONTRACT (phase-0-architecture.md §2):
 *   `locale` tells the editor which locale slice it is editing.
 *   - "en"  (default locale): the FULL structural editor — add / remove /
 *     reorder items, set avatars + author names, plus the EN text.
 *   - non-"en" (e.g. "bn"): STRUCTURE IS LOCKED (item count, order, avatars and
 *     author names are locale-invariant and shown read-only). Only the
 *     translatable text fields (title, quote, role) are editable — these become
 *     the sparse per-locale override. Leave a field blank to fall back to the
 *     English value at publish time.
 *
 * Props:
 *   value     current testimonials data (en payload, or the locale working copy)
 *   onChange  (data) — called with the full updated data object on every edit
 *   locale    the locale currently being edited ("en" | "bn" | ...)
 *
 * This component is import-only (lives under src/admin/components, not scanned
 * as a route) and depends only on @medusajs/ui + the shared ImagePicker.
 */
import {
  Button,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import { useCallback } from "react"
import { ImagePicker } from "../image-picker"

/* ------------------------------------------------------------------ */
/* Types (mirror the backend registry testimonials schema)            */
/* ------------------------------------------------------------------ */

export type TestimonialItem = {
  quote: string
  author: string
  role?: string
  avatar?: string
}

export type TestimonialsData = {
  title?: string
  items: TestimonialItem[]
}

export type TestimonialsEditorProps = {
  value: TestimonialsData | null | undefined
  onChange: (data: TestimonialsData) => void
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Defaults & helpers                                                  */
/* ------------------------------------------------------------------ */

const emptyItem = (): TestimonialItem => ({
  quote: "",
  author: "",
  role: "",
  avatar: "",
})

/** Always return a well-formed, mutable working copy of the data. */
const normalize = (
  value: TestimonialsData | null | undefined
): TestimonialsData => {
  const items = Array.isArray(value?.items) ? value!.items : []
  return {
    title: typeof value?.title === "string" ? value.title : "",
    items: items.map((it) => ({
      quote: typeof it?.quote === "string" ? it.quote : "",
      author: typeof it?.author === "string" ? it.author : "",
      role: typeof it?.role === "string" ? it.role : "",
      avatar: typeof it?.avatar === "string" ? it.avatar : "",
    })),
  }
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function TestimonialsEditor({
  value,
  onChange,
  locale = "en",
}: TestimonialsEditorProps) {
  const data = normalize(value)
  const isDefaultLocale = locale === "en"
  const localeLabel = locale.toUpperCase()

  /** Emit a new data object built from an in-place mutation of a fresh copy. */
  const commit = useCallback(
    (mutate: (draft: TestimonialsData) => void) => {
      const draft = normalize(value)
      mutate(draft)
      onChange(draft)
    },
    [value, onChange]
  )

  const setTitle = (title: string) =>
    commit((d) => {
      d.title = title
    })

  const updateItem = (index: number, patch: Partial<TestimonialItem>) =>
    commit((d) => {
      d.items[index] = { ...d.items[index], ...patch }
    })

  const addItem = () =>
    commit((d) => {
      d.items.push(emptyItem())
    })

  const removeItem = (index: number) =>
    commit((d) => {
      d.items.splice(index, 1)
    })

  const moveItem = (index: number, dir: -1 | 1) =>
    commit((d) => {
      const next = index + dir
      if (next < 0 || next >= d.items.length) return
      const [item] = d.items.splice(index, 1)
      d.items.splice(next, 0, item)
    })

  return (
    <div className="flex flex-col gap-y-6">
      {!isDefaultLocale && (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Editing {localeLabel} translations. Item order, avatars and author
            names are managed in the EN tab — only the text is editable here.
            Leave a field empty to use the English value.
          </Text>
        </div>
      )}

      {/* Section title (localized) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Section title{!isDefaultLocale && ` · ${localeLabel}`}
        </Label>
        <Input
          value={data.title ?? ""}
          placeholder={isDefaultLocale ? "What our customers say" : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          Heading shown above the testimonials. Optional — leave blank to hide.
        </Text>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col">
            <Label size="small" weight="plus">
              Testimonials
            </Label>
            <Text size="xsmall" className="text-ui-fg-muted">
              {data.items.length}{" "}
              {data.items.length === 1 ? "testimonial" : "testimonials"}
            </Text>
          </div>
          {isDefaultLocale && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addItem}
            >
              <Plus />
              Add testimonial
            </Button>
          )}
        </div>

        {data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed border-ui-border-strong bg-ui-bg-subtle px-6 py-10 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              {isDefaultLocale
                ? "No testimonials yet. Add your first one to get started."
                : "No testimonials to translate."}
            </Text>
          </div>
        ) : (
          data.items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
            >
              {/* Item header / controls */}
              <div className="flex items-center justify-between gap-x-2">
                <Text size="small" weight="plus">
                  Testimonial {index + 1}
                </Text>
                {isDefaultLocale && (
                  <div className="flex items-center gap-x-1">
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, -1)}
                      aria-label="Move testimonial up"
                    >
                      <ArrowUpMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      disabled={index === data.items.length - 1}
                      onClick={() => moveItem(index, 1)}
                      aria-label="Move testimonial down"
                    >
                      <ArrowDownMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      onClick={() => removeItem(index)}
                      aria-label="Remove testimonial"
                    >
                      <Trash />
                    </IconButton>
                  </div>
                )}
              </div>

              {/* Avatar (locale-invariant) */}
              <ImagePicker
                label="Avatar"
                hint="Photo of the person (shared across all languages)."
                clearable
                disabled={!isDefaultLocale}
                value={item.avatar}
                onChange={(url) => updateItem(index, { avatar: url })}
              />

              {/* Quote (localized) */}
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Quote{!isDefaultLocale && ` · ${localeLabel}`}
                </Label>
                <Textarea
                  value={item.quote}
                  rows={3}
                  placeholder={
                    isDefaultLocale
                      ? "Absolutely in love with my purchase…"
                      : undefined
                  }
                  onChange={(e) => updateItem(index, { quote: e.target.value })}
                />
              </div>

              {/* Author + role */}
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small" weight="plus">
                    Author
                  </Label>
                  <Input
                    value={item.author}
                    disabled={!isDefaultLocale}
                    placeholder="Amelia Hart"
                    className={clx(!isDefaultLocale && "font-mono")}
                    onChange={(e) =>
                      updateItem(index, { author: e.target.value })
                    }
                  />
                  {!isDefaultLocale && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Shared across all languages.
                    </Text>
                  )}
                </div>

                <div className="flex flex-col gap-y-1.5">
                  <Label size="small" weight="plus">
                    Role{!isDefaultLocale && ` · ${localeLabel}`}
                  </Label>
                  <Input
                    value={item.role ?? ""}
                    placeholder={isDefaultLocale ? "Verified buyer" : undefined}
                    onChange={(e) => updateItem(index, { role: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TestimonialsEditor
