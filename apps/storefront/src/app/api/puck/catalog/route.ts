/* Visual editor — products + categories for the picker controls. */
import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

export async function GET(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const h = { "x-publishable-api-key": pubKey }
  try {
    const [pRes, cRes] = await Promise.all([
      fetch(`${backend}/store/products?limit=100&fields=id,title,thumbnail`, { headers: h, cache: "no-store" }).catch(() => null),
      fetch(`${backend}/store/product-categories?limit=100&fields=id,name`, { headers: h, cache: "no-store" }).catch(() => null),
    ])
    const pBody = pRes && pRes.ok ? await pRes.json() : { products: [] }
    const cBody = cRes && cRes.ok ? await cRes.json() : { product_categories: [] }
    return NextResponse.json({
      products: (pBody?.products ?? []).map((p: any) => ({ id: p.id, label: p.title, thumbnail: p.thumbnail ?? null })),
      categories: (cBody?.product_categories ?? []).map((c: any) => ({ id: c.id, label: c.name })),
    })
  } catch {
    return NextResponse.json({ products: [], categories: [] })
  }
}
