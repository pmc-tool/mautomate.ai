/**
 * Forever Finds CMS — image_with_text block editor (Phase 4).
 *
 * A controlled editor for the `image_with_text` section data. It mirrors the
 * backend registry shape EXACTLY (src/modules/cms/registry/image-with-text.ts):
 *
 *   {
 *     image: string                 // LOCALE-INVARIANT media URL (required)
 *     image_side: "left" | "right"  // LOCALE-INVARIANT layout (default "left")
 *     eyebrow?: string              // i18n locale string (optional)
 *     title: string                 // i18n locale string (required); "\n" => <br/>
 *     body?: string                 // i18n locale string (optional)
 *     cta?: {                       // optional button group
 *       label?: string             // i18n locale string (optional)
 *       href: string               // LOCALE-INVARIANT link target (required)
 *     }
 *   }
 *
 * LOCALIZATION CONTRACT (phase-0-architecture.md §2):
 *   `locale` tells the editor which locale slice it is editing.
 *   - "en" (default locale): the FULL editor — image, side, link and the EN text.
 *   - non-"en" (e.g. "bn"): STRUCTURE IS LOCKED (image, image_side and the CTA
 *     href are locale-invariant and shown read-only). Only the translatable text
 *     fields (eyebrow, title, body, cta.label) are editable — these become the
 *     sparse per-locale override. Leave a field blank to fall back to the
 *     English value at publish time.
 *
 * Props are the shared block-editor contract owned by the page-builder registry
 * (registry.ts): { value, onChange, locale }.
 *
 * This file is intentionally self-contained — it only depends on @medusajs/ui,
 * @medusajs/icons and the shared ImagePicker.
 */
import {
  Button,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui"

import { ImagePicker } from "../image-picker"
import type {
  ImageWithTextCta,
  ImageWithTextData,
  ImageWithTextSide,
} from "../../../../modules/cms/registry/image-with-text"

const DEFAULT_LOCALE = "en"

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type ImageWithTextEditorProps = {
  /** Current data for the locale being edited (full en, or sparse bn override). */
  value: Partial<ImageWithTextData> | null | undefined
  /** Receives the next data object. */
  onChange: (next: Partial<ImageWithTextData>) => void
  /** Active editing locale (e.g. "en" | "bn"). */
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Defaults & helpers                                                  */
/* ------------------------------------------------------------------ */

const emptyCta = (): ImageWithTextCta => ({ label: "", href: "/store" })

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function ImageWithTextEditor({
  value,
  onChange,
  locale,
}: ImageWithTextEditorProps) {
  const isDefault = (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
  const localeLabel = (locale ?? DEFAULT_LOCALE).toUpperCase()
  const data: Partial<ImageWithTextData> = value ?? {}
  const side: ImageWithTextSide = data.image_side === "right" ? "right" : "left"

  /* --- mutators ------------------------------------------------------- */
  const patch = (next: Partial<ImageWithTextData>) =>
    onChange({ ...data, ...next })

  const patchCta = (p: Partial<ImageWithTextCta>) =>
    patch({ cta: { ...(data.cta ?? emptyCta()), ...p } })

  const toggleCta = (on: boolean) => {
    if (on) {
      patch({ cta: emptyCta() })
    } else {
      const next = { ...data }
      delete next.cta
      onChange(next)
    }
  }

  return (
    <div className="flex flex-col gap-y-5">
      {!isDefault && (
        <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
          <Text size="xsmall" className="text-ui-tag-orange-text">
            Translating <span className="font-mono uppercase">{locale}</span> —
            only text fields are editable. The image, its side and the button
            link are shared with the default language and stay locked.
          </Text>
        </div>
      )}

      {/* Image (locale-invariant) */}
      <ImagePicker
        label="Image"
        value={data.image}
        disabled={!isDefault}
        clearable
        hint={
          isDefault
            ? "The banner image (shared across all languages)."
            : "Shared across all languages."
        }
        onChange={(url) => patch({ image: url })}
      />

      {/* Image side (locale-invariant) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Image side
        </Label>
        <Select
          value={side}
          disabled={!isDefault}
          onValueChange={(v) =>
            patch({ image_side: v as ImageWithTextSide })
          }
        >
          <Select.Trigger>
            <Select.Value placeholder="Image side" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="left">Image left, text right</Select.Item>
            <Select.Item value="right">Image right, text left</Select.Item>
          </Select.Content>
        </Select>
        <Text size="xsmall" className="text-ui-fg-muted">
          Which side the image sits on (shared across all languages).
        </Text>
      </div>

      {/* Text fields (localized) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Eyebrow{!isDefault && ` · ${localeLabel}`}
        </Label>
        <Input
          value={data.eyebrow ?? ""}
          placeholder={isDefault ? "Handicraft shop" : undefined}
          onChange={(e) => patch({ eyebrow: e.target.value })}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          A small kicker line shown above the title.
        </Text>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Title{!isDefault && ` · ${localeLabel}`}
        </Label>
        <Textarea
          value={data.title ?? ""}
          rows={2}
          placeholder={
            isDefault ? "Crafted with care,\nmade to be found" : undefined
          }
          onChange={(e) => patch({ title: e.target.value })}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          Use a line break (Enter) to split the heading onto two lines.
        </Text>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Body{!isDefault && ` · ${localeLabel}`}
        </Label>
        <Textarea
          value={data.body ?? ""}
          rows={4}
          placeholder={
            isDefault
              ? "Years of experience brought about by our skilled craftsmen…"
              : undefined
          }
          onChange={(e) => patch({ body: e.target.value })}
        />
      </div>

      {/* CTA (optional group) */}
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle/40">
        <div className="flex items-start justify-between gap-x-4 border-b border-ui-border-base px-4 py-3">
          <div className="flex flex-col gap-y-0.5">
            <Text size="small" weight="plus">
              Button
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              An optional call-to-action button under the copy.
            </Text>
          </div>
          {isDefault && (
            <div className="flex shrink-0 items-center gap-x-2">
              <Text size="xsmall" className="text-ui-fg-subtle">
                {data.cta ? "Shown" : "Hidden"}
              </Text>
              <Switch
                checked={!!data.cta}
                onCheckedChange={(on) => toggleCta(on)}
              />
            </div>
          )}
        </div>

        {data.cta ? (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Button label{!isDefault && ` · ${localeLabel}`}
              </Label>
              <Input
                value={data.cta.label ?? ""}
                placeholder={isDefault ? "shop now" : undefined}
                onChange={(e) => patchCta({ label: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Button link
              </Label>
              <Input
                value={data.cta.href ?? ""}
                disabled={!isDefault}
                placeholder="/store"
                className={clx(!isDefault && "font-mono")}
                onChange={(e) => patchCta({ href: e.target.value })}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Where the button links to (shared across all languages).
              </Text>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6">
            <Text size="small" className="text-ui-fg-muted">
              {isDefault
                ? "No button — enable it to add a call-to-action."
                : "Not configured in the default language (en)."}
            </Text>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageWithTextEditor
