/* ------------------------------------------------------------------ */
/* Which variant the shopper has selected — shared between the variant  */
/* picker and the image gallery.                                        */
/*                                                                     */
/* These two live in DIFFERENT React trees on the product page (every    */
/* theme composes them side by side), so there is no common provider to  */
/* hang a context on — and adding one would mean editing all nine theme  */
/* PDPs. A module-level store read through useSyncExternalStore joins     */
/* them with no provider at all: ProductActions publishes the selection,  */
/* ImageGallery subscribes, and any theme that renders both gets the      */
/* behaviour for free.                                                   */
/*                                                                     */
/* Scoped by product id so a page holding two products (quick-view over   */
/* a listing) can never cross the streams.                              */
/* ------------------------------------------------------------------ */

type Selection = { productId: string; variantId: string } | null

let selection: Selection = null
const listeners = new Set<() => void>()

export function subscribeVariantSelection(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getVariantSelection(): Selection {
  return selection
}

/** Server render has no selection — every image shows, exactly as today. */
export function getServerVariantSelection(): Selection {
  return null
}

export function setVariantSelection(
  productId: string | undefined,
  variantId: string | undefined | null
): void {
  const next: Selection =
    productId && variantId ? { productId, variantId } : null
  const same =
    (next === null && selection === null) ||
    (!!next &&
      !!selection &&
      next.productId === selection.productId &&
      next.variantId === selection.variantId)
  if (same) {
    return
  }
  selection = next
  listeners.forEach((cb) => cb())
}

/** The selected variant id for THIS product, or null. */
export function selectedVariantFor(productId?: string): string | null {
  if (!productId || !selection || selection.productId !== productId) {
    return null
  }
  return selection.variantId
}

/**
 * The images to show for the selected variant.
 *
 * Medusa's rule, and ours: an image tagged with variants belongs to those
 * variants; an image tagged with NONE belongs to all of them. So the gallery
 * shows (images for this variant) + (untagged images). If a variant ends up
 * with nothing at all — the merchant tagged every image for other variants —
 * we show the full gallery rather than an empty frame. A shopper looking at a
 * blank product page is worse than one seeing a photo of another colour.
 */
export function imagesForVariant<
  T extends { variants?: { id: string }[] | null },
>(images: T[] | null | undefined, variantId: string | null): T[] {
  const all = Array.isArray(images) ? images : []
  if (!variantId || !all.length) {
    return all
  }
  const tagged = all.filter((img) => (img.variants?.length ?? 0) > 0)
  // Nothing is tagged at all — this product doesn't use variant images.
  if (!tagged.length) {
    return all
  }
  const shown = all.filter((img) => {
    const links = img.variants ?? []
    return links.length === 0 || links.some((v) => v.id === variantId)
  })
  return shown.length ? shown : all
}
