/**
 * Forever Finds CMS — category_showcase block editor (Phase 4).
 *
 * A controlled editor for the `category_showcase` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/category-showcase.ts):
 *
 *   {
 *     sub_title?: string ·i18n
 *     title:      string ·i18n
 *     items: Array<{ category_id?, label·i18n, image, href }>
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - STRUCTURE is locale-invariant: adding / removing / reordering tiles, the
 *     category reference (category_id), image URLs and hrefs are edited ONLY on
 *     the default locale (en).
 *   - TEXT (·i18n above) is translatable: on a non-default locale (bn) the editor
 *     surfaces ONLY the translatable string fields; every locale-invariant
 *     control is rendered read-only (the section translation stores a sparse
 *     override that is deep-merged over the en base at publish time).
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
  Textarea,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import type { ReactNode } from "react"

import { ImagePicker } from "../image-picker"
import type {
  CategoryShowcaseData,
  CategoryShowcaseItem,
} from "../../../../modules/cms/registry/category-showcase"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type CategoryShowcaseEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<CategoryShowcaseData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<CategoryShowcaseData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Empty factory                                                       */
/* ------------------------------------------------------------------ */

const emptyItem = (): CategoryShowcaseItem => ({
  category_id: "",
  label: "",
  image: "",
  href: "/store",
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

/**
 * A locale-invariant text input (e.g. an href / category_id). Editable only on
 * the default locale; rendered read-only elsewhere with a small "shared" note.
 */
function InvariantField({
  label,
  value,
  onChange,
  placeholder,
  editable,
  hint,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  editable: boolean
  hint?: string
}) {
  return (
    <Field
      label={label}
      hint={hint ?? (editable ? undefined : "Shared across all languages.")}
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

export function CategoryShowcaseEditor({
  value,
  onChange,
  locale,
}: CategoryShowcaseEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const data: Partial<CategoryShowcaseData> = value ?? {}
  const items: CategoryShowcaseItem[] = Array.isArray(data.items)
    ? data.items
    : []

  /* --- root mutators -------------------------------------------------- */
  const patch = (next: Partial<CategoryShowcaseData>) =>
    onChange({ ...data, ...next })

  const setItems = (next: CategoryShowcaseItem[]) => patch({ items: next })

  const patchItem = (idx: number, p: Partial<CategoryShowcaseItem>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...p } : it)))

  const addItem = () => setItems([...items, emptyItem()])

  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx))

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setItems(next)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            only text fields are editable. Images, links, the category reference
            and the layout are shared with the default language and stay locked.
          </Text>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Section heading                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="border-b border-ui-border-base px-4 py-3">
          <Text size="small" weight="plus">
            Heading
          </Text>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <TextField
            label="Sub title"
            value={data.sub_title}
            placeholder="Shop by categories"
            onChange={(v) => patch({ sub_title: v })}
          />
          <TextField
            label="Title"
            value={data.title}
            placeholder="Making & crafting"
            onChange={(v) => patch({ title: v })}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Category tiles                                                   */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
          <div className="flex flex-col gap-y-0.5">
            <Text size="small" weight="plus">
              Category tiles
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              Link a tile to a live category to show its item count. Tiles whose
              category no longer exists are skipped on the storefront.
            </Text>
          </div>
          {isDefault && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addItem}
            >
              <Plus />
              Add tile
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          {items.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No category tiles yet — add one above."
                : "Not configured in the default language (en)."}
            </Text>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text size="small" weight="plus">
                    Tile {idx + 1}
                  </Text>
                  {isDefault && (
                    <div className="flex items-center gap-x-1">
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === 0}
                        aria-label="Move up"
                        onClick={() => moveItem(idx, -1)}
                      >
                        <ArrowUpMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === items.length - 1}
                        aria-label="Move down"
                        onClick={() => moveItem(idx, 1)}
                      >
                        <ArrowDownMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label="Remove tile"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-y-4">
                  <ImagePicker
                    label="Image"
                    value={item.image}
                    disabled={!isDefault}
                    clearable
                    hint={isDefault ? undefined : "Shared across all languages."}
                    onChange={(url) => patchItem(idx, { image: url })}
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField
                      label="Label"
                      value={item.label}
                      placeholder="Home Decor"
                      hint="Overrides the live category name."
                      onChange={(v) => patchItem(idx, { label: v })}
                    />
                    <InvariantField
                      label="Category ID"
                      value={item.category_id}
                      editable={isDefault}
                      placeholder="pcat_… (optional)"
                      hint={
                        isDefault
                          ? "Optional — links the tile to a live category for its item count."
                          : "Shared across all languages."
                      }
                      onChange={(v) => patchItem(idx, { category_id: v })}
                    />
                    <InvariantField
                      label="Link (href)"
                      value={item.href}
                      editable={isDefault}
                      placeholder="/store"
                      onChange={(v) => patchItem(idx, { href: v })}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default CategoryShowcaseEditor
