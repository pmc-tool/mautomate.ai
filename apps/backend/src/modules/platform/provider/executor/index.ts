import type { InfraExecutor } from "./types"
import { DryRunExecutor } from "./dry-run"
import { ComposeExecutor } from "./compose"
import { HostExecutor } from "./host"

export * from "./types"
export { DryRunExecutor } from "./dry-run"
export { ComposeExecutor } from "./compose"
export { HostExecutor } from "./host"

let cached: InfraExecutor | undefined

/**
 * Select the infra executor by `PROVISIONER_MODE`:
 *   host    -> process-per-tenant on the VM (own DB + own pm2 process) — the
 *              proven substrate for the first tenants.
 *   compose -> Docker-Compose per tenant (scale/isolation path).
 *   (unset) -> inert dry-run, so the saga is safe before a substrate is wired.
 * Cached per process.
 */
export const getInfraExecutor = (): InfraExecutor => {
  if (cached) return cached
  const host = new HostExecutor()
  if (host.isConfigured()) return (cached = host)
  const compose = new ComposeExecutor()
  cached = compose.isConfigured() ? compose : new DryRunExecutor()
  return cached
}

/** Test hook: reset the cached executor. */
export const __resetInfraExecutor = () => {
  cached = undefined
}
