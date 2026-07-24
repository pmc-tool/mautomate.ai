import { NextRequest, NextResponse } from "next/server"
import { listProducts } from "@lib/data/products"

/* ------------------------------------------------------------------ */
/* GET /api/theme-products?ids=prod_a,prod_b&country=us                 */
/*                                                                     */
/* Product-card data for UPLOADED Liquid themes' client-rendered        */
/* surfaces — today the wishlist page, whose ids live in the browser    */
/* (localStorage ff_wishlist, the same contract the React wishlist      */
/* used). Same-origin like the other theme bridges, so the per-tenant   */
/* publishable key and region resolve exactly as everywhere else.       */
/* Cards use the SAME shape the Liquid product contract exposes.        */
/* ------------------------------------------------------------------ */

const MAX_IDS = 48

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get("ids") || ""
    const country = (req.nextUrl.searchParams.get("country") || "us")
      .trim()
      .toLowerCase()
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[a-zA-Z0-9_-]{1,64}$/.test(s))
      .slice(0, MAX_IDS)
    if (!ids.length) {
      return NextResponse.json({ products: [] })
    }
    const { response } = await listProducts({
      countryCode: country,
      queryParams: {
        id: ids,
        limit: ids.length,
        fields: "*variants.calculated_price,*images,thumbnail,title,handle",
      } as any,
    })
    const products = (response.products ?? []).map((p: any) => {
      const cp = p?.variants?.[0]?.calculated_price
      const price = cp?.calculated_amount ?? 0
      const orig = cp?.original_amount ?? null
      const currency = String(cp?.currency_code ?? "usd").toUpperCase()
      const fmt = (n: number) => {
        try {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(n)
        } catch {
          return `${currency} ${n}`
        }
      }
      return {
        id: p.id,
        title: p.title,
        handle: p.handle,
        featured_image:
          p.images?.[0] ?? (p.thumbnail ? { url: p.thumbnail } : null),
        price,
        // Pre-formatted for client-rendered surfaces (the Liquid `money`
        // filter never runs in the browser).
        price_formatted: fmt(price),
        compare_at_price: orig && orig > price ? orig : null,
        compare_at_price_formatted: orig && orig > price ? fmt(orig) : null,
        available: true,
      }
    })
    return NextResponse.json({ products })
  } catch {
    return NextResponse.json({ products: [] })
  }
}
