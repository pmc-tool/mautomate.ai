/**
 * Forever Finds CMS — instagram_grid block editor (Phase 4).
 *
 * A controlled editor for the `instagram_grid` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/instagram-grid.ts):
 *
 *   {
 *     handle: string             // LOCALE-INVARIANT — "@forever_finds"
 *     heading?: string  ·i18n    // translatable section sub-title
 *     images: Array<{
 *       image: string            // LOCALE-INVARIANT media URL
 *       href: string             // LOCALE-INVARIANT link target
 *     }>
 *   }
 *
 * Localization contract (phase-0-architecture.md §2):
 *   - STRUCTURE is locale-invariant: adding / removing / reordering tiles, the
 *     image URLs, hrefs and the handle are edited ONLY on the default locale (en).
 *   - TEXT (·i18n above — only `heading`) is translatable: on a non-default
 *     locale (bn) the editor surfaces ONLY the heading; every locale-invariant
 *     control is read-only (the section translation stores a sparse override
 *     deep-merged over the en base at publish time).
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }. `value` is the data object for the
 * locale being edited (full en payload, or the sparse bn override); `onChange`
 * receives the full next data object.
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

import { ImagePicker } from "../image-picker"
import type {
  InstagramGridData,
  InstagramGridImage,
} from "../../../../modules/cms/registry/instagram-grid"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type InstagramGridEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<InstagramGridData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<InstagramGridData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Empty factory                                                       */
/* ------------------------------------------------------------------ */

const emptyImage = (): InstagramGridImage => ({
  image: "",
  href: "#",
})

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function InstagramGridEditor({
  value,
  onChange,
  locale,
}: InstagramGridEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const localeLabel = (locale ?? DEFAULT_LOCALE).toUpperCase()
  const data: Partial<InstagramGridData> = value ?? {}
  const images: InstagramGridImage[] = Array.isArray(data.images)
    ? data.images
    : []

  /* --- mutators ------------------------------------------------------- */
  const patch = (next: Partial<InstagramGridData>) =>
    onChange({ ...data, ...next })

  const setImages = (next: InstagramGridImage[]) => patch({ images: next })

  const patchImage = (idx: number, p: Partial<InstagramGridImage>) =>
    setImages(images.map((m, i) => (i === idx ? { ...m, ...p } : m)))

  const addImage = () => setImages([...images, emptyImage()])

  const removeImage = (idx: number) =>
    setImages(images.filter((_, i) => i !== idx))

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setImages(next)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            only the heading is editable. The handle, images and links are shared
            with the default language and stay locked.
          </Text>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Section heading (translatable) + handle (invariant)             */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-1.5">
          <Label size="small" weight="plus">
            Heading{!isDefault && ` · ${localeLabel}`}
          </Label>
          <Input
            value={data.heading ?? ""}
            placeholder="Follow us on instagram"
            onChange={(e) => patch({ heading: e.target.value })}
          />
          <Text size="xsmall" className="text-ui-fg-muted">
            The section sub-title above the tiles (translatable). Leave empty to
            hide it.
          </Text>
        </div>

        <div className="flex flex-col gap-y-1.5">
          <Label size="small" weight="plus">
            Handle
          </Label>
          <Input
            value={data.handle ?? ""}
            disabled={!isDefault}
            placeholder="@forever_finds"
            onChange={(e) => patch({ handle: e.target.value })}
          />
          <Text size="xsmall" className="text-ui-fg-muted">
            {isDefault
              ? "Your Instagram @handle, shown as the section title."
              : "Shared across all languages."}
          </Text>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tiles                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
          <div className="flex flex-col gap-y-0.5">
            <Text size="small" weight="plus">
              Tiles
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              The Instagram images. 6–8 tiles look best.
            </Text>
          </div>
          {isDefault && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addImage}
            >
              <Plus />
              Add tile
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-y-4 p-4">
          {images.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No tiles yet — add one above."
                : "Not configured in the default language (en)."}
            </Text>
          ) : (
            images.map((tile, idx) => (
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
                        onClick={() => moveImage(idx, -1)}
                      >
                        <ArrowUpMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={idx === images.length - 1}
                        aria-label="Move down"
                        onClick={() => moveImage(idx, 1)}
                      >
                        <ArrowDownMini />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label="Remove tile"
                        onClick={() => removeImage(idx)}
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
                    onChange={(url) => patchImage(idx, { image: url })}
                  />
                  <div className="flex flex-col gap-y-1.5">
                    <Label size="small" weight="plus">
                      Link (href)
                    </Label>
                    <Input
                      value={tile.href ?? ""}
                      disabled={!isDefault}
                      placeholder="#"
                      onChange={(e) => patchImage(idx, { href: e.target.value })}
                    />
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {isDefault
                        ? "Where this tile links to (e.g. an Instagram post URL)."
                        : "Shared across all languages."}
                    </Text>
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

export default InstagramGridEditor
