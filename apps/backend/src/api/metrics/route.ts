import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

/**
 * GET /metrics
 *
 * Prometheus-compatible metrics endpoint exposing platform-wide business +
 * financial totals. SECURITY: this is gated behind the platform super-admin
 * allowlist in api/middlewares.ts (authenticate("user") + requirePlatformSuperAdmin)
 * — it was previously unauthenticated ("restrict at the edge"), which leaked
 * customer counts / growth / credit totals to anyone who could reach it and let
 * an anonymous caller trigger unbounded scans. Scrapers must present a platform
 * super-admin bearer token.
 */

/**
 * SECURITY INVARIANT: bound every scan. The old handler loaded THREE lists with
 * `take: 100000`, so a single hit could scan hundreds of thousands of rows (a
 * cheap DoS lever). Each scan is now page-bounded to MAX_SCAN rows so one hit can
 * never be weaponised into an unbounded table scan; `b2d_metrics_truncated` is
 * surfaced when the cap is reached so the totals are read as lower bounds.
 */
const PAGE_SIZE = 1000
const MAX_SCAN = 20000

async function loadBounded(
  list: (filters: any, config: any) => Promise<any[]>
): Promise<{ rows: any[]; truncated: boolean }> {
  const rows: any[] = []
  for (let skip = 0; skip < MAX_SCAN; skip += PAGE_SIZE) {
    const page = await list({}, { take: PAGE_SIZE, skip }).catch(() => [])
    rows.push(...page)
    if (page.length < PAGE_SIZE) {
      return { rows, truncated: false }
    }
  }
  return { rows, truncated: true }
}
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const lines: string[] = []
  const now = Date.now()

  // Node runtime metrics
  const mem = process.memoryUsage()
  lines.push("# HELP nodejs_heap_size_total_bytes Total heap size in bytes.")
  lines.push("# TYPE nodejs_heap_size_total_bytes gauge")
  lines.push(`nodejs_heap_size_total_bytes ${mem.heapTotal}`)

  lines.push("# HELP nodejs_heap_size_used_bytes Used heap size in bytes.")
  lines.push("# TYPE nodejs_heap_size_used_bytes gauge")
  lines.push(`nodejs_heap_size_used_bytes ${mem.heapUsed}`)

  lines.push("# HELP nodejs_memory_rss_bytes Resident set size in bytes.")
  lines.push("# TYPE nodejs_memory_rss_bytes gauge")
  lines.push(`nodejs_memory_rss_bytes ${mem.rss}`)

  lines.push("# HELP nodejs_uptime_seconds Process uptime in seconds.")
  lines.push("# TYPE nodejs_uptime_seconds gauge")
  lines.push(`nodejs_uptime_seconds ${Math.floor(process.uptime())}`)

  // Application business metrics
  try {
    const svc: any = req.scope.resolve(PLATFORM_MODULE)
    const [tenantsRes, walletsRes, txnsRes] = await Promise.all([
      loadBounded((f, c) => svc.listTenants(f, c)),
      loadBounded((f, c) => svc.listCreditWallets(f, c)),
      loadBounded((f, c) => svc.listCreditTransactions(f, c)),
    ])
    const tenants = tenantsRes.rows
    const wallets = walletsRes.rows
    const txns = txnsRes.rows
    const truncated =
      tenantsRes.truncated || walletsRes.truncated || txnsRes.truncated

    const byStatus: Record<string, number> = {}
    for (const t of tenants) {
      byStatus[t.status ?? "unknown"] = (byStatus[t.status ?? "unknown"] ?? 0) + 1
    }

    lines.push("# HELP b2d_tenants_total Total number of tenants.")
    lines.push("# TYPE b2d_tenants_total gauge")
    lines.push(`b2d_tenants_total ${tenants.length}`)

    for (const [status, count] of Object.entries(byStatus)) {
      lines.push(`b2d_tenants_by_status{status="${escapeLabel(status)}"} ${count}`)
    }

    const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.balance ?? 0), 0)
    const totalReserved = wallets.reduce((sum: number, w: any) => sum + Number(w.reserved ?? 0), 0)

    lines.push("# HELP b2d_credits_balance_total Total credit balance across all wallets.")
    lines.push("# TYPE b2d_credits_balance_total gauge")
    lines.push(`b2d_credits_balance_total ${totalBalance}`)

    lines.push("# HELP b2d_credits_reserved_total Total reserved credits across all wallets.")
    lines.push("# TYPE b2d_credits_reserved_total gauge")
    lines.push(`b2d_credits_reserved_total ${totalReserved}`)

    let granted = 0
    let spent = 0
    for (const tx of txns) {
      if (["grant", "topup", "refund"].includes(tx.type)) granted += Number(tx.amount ?? 0)
      if (tx.type === "commit") spent += Math.abs(Number(tx.amount ?? 0))
    }

    lines.push("# HELP b2d_credits_granted_total Total credits granted/topup/refunded.")
    lines.push("# TYPE b2d_credits_granted_total counter")
    lines.push(`b2d_credits_granted_total ${granted}`)

    lines.push("# HELP b2d_credits_spent_total Total credits committed/spent.")
    lines.push("# TYPE b2d_credits_spent_total counter")
    lines.push(`b2d_credits_spent_total ${spent}`)

    lines.push(
      "# HELP b2d_metrics_truncated 1 when a metrics scan hit its row cap (totals are lower bounds)."
    )
    lines.push("# TYPE b2d_metrics_truncated gauge")
    lines.push(`b2d_metrics_truncated ${truncated ? 1 : 0}`)
  } catch (e: any) {
    lines.push(`# metrics collection error: ${escapeLabel(String(e?.message ?? e))}`)
  }

  lines.push("")
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  res.status(200).send(lines.join("\n"))
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
}
