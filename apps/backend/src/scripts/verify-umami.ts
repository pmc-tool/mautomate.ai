import { PLATFORM_MODULE } from "../modules/platform"
import { getOrCreateTenantWebsite, websiteStats, rangeFor } from "../lib/umami"

export default async function verifyUmami({ container }: any) {
  const svc: any = container.resolve(PLATFORM_MODULE)
  const t1 = await svc.retrieveTenant("ten_01KX1C5HT67VS85MGEVT4A6HQB")
  const w1 = await getOrCreateTenantWebsite(svc, t1)
  console.log("[umami] tenant1", t1.slug, "-> website", w1)

  const others = await svc.listTenants({}, { take: 8 }).catch(() => [])
  const t2 = (others as any[]).find((t) => t.id !== t1.id)
  const w2 = t2 ? await getOrCreateTenantWebsite(svc, t2) : null
  console.log("[umami] tenant2", t2?.slug, "-> website", w2)

  const t1b = await svc.retrieveTenant(t1.id)
  const persisted = t1b?.meta?.umami_website_id

  const checks: [string, boolean][] = [
    ["tenant1 got a website", !!w1],
    ["tenant2 got a DIFFERENT website (isolation)", !!w2 && w1 !== w2],
    ["website_id persisted on tenant.meta", persisted === w1],
    ["re-resolve is idempotent (no new site)", (await getOrCreateTenantWebsite(svc, t1b)) === w1],
  ]
  let pass = true
  for (const [n, c] of checks) { console.log(`[umami] ${c ? "PASS" : "FAIL"} — ${n}`); if (!c) pass = false }

  const stats = await websiteStats(w1!, rangeFor("7d")).catch((e) => ({ err: String(e) }))
  console.log("[umami] stats:", JSON.stringify(stats))
  console.log(`[umami] OVERALL ${pass ? "PASS" : "FAIL"}`)
}
