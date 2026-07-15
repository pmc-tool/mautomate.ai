/* ------------------------------------------------------------------ */
/* Visual editor — resolve live products for a product_tabs block as     */
/* GENERIC per-tab groups so the canvas can preview REAL products with    */
/* the ACTIVE theme's own markup (the block itself is an async server     */
/* component the client canvas can't render directly). Reuses the exact   */
/* same server fetch as the live theme blocks, so preview == storefront.  */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import {
  DEFAULT_COUNTRY,
  fetchTabGroups,
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
    const groups = await fetchTabGroups(tabs, countryCode)
    return NextResponse.json({ groups })
  } catch {
    return NextResponse.json({ groups: [] })
  }
}
