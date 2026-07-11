import {
  StepResponse,
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"

import { getCommerceGateway } from "../../modules/call-center/gateway"

/**
 * cancel-cod-order — the call-center action that CANCELS a COD order (e.g. the
 * customer could not be reached or declined on the confirmation call).
 *
 * The single step records the cancel reason in order metadata first (so the
 * reason is durable even if the cancel itself races), then cancels the order via
 * the gateway.
 *
 * COMPENSATION is best-effort / log-only: a cancelled order generally CANNOT be
 * un-cancelled through the commerce backend, so there is nothing safe to undo
 * here. If a later step in the workflow fails, we simply record that the cancel
 * is not reversible rather than pretending to roll it back.
 */

type CancelCodOrderInput = {
  tenant_id: string
  order_id: string
  reason: string
}

type CancelCodOrderResult = {
  tenant_id: string
  order_id: string
  reason: string
  canceled: boolean
  canceled_at: string
}

/** Compensation payload — carried only so the log-only handler can identify the order. */
type CancelCodOrderCompensation = {
  tenant_id: string
  order_id: string
  reason: string
}

export const cancelCodOrderStep = createStep(
  "call-center-cancel-cod-order-step",
  async (input: CancelCodOrderInput, { container }) => {
    const gateway = getCommerceGateway(container)
    const { tenant_id, order_id, reason } = input

    const canceledAt = new Date().toISOString()

    // Record the reason in metadata BEFORE cancelling so the audit trail
    // survives even if the cancel call itself later fails.
    await gateway.updateOrderMetadata(tenant_id, order_id, {
      cc_cancel_reason: reason,
      cc_canceled_at: canceledAt,
    })

    await gateway.cancelOrder(tenant_id, order_id, reason)

    const result: CancelCodOrderResult = {
      tenant_id,
      order_id,
      reason,
      canceled: true,
      canceled_at: canceledAt,
    }

    const compensation: CancelCodOrderCompensation = {
      tenant_id,
      order_id,
      reason,
    }

    return new StepResponse(result, compensation)
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    // Best-effort, LOG-ONLY compensation. A cancelled order cannot be reliably
    // un-cancelled through the commerce backend, so there is no safe rollback.
    // We surface the situation for operators instead of attempting a reversal.
    const logger = container.resolve("logger") as {
      warn: (message: string) => void
    }
    logger.warn(
      `[call-center] cancel-cod-order compensation invoked for order ${compensation.order_id} ` +
        `(tenant ${compensation.tenant_id}, reason "${compensation.reason}"): a cancel cannot be ` +
        `un-cancelled — manual review required.`
    )
  }
)

export const cancelCodOrderWorkflow = createWorkflow(
  "call-center-cancel-cod-order",
  (input: WorkflowData<CancelCodOrderInput>) => {
    const result = cancelCodOrderStep(input)
    return new WorkflowResponse(result)
  }
)

export default cancelCodOrderWorkflow
