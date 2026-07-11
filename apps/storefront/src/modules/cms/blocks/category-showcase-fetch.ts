import { HttpTypes } from "@medusajs/types"

import { listCategories } from "@lib/data/categories"

/* ------------------------------------------------------------------ */
/* Shared, server-only tile resolution for the category_showcase block. */
/*                                                                      */
/* Extracted so EVERY theme's live async server block (CategoryShowcase */
/* .tsx) and the visual-editor bridge (/api/puck/category-tiles) resolve */
/* the showcase tiles through the EXACT same code — no drift between     */
/* what the editor previews and what the storefront ships. Server-only   */
/* (imports lib/data/categories, which touches cookies/headers).         */
/*                                                                      */
/* Resolution mirrors the original per-theme logic byte-for-byte: live   */
/* categories are indexed by id; a tile bound to a MISSING category is    */
/* dropped (dangling-ref safe); a tile WITHOUT a category_id is static    */
/* and always kept; the item count comes from the category's             */
/* `products.length`; the href falls back to `/categories/<handle>` then  */
/* `/store`. Each theme's View applies its own fallback imagery.          */
/* ------------------------------------------------------------------ */

export interface CategoryShowcaseItem {
  category_id?: string
  label: string
  image: string
  href: string
}

/** A resolved, theme-neutral showcase tile (each View skins it). */
export interface CategoryTile {
  label: string
  image: string
  href: string
  count?: number
}

/**
 * Resolve the renderable tiles for a category_showcase block. Never throws — a
 * failed category fetch degrades to "no live counts" and static tiles still
 * render. Dangling category references are dropped.
 */
export async function fetchCategoryTiles(
  items: CategoryShowcaseItem[]
): Promise<CategoryTile[]> {
  // Resolve live categories once; index by id for O(1) lookup.
  const categories = await listCategories().catch(
    () => [] as HttpTypes.StoreProductCategory[]
  )
  const byId = new Map<string, HttpTypes.StoreProductCategory>(
    categories.map((c) => [c.id, c])
  )

  return items
    .map((item): CategoryTile | null => {
      const cat = item.category_id ? byId.get(item.category_id) : undefined

      // Dangling ref: the tile points at a category that no longer exists.
      if (item.category_id && !cat) {
        return null
      }

      const count = cat?.products?.length
      const href =
        item.href || (cat?.handle ? `/categories/${cat.handle}` : "/store")

      return {
        label: item.label || cat?.name || "",
        image: item.image,
        href,
        count,
      }
    })
    .filter((t): t is CategoryTile => t !== null)
}
