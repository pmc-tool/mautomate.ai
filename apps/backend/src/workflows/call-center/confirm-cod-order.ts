import {
  StepResponse,
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"

import { getCommerceGateway } from "../../modules/call-center/gateway"

/**
 * confirm-cod-order — the call-center action that CLEARS a fulfillment hold once
 * a COD order has been confirmed (usually on a confirmation call).
 *
 * Medusa has no native payment->fulfillment gate, so a held order is one whose
 * `metadata.cc_fulfillment_hold === true` (see the fulfillment README). This
 * workflow is the sanctioned way to release that gate: it drops the hold and
 * stamps confirmation metadata so the order becomes eligible to ship.
 *
 * The single step is compensated: if anything downstream in the workflow fails
 * after the release, the compensation RE-APPLIES the hold so a not-yet-confirmed
 * order can never be left shippable by a half-finished run.
 */

type ConfirmCodOrderInput = {
  tenant_id: string
  order_id: string
}

type ConfirmCodOrderResult = {
  tenant_id: string
  order_id: string
  released: boolean
  confirmed_at: string
  /** The hold value observed before we released it (for logs / audit). */
  was_held: boolean
}

/** Compensation payload — enough to restore the prior hold state. */
type ConfirmCodOrderCompensation = {
  tenant_id: string
  order_id: string
}

export const confirmCodOrderStep = createStep(
  "call-center-confirm-cod-order-step",
  async (input: ConfirmCodOrderInput, { container }) => {
    const gateway = getCommerceGateway(container)
    const { tenant_id, order_id } = input

    // Read the current hold state first so the result carries the prior value.
    const wasHeld = await gateway.isFulfillmentHeld(tenant_id, order_id)

    const confirmedAt = new Date().toISOString()

    // Release the hold, then stamp confirmation metadata.
    await gateway.markFulfillmentHold(tenant_id, order_id, false)
    await gateway.updateOrderMetadata(tenant_id, order_id, {
      cc_cod_confirmation_status: "confirmed",
      cc_confirmed_at: confirmedAt,
    })

    const result: ConfirmCodOrderResult = {
      tenant_id,
      order_id,
      released: true,
      confirmed_at: confirmedAt,
      was_held: wasHeld,
    }

    const compensation: ConfirmCodOrderCompensation = { tenant_id, order_id }

    return new StepResponse(result, compensation)
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    // Roll back: re-apply the fulfillment hold so an order that was released by
    // a run that later failed is NOT left shippable while still unconfirmed.
    const gateway = getCommerceGateway(container)
    await gateway.markFulfillmentHold(
      compensation.tenant_id,
      compensation.order_id,
      true
    )
  }
)

export const confirmCodOrderWorkflow = createWorkflow(
  "call-center-confirm-cod-order",
  (input: WorkflowData<ConfirmCodOrderInput>) => {
    const result = confirmCodOrderStep(input)
    return new WorkflowResponse(result)
  }
)

export default confirmCodOrderWorkflow
