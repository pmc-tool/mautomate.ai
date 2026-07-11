/**
 * Forever Finds CMS — brand_strip block editor (Phase 4).
 *
 * A controlled editor for the `brand_strip` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/brand-strip.ts):
 *
 *   {
 *     title?: string ·i18n             // section heading ("Shop by brands")
 *     brands: Array<{ image, href }>   // image + href are locale-invariant
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - STRUCTURE is locale-invariant: adding / removing / reordering brand
 *     logos, their image URLs and hrefs are edited ONLY on the default locale
 *     (en).
 *   - TEXT (·i18n above — only `title`) is translatable: on a non-default
 *     locale (bn) the editor surfaces ONLY the translatable string field; every
 *     locale-invariant control is rendered read-only (the section translation
 *     stores a sparse override deep-merged over the en base at publish time).
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }. `value` is the data object for the
 * locale being edited (full en payload, or the sparse bn override); `onChange`
 * receives the next data object.
 *
 * This file is intentionally self-contained — it only depends on @medusajs/ui,
 * @medusajs/icons and the shared ImagePicker. ONLY this block's editor.
 */
import {
  Button,
  IconButton,
  Input,
  Label,
  Text,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import type { ReactNode } from "react"

import { ImagePicker } from "../image-picker"
import type {
  BrandStripData,
  BrandStripItem,
} from "../../../../modules/cms/registry/brand-strip"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type BrandStripEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<BrandStripData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<BrandStripData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Empty factory                                                       */
/* ------------------------------------------------------------------ */

const emptyBrand = (): BrandStripItem => ({
  image: "",
  href: "#",
})

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
  hint,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/**
 * A locale-invariant text input (e.g. an href). Editable only on the default
 * locale; rendered read-only elsewhere with a small "shared" note.
 */
function InvariantField({
  label,
  value,
  onChange,
  placeholder,
  editable,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  editable: boolean
}) {
  return (
    <Field
      label={label}
      hint={editable ? undefined : "Shared across all languages."}
    >
      <Input
        value={value ?? ""}
        placeholder={placeholder}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function BrandStripEditor({
  value,
  onChange,
  locale,
}: BrandStripEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const data: Partial<BrandStripData> = value ?? {}
  const brands: BrandStripItem[] = Array.isArray(data.brands)
    ? data.brands
    : []

  /* --- root mutators -------------------------------------------------- */
  const patch = (next: Partial<BrandStripData>) =>
    onChange({ ...data, ...next })

  const setBrands = (next: BrandStripItem[]) => patch({ brands: next })

  const patchBrand = (idx: number, p: Partial<BrandStripItem>) =>
    setBrands(brands.map((b, i) => (i === idx ? { ...b, ...p } : b)))

  const addBrand = () => setBrands([...brands, emptyBrand()])

  const removeBrand = (idx: number) =>
    setBrands(brands.filter((_, i) => i !== idx))

  const moveBrand = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= brands.length) return
    const next = [...brands]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setBrands(next)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            only the title is editable. Brand logos and their links are shared
            with the default language and stay locked.
          </Text>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Heading                                                          */}
      {/* ---------------------------------------------------------------- */}
      <TextField
        label="Title"
        value={data.title}
        placeholder="Shop by brands"
        hint="Optional section heading. Leave empty to hide it."
        onChange={(v) => patch({ title: v })}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Brand logos                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
          <div className="flex flex-col gap-y-0.5">
            <Text size="small" weight="plus">
              Brand logos
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              The logos shown in the strip. Each logo links to its brand page.
            </Text>
          </div>
          {isDefault && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addBrand}
            >
              <Plus />
              Add brand
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          {brands.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No brand logos yet — add one above."
                : "Not configured in the default language (en)."}
            </Text>
          ) : (
            brands.map((brand, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text size="small" weight="plus">
                    Brand {idx + 1}
                  </Text>
                  {isDefault && (
                    <div className="flex items-center gap-x-1">
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === 0}
                        aria-label="Move up"
                        onClick={() => moveBrand(idx, -1)}
                      >
                        <ArrowUpMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === brands.length - 1}
                        aria-label="Move down"
                        onClick={() => moveBrand(idx, 1)}
                      >
                        <ArrowDownMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label="Remove brand"
                        onClick={() => removeBrand(idx)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-y-4">
                  <ImagePicker
                    label="Logo"
                    value={brand.image}
                    disabled={!isDefault}
                    clearable
                    hint={isDefault ? undefined : "Shared across all languages."}
                    onChange={(url) => patchBrand(idx, { image: url })}
                  />
                  <InvariantField
                    label="Link (href)"
                    value={brand.href}
                    editable={isDefault}
                    placeholder="#"
                    onChange={(v) => patchBrand(idx, { href: v })}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default BrandStripEditor
