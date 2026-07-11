import { MedusaContainer } from "@medusajs/framework/types"

import { CommerceGateway, getCommerceGateway } from "../gateway"
import {
  RiskBand,
  RiskInput,
  scoreOrderRisk,
  shouldHoldForConfirmation,
} from "./risk"

/**
 * FulfillmentGateService — the call-center's gate between "order placed" and
 * "order allowed to fulfill".
 *
 * Medusa has NO native payment->fulfillment gate (see README.md in this dir), so
 * the hold lives in order metadata (`cc_fulfillment_hold`) and is enforced by
 * OUR code. This service is the one place that decides to set/clear that flag,
 * driven by the deterministic `scoreOrderRisk`.
 *
 * All public methods are NO-THROW: they catch backend errors and return a
 * structured result so the caller (order-placed subscriber, dialer) is never
 * broken by a transient gateway failure. Inspect `.ok` / `.error`.
 */

export type EvaluateAndHoldResult = {
  ok: boolean
  /** True when the order was placed on fulfillment hold for confirmation. */
  held: boolean
  band: RiskBand | null
  reasons: string[]
  score: number | null
  error?: string
}

export type AutoReleaseResult = {
  ok: boolean
  released: boolean
  error?: string
}

/** Metadata marker written when the dialer gives up but we release anyway. */
export const AUTO_RELEASED_UNREACHABLE_TAG = "cc:auto-released-unreachable"

export class FulfillmentGateService {
  private readonly gateway: CommerceGateway

  constructor(container: MedusaContainer) {
    this.gateway = getCommerceGateway(container)
  }

  /**
   * Score the order and, if the band warrants it, place it on fulfillment hold.
   * Used by the order-placed path.
   *
   *  - shouldHold (medium/hard) -> markFulfillmentHold(..., true), return band + reasons.
   *  - otherwise (low)          -> markFulfillmentHold(..., false) to auto-release,
   *                                return the band so the caller can log it.
   *
   * NOTE: the gateway exposes a single `markFulfillmentHold(tenantId, orderId,
   * held)`; releasing is simply `held = false` (there is no separate
   * `releaseFulfillmentHold` on the contract).
   */
  async evaluateAndHold(
    tenantId: string,
    orderId: string,
    riskInput: RiskInput
  ): Promise<EvaluateAndHoldResult> {
    const { score, band, reasons } = scoreOrderRisk(riskInput)
    const hold = shouldHoldForConfirmation(band)

    try {
      await this.gateway.markFulfillmentHold(tenantId, orderId, hold)
      return { ok: true, held: hold, band, reasons, score }
    } catch (e) {
      return {
        ok: false,
        held: false,
        band,
        reasons,
        score,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  /**
   * Release the fulfillment hold and tag the order as auto-released because the
   * customer could not be reached. The dialer calls this AFTER its max
   * confirmation attempts so a genuinely unreachable-but-legit COD order is
   * NEVER stranded on hold forever.
   */
  async autoReleaseIfUnreachable(
    tenantId: string,
    orderId: string
  ): Promise<AutoReleaseResult> {
    try {
      await this.gateway.markFulfillmentHold(tenantId, orderId, false)
      // Tag via metadata (the tag set is a call-center metadata concept).
      await this.gateway.updateOrderMetadata(tenantId, orderId, {
        cc_auto_released_unreachable: true,
        cc_auto_released_at: new Date().toISOString(),
        cc_auto_released_tag: AUTO_RELEASED_UNREACHABLE_TAG,
      })
      return { ok: true, released: true }
    } catch (e) {
      return {
        ok: false,
        released: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }
}
