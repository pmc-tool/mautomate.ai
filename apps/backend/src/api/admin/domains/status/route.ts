import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  isResellerConfigured,
  getResellerConfig,
} from "../../../../modules/domains/provider"

/**
 * GET /admin/domains/status
 *
 * Whether the ResellerClub credentials are configured, and whether the
 * integration is pointed at the test API. Lets the UI prompt to configure.
 */
export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const configured = isResellerConfigured()
    const test_mode = getResellerConfig().testMode
    res.json({ configured, test_mode })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Failed to load registrar status" })
  }
}
