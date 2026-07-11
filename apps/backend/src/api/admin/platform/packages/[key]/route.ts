import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"

/** PUT /admin/platform/packages/:key — update a package. DELETE — remove it. */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [existing] = await svc.listPlatformPackages({ key: req.params.key }, { take: 1 })
  if (!existing) return res.status(404).json({ message: "package not found" })
  const b = (req.body ?? {}) as any
  const patch: any = { id: existing.id }

  for (const f of ["name", "price_usd", "included_credits", "fixed_infra_usd", "active", "sort"]) {
    if (b[f] !== undefined) patch[f] = f === "active" ? !!b[f] : (["name"].includes(f) ? b[f] : Number(b[f]))
  }

  if (b.products_limit !== undefined) {
    patch.products_limit = b.products_limit === null || b.products_limit === "" ? null : Math.floor(Number(b.products_limit))
  }
  if (b.seats_limit !== undefined) {
    patch.seats_limit = b.seats_limit === null || b.seats_limit === "" ? null : Math.floor(Number(b.seats_limit))
  }
  if (b.domains_limit !== undefined) {
    patch.domains_limit = b.domains_limit === null || b.domains_limit === "" ? null : Math.floor(Number(b.domains_limit))
  }
  if (b.features !== undefined) {
    if (Array.isArray(b.features)) {
      patch.features = b.features.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
    } else if (typeof b.features === "string") {
      patch.features = b.features.split(",").map((s: string) => s.trim()).filter(Boolean)
    } else {
      patch.features = null
    }
  }

  await svc.updatePlatformPackages(patch)
  res.json({ ...existing, ...patch })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [existing] = await svc.listPlatformPackages({ key: req.params.key }, { take: 1 })
  if (existing) await svc.deletePlatformPackages([existing.id])
  res.json({ key: req.params.key, deleted: true })
}
