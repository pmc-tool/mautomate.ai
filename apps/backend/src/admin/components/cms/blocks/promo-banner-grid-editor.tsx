/**
 * Forever Finds CMS — promo_banner_grid block editor (Phase 3).
 *
 * A controlled editor for the `promo_banner_grid` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/promo-banner-grid.ts):
 *
 *   {
 *     intro?:    { title·i18n, body·i18n, link_label·i18n, href }
 *     sale?:     { image, special_title·i18n, title·i18n, link_label·i18n, href }
 *     categories: Array<{ image, title·i18n, count_label·i18n, href, wide? }>
 *     instagram?:{ image, sub_title·i18n, handle, href }
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - STRUCTURE is locale-invariant: adding / removing / reordering groups and
 *     category tiles, image URLs, hrefs, the `wide` flag and the Instagram
 *     handle are edited ONLY on the default locale (en).
 *   - TEXT (·i18n above) is translatable: on a non-default locale (bn) the
 *     editor surfaces ONLY the translatable string fields; every locale-
 *     invariant control is rendered read-only (the section translation stores a
 *     sparse override that is deep-merged over the en base at publish time).
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
  Switch,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import type { ReactNode } from "react"

import { ImagePicker } from "../image-picker"
import type {
  PromoBannerGridData,
  PromoCategoryTile,
  PromoInstagram,
  PromoIntro,
  PromoSale,
} from "../../../../modules/cms/registry/promo-banner-grid"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type PromoBannerGridEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<PromoBannerGridData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<PromoBannerGridData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Empty factories (used when an editor enables an optional group)     */
/* ------------------------------------------------------------------ */

const emptyIntro = (): PromoIntro => ({
  title: "",
  body: "",
  link_label: "",
  href: "/store",
})

const emptySale = (): PromoSale => ({
  image: "",
  special_title: "",
  title: "",
  link_label: "",
  href: "/store",
})

const emptyCategory = (): PromoCategoryTile => ({
  image: "",
  title: "",
  count_label: "",
  href: "/store",
})

const emptyInstagram = (): PromoInstagram => ({
  image: "",
  sub_title: "",
  handle: "@",
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

function GroupCard({
  title,
  description,
  enabled,
  onToggle,
  canToggle,
  children,
}: {
  title: string
  description?: string
  enabled: boolean
  onToggle?: (next: boolean) => void
  canToggle: boolean
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
      <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
        <div className="flex flex-col gap-y-0.5">
          <Text size="small" weight="plus">
            {title}
          </Text>
          {description && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {description}
            </Text>
          )}
        </div>
        {canToggle && onToggle && (
          <div className="flex shrink-0 items-center gap-x-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              {enabled ? "Shown" : "Hidden"}
            </Text>
            <Switch checked={enabled} onCheckedChange={onToggle} />
          </div>
        )}
      </div>
      {enabled ? (
        <div className="flex flex-col gap-y-4 p-4">{children}</div>
      ) : (
        <div className="px-4 py-6">
          <Text size="small" className="text-ui-fg-muted">
            {canToggle
              ? "This area is hidden — enable it to add content."
              : "Not configured in the default language (en)."}
          </Text>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function PromoBannerGridEditor({
  value,
  onChange,
  locale,
}: PromoBannerGridEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const data: Partial<PromoBannerGridData> = value ?? {}
  const categories: PromoCategoryTile[] = Array.isArray(data.categories)
    ? data.categories
    : []

  /* --- root mutators -------------------------------------------------- */
  const patch = (next: Partial<PromoBannerGridData>) =>
    onChange({ ...data, ...next })

  const patchIntro = (p: Partial<PromoIntro>) =>
    patch({ intro: { ...(data.intro ?? emptyIntro()), ...p } })

  const patchSale = (p: Partial<PromoSale>) =>
    patch({ sale: { ...(data.sale ?? emptySale()), ...p } })

  const patchInstagram = (p: Partial<PromoInstagram>) =>
    patch({ instagram: { ...(data.instagram ?? emptyInstagram()), ...p } })

  const setCategories = (next: PromoCategoryTile[]) =>
    patch({ categories: next })

  const patchCategory = (idx: number, p: Partial<PromoCategoryTile>) =>
    setCategories(categories.map((c, i) => (i === idx ? { ...c, ...p } : c)))

  const addCategory = () =>
    setCategories([...categories, emptyCategory()])

  const removeCategory = (idx: number) =>
    setCategories(categories.filter((_, i) => i !== idx))

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= categories.length) return
    const next = [...categories]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setCategories(next)
  }

  /* --- optional-group toggles (structure = default locale only) ------- */
  const toggleGroup = (
    key: "intro" | "sale" | "instagram",
    on: boolean
  ) => {
    if (on) {
      const factory =
        key === "intro"
          ? emptyIntro()
          : key === "sale"
            ? emptySale()
            : emptyInstagram()
      patch({ [key]: factory } as Partial<PromoBannerGridData>)
    } else {
      const next = { ...data }
      delete next[key]
      onChange(next)
    }
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            only text fields are editable. Images, links, the layout and the
            Instagram handle are shared with the default language and stay
            locked.
          </Text>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Intro blockquote                                                 */}
      {/* ---------------------------------------------------------------- */}
      <GroupCard
        title="Intro"
        description="The left-hand blockquote (about-us copy)."
        canToggle={isDefault}
        enabled={!!data.intro}
        onToggle={(on) => toggleGroup("intro", on)}
      >
        <TextField
          label="Title"
          value={data.intro?.title}
          onChange={(v) => patchIntro({ title: v })}
          placeholder="Forever Finds is an online shop…"
        />
        <TextField
          label="Body"
          value={data.intro?.body}
          textarea
          rows={4}
          onChange={(v) => patchIntro({ body: v })}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Link label"
            value={data.intro?.link_label}
            placeholder="ABOUT US"
            onChange={(v) => patchIntro({ link_label: v })}
          />
          <InvariantField
            label="Link (href)"
            value={data.intro?.href}
            editable={isDefault}
            placeholder="/store"
            onChange={(v) => patchIntro({ href: v })}
          />
        </div>
      </GroupCard>

      {/* ---------------------------------------------------------------- */}
      {/* Sale banner                                                      */}
      {/* ---------------------------------------------------------------- */}
      <GroupCard
        title="Sale banner"
        description="The promotional banner (e.g. Spring sale)."
        canToggle={isDefault}
        enabled={!!data.sale}
        onToggle={(on) => toggleGroup("sale", on)}
      >
        <ImagePicker
          label="Banner image"
          value={data.sale?.image}
          disabled={!isDefault}
          clearable
          hint={
            isDefault
              ? "Background image for the sale banner."
              : "Shared across all languages."
          }
          onChange={(url) => patchSale({ image: url })}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Special title"
            value={data.sale?.special_title}
            placeholder="Spring sale"
            onChange={(v) => patchSale({ special_title: v })}
          />
          <TextField
            label="Title"
            value={data.sale?.title}
            placeholder="Sale up to 10% all"
            onChange={(v) => patchSale({ title: v })}
          />
          <TextField
            label="Link label"
            value={data.sale?.link_label}
            placeholder="SHOP NOW"
            onChange={(v) => patchSale({ link_label: v })}
          />
          <InvariantField
            label="Link (href)"
            value={data.sale?.href}
            editable={isDefault}
            placeholder="/store"
            onChange={(v) => patchSale({ href: v })}
          />
        </div>
      </GroupCard>

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
              The category cards. Mark one tile as “wide” to span two columns.
            </Text>
          </div>
          {isDefault && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addCategory}
            >
              <Plus />
              Add tile
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          {categories.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No category tiles yet — add one above."
                : "Not configured in the default language (en)."}
            </Text>
          ) : (
            categories.map((tile, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text size="small" weight="plus">
                    Tile {idx + 1}
                    {tile.wide ? " · wide" : ""}
                  </Text>
                  {isDefault && (
                    <div className="flex items-center gap-x-1">
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === 0}
                        aria-label="Move up"
                        onClick={() => moveCategory(idx, -1)}
                      >
                        <ArrowUpMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === categories.length - 1}
                        aria-label="Move down"
                        onClick={() => moveCategory(idx, 1)}
                      >
                        <ArrowDownMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label="Remove tile"
                        onClick={() => removeCategory(idx)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-y-4">
                  <ImagePicker
                    label="Image"
                    value={tile.image}
                    disabled={!isDefault}
                    clearable
                    hint={isDefault ? undefined : "Shared across all languages."}
                    onChange={(url) => patchCategory(idx, { image: url })}
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField
                      label="Title"
                      value={tile.title}
                      placeholder="Home Decor"
                      onChange={(v) => patchCategory(idx, { title: v })}
                    />
                    <TextField
                      label="Count label"
                      value={tile.count_label}
                      placeholder="16 items"
                      onChange={(v) =>
                        patchCategory(idx, { count_label: v })
                      }
                    />
                    <InvariantField
                      label="Link (href)"
                      value={tile.href}
                      editable={isDefault}
                      placeholder="/store"
                      onChange={(v) => patchCategory(idx, { href: v })}
                    />
                    <div className="flex items-end pb-1">
                      <label
                        className={clx(
                          "flex items-center gap-x-2",
                          !isDefault && "opacity-60"
                        )}
                      >
                        <Switch
                          checked={!!tile.wide}
                          disabled={!isDefault}
                          onCheckedChange={(on) =>
                            patchCategory(idx, { wide: on })
                          }
                        />
                        <Text size="small">Wide tile (spans two columns)</Text>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Instagram tile                                                   */}
      {/* ---------------------------------------------------------------- */}
      <GroupCard
        title="Instagram tile"
        description="The “follow us” call-to-action card."
        canToggle={isDefault}
        enabled={!!data.instagram}
        onToggle={(on) => toggleGroup("instagram", on)}
      >
        <ImagePicker
          label="Image"
          value={data.instagram?.image}
          disabled={!isDefault}
          clearable
          hint={isDefault ? undefined : "Shared across all languages."}
          onChange={(url) => patchInstagram({ image: url })}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Sub title"
            value={data.instagram?.sub_title}
            placeholder="Follow us on instagram"
            onChange={(v) => patchInstagram({ sub_title: v })}
          />
          <InvariantField
            label="Handle"
            value={data.instagram?.handle}
            editable={isDefault}
            placeholder="@forever_finds"
            onChange={(v) => patchInstagram({ handle: v })}
          />
          <InvariantField
            label="Link (href)"
            value={data.instagram?.href}
            editable={isDefault}
            placeholder="#"
            onChange={(v) => patchInstagram({ href: v })}
          />
        </div>
      </GroupCard>
    </div>
  )
}

export default PromoBannerGridEditor
