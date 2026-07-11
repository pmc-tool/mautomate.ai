import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "./index"

/**
 * ProvisioningService — persistence + reconciliation for provisioning_job rows.
 *
 * The durable workflow writes per-step state here so a crash can resume from
 * persisted state and the reconciler can sweep half-states. The stuck-job
 * detection is a PURE function (`findStuckJobs`) so it is unit-testable without
 * a DB or the workflow engine.
 */
export type StepState = "pending" | "running" | "done" | "compensated" | "failed"

export type JobStepMap = Record<string, StepState>

/** default: a running job untouched for 10 min is considered stuck */
export const STUCK_AFTER_MS = 10 * 60 * 1000

/**
 * Pure reconciler core: given the current jobs and "now", return the ids of
 * jobs that are stuck (running/compensating but stale past the threshold).
 */
export const findStuckJobs = (
  jobs: Array<{
    id: string
    status: string
    updated_at?: Date | string | null
    attempts?: number
  }>,
  nowMs: number,
  thresholdMs: number = STUCK_AFTER_MS
): string[] => {
  const active = new Set(["running", "compensating", "pending"])
  return jobs
    .filter((j) => active.has(j.status))
    .filter((j) => {
      const t = j.updated_at ? new Date(j.updated_at).getTime() : 0
      return nowMs - t >= thresholdMs
    })
    .map((j) => j.id)
}

export class ProvisioningService {
  private readonly container_: MedusaContainer
  constructor(container: MedusaContainer) {
    this.container_ = container
  }
  private svc(): any {
    return this.container_.resolve(PLATFORM_MODULE)
  }

  async createJob(tenantId: string, steps: string[]): Promise<any> {
    const svc = this.svc()
    const stepMap: JobStepMap = Object.fromEntries(
      steps.map((s) => [s, "pending" as StepState])
    )
    const [job] = await svc.createProvisioningJobs([
      { tenant_id: tenantId, status: "running", steps: stepMap, attempts: 1 },
    ])
    return job
  }

  async markStep(jobId: string, step: string, state: StepState): Promise<void> {
    const svc = this.svc()
    const job = await svc.retrieveProvisioningJob(jobId)
    const steps: JobStepMap = { ...(job.steps ?? {}), [step]: state }
    await svc.updateProvisioningJobs({
      id: jobId,
      steps,
      current_step: step,
    })
  }

  async finish(
    jobId: string,
    status: "completed" | "failed" | "compensated",
    error?: string
  ): Promise<void> {
    await this.svc().updateProvisioningJobs({
      id: jobId,
      status,
      last_error: error ?? null,
    })
  }

  /** Reconciler entry point — find stuck jobs and flag them for retry/compensation. */
  async reconcile(nowMs: number = Date.now()): Promise<string[]> {
    const svc = this.svc()
    const jobs = await svc.listProvisioningJobs({})
    const stuck = findStuckJobs(jobs ?? [], nowMs)
    for (const id of stuck) {
      await svc.updateProvisioningJobs({
        id,
        status: "failed",
        last_error: "reconciler: stuck past threshold",
      })
    }
    return stuck
  }
}

export default ProvisioningService
