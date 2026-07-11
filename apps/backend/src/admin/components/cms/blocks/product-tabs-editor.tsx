/**
 * Forever Finds CMS — product_tabs block editor (Phase 4).
 *
 * A controlled editor for the `product_tabs` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/product-tabs.ts):
 *
 *   {
 *     tabs: Array<{
 *       label·i18n
 *       source: "all" | "category" | "collection" | "manual"
 *       category_id?       // when source = "category"
 *       collection_id?     // when source = "collection"
 *       product_ids?       // when source = "manual"
 *       sort?: "created_at" | "price_asc" | "price_desc"
 *       limit?
 *     }>
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - STRUCTURE is locale-invariant: adding / removing / reordering tabs, the
 *     `source`, the bound id(s), `sort` and `limit` are edited ONLY on the
 *     default locale (en).
 *   - TEXT (·i18n above — only `label`) is translatable: on a non-default locale
 *     (bn) the editor surfaces ONLY the tab labels; every locale-invariant
 *     control is rendered read-only (the section translation stores a sparse
 *     override deep-merged over the en base at publish time).
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }. `value` is the data object for the
 * locale being edited (full en payload, or the sparse bn override); `onChange`
 * receives the next data object.
 *
 * This file is intentionally self-contained — it only depends on @medusajs/ui,
 * @medusajs/icons. ONLY this block's editor.
 */
import {
  Button,
  IconButton,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import type { ReactNode } from "react"

import type {
  ProductTab,
  ProductTabSort,
  ProductTabSource,
  ProductTabsData,
} from "../../../../modules/cms/registry/product-tabs"

const DEFAULT_LOCALE = "en"
const DEFAULT_LIMIT = 10

const SOURCE_OPTIONS: { value: ProductTabSource; label: string }[] = [
  { value: "all", label: "All products (latest)" },
  { value: "category", label: "By category" },
  { value: "collection", label: "By collection" },
  { value: "manual", label: "Hand-picked products" },
]

const SORT_OPTIONS: { value: ProductTabSort; label: string }[] = [
  { value: "created_at", label: "Latest arrivals" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
]

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type ProductTabsEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<ProductTabsData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<ProductTabsData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Empty factory                                                       */
/* ------------------------------------------------------------------ */

const emptyTab = (): ProductTab => ({
  label: "",
  source: "all",
  sort: "created_at",
  limit: DEFAULT_LIMIT,
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

/** Parse a textarea (comma- or newline-separated) into a clean id list. */
const parseIds = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function ProductTabsEditor({
  value,
  onChange,
  locale,
}: ProductTabsEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const localeLabel = (locale ?? DEFAULT_LOCALE).toUpperCase()
  const data: Partial<ProductTabsData> = value ?? {}
  const tabs: ProductTab[] = Array.isArray(data.tabs) ? data.tabs : []

  /* --- mutators ------------------------------------------------------- */
  const setTabs = (next: ProductTab[]) => onChange({ ...data, tabs: next })

  const patchTab = (idx: number, p: Partial<ProductTab>) =>
    setTabs(tabs.map((t, i) => (i === idx ? { ...t, ...p } : t)))

  const addTab = () => setTabs([...tabs, emptyTab()])

  const removeTab = (idx: number) =>
    setTabs(tabs.filter((_, i) => i !== idx))

  const moveTab = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= tabs.length) return
    const next = [...tabs]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setTabs(next)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{localeLabel}</span>{" "}
            — only the tab labels are editable. The product source, sorting and
            limits are shared with the default language and stay locked. Leave a
            label empty to use the English value.
          </Text>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Tabs                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
          <div className="flex flex-col gap-y-0.5">
            <Text size="small" weight="plus">
              Tabs
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}. Each tab loads a
              live set of products.
            </Text>
          </div>
          {isDefault && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addTab}
            >
              <Plus />
              Add tab
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          {tabs.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No tabs yet — add one above."
                : "No tabs to translate."}
            </Text>
          ) : (
            tabs.map((tab, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text size="small" weight="plus">
                    Tab {idx + 1}
                  </Text>
                  {isDefault && (
                    <div className="flex items-center gap-x-1">
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === 0}
                        aria-label="Move up"
                        onClick={() => moveTab(idx, -1)}
                      >
                        <ArrowUpMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === tabs.length - 1}
                        aria-label="Move down"
                        onClick={() => moveTab(idx, 1)}
                      >
                        <ArrowDownMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label="Remove tab"
                        onClick={() => removeTab(idx)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-y-4">
                  {/* Label (localized) */}
                  <Field
                    label={`Label${!isDefault ? ` · ${localeLabel}` : ""}`}
                  >
                    <Input
                      value={tab.label ?? ""}
                      placeholder={isDefault ? "New arrivals" : undefined}
                      onChange={(e) =>
                        patchTab(idx, { label: e.target.value })
                      }
                    />
                  </Field>

                  {/* Source (locale-invariant) */}
                  <Field
                    label="Product source"
                    hint={isDefault ? undefined : "Shared across all languages."}
                  >
                    <Select
                      value={tab.source ?? "all"}
                      disabled={!isDefault}
                      onValueChange={(v) =>
                        patchTab(idx, { source: v as ProductTabSource })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Select a source" />
                      </Select.Trigger>
                      <Select.Content>
                        {SOURCE_OPTIONS.map((o) => (
                          <Select.Item key={o.value} value={o.value}>
                            {o.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Field>

                  {/* Source-specific binding (locale-invariant) */}
                  {tab.source === "category" && (
                    <Field
                      label="Category ID"
                      hint={
                        isDefault
                          ? "The product category to pull from (e.g. pcat_...)."
                          : "Shared across all languages."
                      }
                    >
                      <Input
                        value={tab.category_id ?? ""}
                        disabled={!isDefault}
                        placeholder="pcat_..."
                        className={clx(!isDefault && "font-mono")}
                        onChange={(e) =>
                          patchTab(idx, { category_id: e.target.value })
                        }
                      />
                    </Field>
                  )}

                  {tab.source === "collection" && (
                    <Field
                      label="Collection ID"
                      hint={
                        isDefault
                          ? "The product collection to pull from (e.g. pcol_...)."
                          : "Shared across all languages."
                      }
                    >
                      <Input
                        value={tab.collection_id ?? ""}
                        disabled={!isDefault}
                        placeholder="pcol_..."
                        className={clx(!isDefault && "font-mono")}
                        onChange={(e) =>
                          patchTab(idx, { collection_id: e.target.value })
                        }
                      />
                    </Field>
                  )}

                  {tab.source === "manual" && (
                    <Field
                      label="Product IDs"
                      hint={
                        isDefault
                          ? "One product ID per line (or comma-separated). Order is preserved; missing products are skipped."
                          : "Shared across all languages."
                      }
                    >
                      <Textarea
                        value={(tab.product_ids ?? []).join("\n")}
                        rows={4}
                        disabled={!isDefault}
                        placeholder={"prod_...\nprod_..."}
                        className={clx(!isDefault && "font-mono")}
                        onChange={(e) =>
                          patchTab(idx, { product_ids: parseIds(e.target.value) })
                        }
                      />
                    </Field>
                  )}

                  {/* Sort + limit (locale-invariant) */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="Sort"
                      hint={isDefault ? undefined : "Shared across all languages."}
                    >
                      <Select
                        value={tab.sort ?? "created_at"}
                        disabled={!isDefault || tab.source === "manual"}
                        onValueChange={(v) =>
                          patchTab(idx, { sort: v as ProductTabSort })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Select a sort" />
                        </Select.Trigger>
                        <Select.Content>
                          {SORT_OPTIONS.map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Field>

                    <Field
                      label="Max products"
                      hint={isDefault ? undefined : "Shared across all languages."}
                    >
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={String(tab.limit ?? DEFAULT_LIMIT)}
                        disabled={!isDefault}
                        placeholder={String(DEFAULT_LIMIT)}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchTab(idx, {
                            limit:
                              e.target.value === "" || !isFinite(n)
                                ? DEFAULT_LIMIT
                                : Math.max(1, Math.floor(n)),
                          })
                        }}
                      />
                    </Field>
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

export default ProductTabsEditor
