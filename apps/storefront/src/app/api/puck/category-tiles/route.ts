/* ------------------------------------------------------------------ */
/* Visual editor — resolve live category tiles for a category_showcase    */
/* block so the canvas can preview REAL categories (with live item counts */
/* + resolved hrefs) using the ACTIVE theme's own markup. Reuses the exact */
/* same server resolver as the live theme blocks, so preview == storefront.*/
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import {
  fetchCategoryTiles,
  type CategoryShowcaseItem,
} from "@modules/cms/blocks/category-showcase-fetch"

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const items: CategoryShowcaseItem[] = Array.isArray(body?.items)
    ? body.items
    : []
  try {
    const tiles = await fetchCategoryTiles(items)
    return NextResponse.json({ tiles })
  } catch {
    return NextResponse.json({ tiles: [] })
  }
}
