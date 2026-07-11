import { model } from "@medusajs/framework/utils"

/**
 * provisioning_job — the durable record of one "store ready A-to-Z" saga run.
 *
 * The provisioning workflow (Phase 1) writes per-step state into `steps` so a
 * crash can resume from persisted state and the reconciler can sweep half-
 * states. `transaction_id` links to the workflow-engine transaction; `attempts`
 * and `last_error` support idempotent re-runs.
 */
const ProvisioningJob = model
  .define("provisioning_job", {
    id: model.id({ prefix: "pjob" }).primaryKey(),
    tenant_id: model.text(),
    transaction_id: model.text().nullable(),
    status: model
      .enum([
        "pending",
        "running",
        "completed",
        "failed",
        "compensating",
        "compensated",
      ])
      .default("pending"),
    current_step: model.text().nullable(),
    steps: model.json().nullable(),
    attempts: model.number().default(0),
    last_error: model.text().nullable(),
    meta: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_provisioning_job_tenant",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_provisioning_job_txn",
      on: ["transaction_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default ProvisioningJob
