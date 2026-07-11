import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { ensurePricingSeed } from "../_pricing"

/** POST /admin/platform/packages — create a package. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  await ensurePricingSeed(req.scope)
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const b = (req.body ?? {}) as any
  if (!b.key || !b.name) return res.status(400).json({ message: "key and name required" })

  const parseNullableInt = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.floor(n) : null
  }

  const parseFeatures = (v: unknown): string[] | null => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
    if (typeof v === "string") {
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return null
  }

  const [row] = await svc.createPlatformPackages([{
    key: String(b.key).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    name: b.name,
    price_usd: Number(b.price_usd || 0),
    included_credits: Number(b.included_credits || 0),
    fixed_infra_usd: Number(b.fixed_infra_usd || 0),
    products_limit: parseNullableInt(b.products_limit),
    seats_limit: parseNullableInt(b.seats_limit),
    domains_limit: parseNullableInt(b.domains_limit),
    features: parseFeatures(b.features),
    active: b.active !== false,
    sort: Number(b.sort || 99),
  }])
  res.status(201).json(row)
}
