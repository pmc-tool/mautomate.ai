import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { listPresets } from "../../../../../modules/marketing/studio/size-presets"

/**
 * GET /admin/marketing/images/presets
 *
 * Return the catalog of platform image sizes the studio can render to.
 * Response: { presets }.
 */
export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.json({ presets: listPresets() })
}
