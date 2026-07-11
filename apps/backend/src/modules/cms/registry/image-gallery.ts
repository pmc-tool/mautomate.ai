import { isNonEmptyStr, isObj, isStr, ok, type BlockDefinition } from "./types"

/**
 * image_gallery — a collage/grid of images (2-6 columns, optional captions).
 * The multi-image block the catalog was missing: merchants asking for a
 * "collage" / "gallery" / "lookbook" now have a real block for it.
 */
export interface GalleryItem {
  image: string
  caption?: string
  href?: string
}
export interface ImageGalleryData {
  heading?: string
  subheading?: string
  columns?: string
  gap?: string
  aspect?: string
  items: GalleryItem[]
}

export const IMAGE_GALLERY_SCHEMA_VERSION = 1

export const imageGalleryBlock: BlockDefinition<ImageGalleryData> = {
  type: "image_gallery",
  label: "Image Gallery",
  schemaVersion: IMAGE_GALLERY_SCHEMA_VERSION,
  defaultData: (): ImageGalleryData => ({
    heading: "Our gallery",
    subheading: "",
    columns: "3",
    gap: "12",
    aspect: "square",
    items: [
      { image: "/learts/assets/images/instagram/instagram-1.webp", caption: "" },
      { image: "/learts/assets/images/instagram/instagram-2.webp", caption: "" },
      { image: "/learts/assets/images/instagram/instagram-3.webp", caption: "" },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) return ok(["image_gallery: data must be an object"])
    if (data.heading !== undefined && !isStr(data.heading)) {
      errors.push("image_gallery: heading must be a string")
    }
    if (data.subheading !== undefined && !isStr(data.subheading)) {
      errors.push("image_gallery: subheading must be a string")
    }
    if (!Array.isArray(data.items)) {
      errors.push("image_gallery: items must be an array")
    } else {
      data.items.forEach((it, i) => {
        if (!isObj(it)) return errors.push(`image_gallery: items[${i}] must be an object`)
        if (!isNonEmptyStr(it.image)) {
          errors.push(`image_gallery: items[${i}].image is required (media URL)`)
        }
        if (it.caption !== undefined && !isStr(it.caption)) {
          errors.push(`image_gallery: items[${i}].caption must be a string`)
        }
        if (it.href !== undefined && !isStr(it.href)) {
          errors.push(`image_gallery: items[${i}].href must be a string`)
        }
      })
    }
    return ok(errors)
  },
}

export default imageGalleryBlock
