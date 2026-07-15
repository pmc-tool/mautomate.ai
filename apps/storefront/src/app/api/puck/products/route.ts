/* ------------------------------------------------------------------ */
/* Visual editor — resolve live products for a product_tabs block so the */
/* canvas can preview REAL products (the block itself is an async server  */
/* component the client canvas can't render directly). Reuses the exact   */
/* same server fetch as the live block, so preview == storefront.         */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import {
  DEFAULT_COUNTRY,
  fetchTabSlots,
  type ProductTab,
} from "@modules/cms/blocks/product-tabs-fetch"

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const tabs: ProductTab[] = Array.isArray(body?.tabs) ? body.tabs : []
  const countryCode =
    typeof body?.countryCode === "string" && body.countryCode
      ? body.countryCode
      : DEFAULT_COUNTRY
  try {
    const slots = await fetchTabSlots(tabs, countryCode)
    return NextResponse.json(slots)
  } catch {
    return NextResponse.json({
      newArrivals: [],
      saleItems: [],
      bestSellers: [],
    })
  }
}
