/**
 * size-presets — the fixed catalog of platform ad/image sizes the product-image
 * studio can render to. Each preset is an exact pixel canvas keyed by a stable
 * `key` the API and UI reference. Adding a platform size is a one-entry edit
 * here with NO change to the compositing pipeline.
 */

/** A single platform image size. */
export type SizePreset = {
  /** Stable machine key, e.g. "instagram_square". */
  key: string
  /** Human label for the UI. */
  label: string
  /** Canvas width in pixels. */
  width: number
  /** Canvas height in pixels. */
  height: number
  /** Owning platform / surface (grouping hint for the UI). */
  platform: string
}

/** The supported platform sizes, keyed by `key`. */
export const SIZE_PRESETS: Record<string, SizePreset> = {
  instagram_square: {
    key: "instagram_square",
    label: "Instagram Square",
    width: 1080,
    height: 1080,
    platform: "instagram",
  },
  instagram_portrait: {
    key: "instagram_portrait",
    label: "Instagram Portrait",
    width: 1080,
    height: 1350,
    platform: "instagram",
  },
  story_reel: {
    key: "story_reel",
    label: "Story / Reel",
    width: 1080,
    height: 1920,
    platform: "instagram",
  },
  facebook_feed: {
    key: "facebook_feed",
    label: "Facebook Feed",
    width: 1200,
    height: 630,
    platform: "facebook",
  },
  facebook_square: {
    key: "facebook_square",
    label: "Facebook Square",
    width: 1080,
    height: 1080,
    platform: "facebook",
  },
  x_landscape: {
    key: "x_landscape",
    label: "X Landscape",
    width: 1600,
    height: 900,
    platform: "x",
  },
  pinterest: {
    key: "pinterest",
    label: "Pinterest Pin",
    width: 1000,
    height: 1500,
    platform: "pinterest",
  },
  og: {
    key: "og",
    label: "Open Graph",
    width: 1200,
    height: 630,
    platform: "web",
  },
}

/** Look up a preset by key, or undefined when unknown. */
export const getPreset = (key: string): SizePreset | undefined =>
  SIZE_PRESETS[key]

/** List every preset as an array (stable insertion order). */
export const listPresets = (): SizePreset[] => Object.values(SIZE_PRESETS)
