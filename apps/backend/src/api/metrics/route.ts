import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

/**
 * GET /metrics
 *
 * Prometheus-compatible metrics endpoint. Intentionally unauthenticated so
 * Prometheus can scrape it; restrict access at the network / edge level.
 */
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
    const [tenants, wallets, txns] = await Promise.all([
      svc.listTenants({}, { take: 100000 }).catch(() => []),
      svc.listCreditWallets({}, { take: 100000 }).catch(() => []),
      svc.listCreditTransactions({}, { take: 100000 }).catch(() => []),
    ])

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
