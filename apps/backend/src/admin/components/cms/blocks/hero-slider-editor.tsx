/**
 * Forever Finds CMS — Hero Slider block editor (Phase 3).
 *
 * A reusable, controlled editor for `hero_slider` section data. It is rendered
 * by the page-builder block-editor registry (registry.ts) for any section whose
 * type is "hero_slider".
 *
 * DATA SHAPE (matches the backend block registry schema EXACTLY — see
 * modules/cms/registry hero_slider, schemaVersion 1):
 *
 *   {
 *     autoplay_ms?: number        // LOCALE-INVARIANT, >= 0, default 5000
 *     slides: Array<{
 *       image: string             // LOCALE-INVARIANT media URL (required)
 *       subtitle?: string         // i18n locale string (optional)
 *       title: string             // i18n locale string (required); "\n" => <br/>
 *       cta: {
 *         label?: string          // i18n locale string (optional)
 *         href: string            // LOCALE-INVARIANT link target (required)
 *       }
 *     }>
 *   }
 *
 * LOCALIZATION CONTRACT:
 *   `locale` tells the editor which locale slice it is editing.
 *   - "en"  (default locale): the FULL structural editor — add / remove /
 *     reorder slides, set images, links, autoplay, plus the EN text.
 *   - non-"en" (e.g. "bn"): STRUCTURE IS LOCKED (slide count, order, images,
 *     links and autoplay are all locale-invariant and shown read-only). Only the
 *     translatable text fields (subtitle, title, cta.label) are editable — these
 *     become the sparse per-locale override. Leave a field blank to fall back to
 *     the English value at publish time.
 *
 * Props:
 *   value     current hero_slider data (en payload, or the locale working copy)
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
/* Types (mirror the backend registry hero_slider schema)             */
/* ------------------------------------------------------------------ */

export type HeroSlideCta = {
  label?: string
  href: string
}

export type HeroSlide = {
  image: string
  subtitle?: string
  title: string
  cta: HeroSlideCta
}

export type HeroSliderData = {
  autoplay_ms?: number
  slides: HeroSlide[]
}

export type HeroSliderEditorProps = {
  value: HeroSliderData | null | undefined
  onChange: (data: HeroSliderData) => void
  locale?: string
}

/* ------------------------------------------------------------------ */
/* Defaults & helpers                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_AUTOPLAY_MS = 5000

const emptySlide = (): HeroSlide => ({
  image: "",
  subtitle: "",
  title: "",
  cta: { label: "", href: "" },
})

/** Always return a well-formed, mutable working copy of the data. */
const normalize = (value: HeroSliderData | null | undefined): HeroSliderData => {
  const slides = Array.isArray(value?.slides) ? value!.slides : []
  return {
    autoplay_ms:
      typeof value?.autoplay_ms === "number" && isFinite(value.autoplay_ms)
        ? value.autoplay_ms
        : DEFAULT_AUTOPLAY_MS,
    slides: slides.map((s) => ({
      image: typeof s?.image === "string" ? s.image : "",
      subtitle: typeof s?.subtitle === "string" ? s.subtitle : "",
      title: typeof s?.title === "string" ? s.title : "",
      cta: {
        label: typeof s?.cta?.label === "string" ? s.cta.label : "",
        href: typeof s?.cta?.href === "string" ? s.cta.href : "",
      },
    })),
  }
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function HeroSliderEditor({
  value,
  onChange,
  locale = "en",
}: HeroSliderEditorProps) {
  const data = normalize(value)
  const isDefaultLocale = locale === "en"
  const localeLabel = locale.toUpperCase()

  /** Emit a new data object built from an in-place mutation of a fresh copy. */
  const commit = useCallback(
    (mutate: (draft: HeroSliderData) => void) => {
      const draft = normalize(value)
      mutate(draft)
      onChange(draft)
    },
    [value, onChange]
  )

  const updateSlide = (index: number, patch: Partial<HeroSlide>) =>
    commit((d) => {
      d.slides[index] = { ...d.slides[index], ...patch }
    })

  const updateCta = (index: number, patch: Partial<HeroSlideCta>) =>
    commit((d) => {
      d.slides[index] = {
        ...d.slides[index],
        cta: { ...d.slides[index].cta, ...patch },
      }
    })

  const addSlide = () =>
    commit((d) => {
      d.slides.push(emptySlide())
    })

  const removeSlide = (index: number) =>
    commit((d) => {
      d.slides.splice(index, 1)
    })

  const moveSlide = (index: number, dir: -1 | 1) =>
    commit((d) => {
      const next = index + dir
      if (next < 0 || next >= d.slides.length) return
      const [item] = d.slides.splice(index, 1)
      d.slides.splice(next, 0, item)
    })

  const setAutoplay = (raw: string) =>
    commit((d) => {
      const n = Number(raw)
      d.autoplay_ms = raw === "" || !isFinite(n) ? DEFAULT_AUTOPLAY_MS : Math.max(0, n)
    })

  return (
    <div className="flex flex-col gap-y-6">
      {!isDefaultLocale && (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Editing {localeLabel} translations. Slide order, images, links and
            autoplay are managed in the EN tab — only the text is editable here.
            Leave a field empty to use the English value.
          </Text>
        </div>
      )}

      {/* Autoplay (locale-invariant) */}
      <div className="flex flex-col gap-y-1.5">
        <Label size="small" weight="plus">
          Autoplay interval (ms)
        </Label>
        <Input
          type="number"
          min={0}
          step={500}
          value={String(data.autoplay_ms ?? DEFAULT_AUTOPLAY_MS)}
          disabled={!isDefaultLocale}
          placeholder={String(DEFAULT_AUTOPLAY_MS)}
          onChange={(e) => setAutoplay(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          Time each slide stays visible before advancing. Default 5000 (5s); use
          0 to disable autoplay.
        </Text>
      </div>

      {/* Slides */}
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col">
            <Label size="small" weight="plus">
              Slides
            </Label>
            <Text size="xsmall" className="text-ui-fg-muted">
              {data.slides.length}{" "}
              {data.slides.length === 1 ? "slide" : "slides"}
            </Text>
          </div>
          {isDefaultLocale && (
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={addSlide}
            >
              <Plus />
              Add slide
            </Button>
          )}
        </div>

        {data.slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed border-ui-border-strong bg-ui-bg-subtle px-6 py-10 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              {isDefaultLocale
                ? "No slides yet. Add your first slide to get started."
                : "No slides to translate."}
            </Text>
          </div>
        ) : (
          data.slides.map((slide, index) => (
            <div
              key={index}
              className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-4"
            >
              {/* Slide header / controls */}
              <div className="flex items-center justify-between gap-x-2">
                <Text size="small" weight="plus">
                  Slide {index + 1}
                </Text>
                {isDefaultLocale && (
                  <div className="flex items-center gap-x-1">
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSlide(index, -1)}
                      aria-label="Move slide up"
                    >
                      <ArrowUpMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      disabled={index === data.slides.length - 1}
                      onClick={() => moveSlide(index, 1)}
                      aria-label="Move slide down"
                    >
                      <ArrowDownMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      onClick={() => removeSlide(index)}
                      aria-label="Remove slide"
                    >
                      <Trash />
                    </IconButton>
                  </div>
                )}
              </div>

              {/* Image (locale-invariant) */}
              <ImagePicker
                label="Image"
                hint="Background image for this slide (shared across all languages)."
                clearable
                disabled={!isDefaultLocale}
                value={slide.image}
                onChange={(url) => updateSlide(index, { image: url })}
              />

              {/* Text fields (localized) */}
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small" weight="plus">
                    Subtitle{!isDefaultLocale && ` · ${localeLabel}`}
                  </Label>
                  <Input
                    value={slide.subtitle ?? ""}
                    placeholder={isDefaultLocale ? "Handicraft shop" : undefined}
                    onChange={(e) =>
                      updateSlide(index, { subtitle: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-y-1.5">
                  <Label size="small" weight="plus">
                    CTA label{!isDefaultLocale && ` · ${localeLabel}`}
                  </Label>
                  <Input
                    value={slide.cta.label ?? ""}
                    placeholder={isDefaultLocale ? "shop now" : undefined}
                    onChange={(e) =>
                      updateCta(index, { label: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Title{!isDefaultLocale && ` · ${localeLabel}`}
                </Label>
                <Textarea
                  value={slide.title}
                  rows={2}
                  placeholder={
                    isDefaultLocale ? "Inspired by Your\nSweetest Dreams" : undefined
                  }
                  onChange={(e) => updateSlide(index, { title: e.target.value })}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Use a line break (Enter) to split the heading onto two lines.
                </Text>
              </div>

              {/* CTA href (locale-invariant) */}
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  CTA link
                </Label>
                <Input
                  value={slide.cta.href}
                  disabled={!isDefaultLocale}
                  placeholder="/store"
                  className={clx(!isDefaultLocale && "font-mono")}
                  onChange={(e) => updateCta(index, { href: e.target.value })}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Where the button links to (shared across all languages).
                </Text>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default HeroSliderEditor
