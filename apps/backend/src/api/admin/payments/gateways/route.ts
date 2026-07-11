import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { PAYMENT_GATEWAYS } from "../../../../modules/payments/registry"
import {
  buildGatewayStatus,
  enabledProviderIds,
  primaryStoreCountry,
  readRegions,
  storeCountrySet,
} from "./_helpers"

/**
 * GET /admin/payments/gateways
 *
 * Lists every payment gateway in the registry with, for THIS tenant:
 *   - configured: are all required credentials present in the vault?
 *   - enabled:    is the gateway's provider id enabled on any store region?
 *   - available:  does the gateway serve the store's country (or is it global)?
 *   - values:     non-secret values in plain, secret values masked ("••••••••")
 *                 when set and "" when unset.
 *
 * Response: { store_country, store_countries, gateways: GatewayStatus[] }.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const cfg = new EncryptedConfigService(req.scope)

  const regions = await readRegions(req.scope)
  const countries = storeCountrySet(regions)
  const enabled = enabledProviderIds(regions)
  const storeCountry = primaryStoreCountry(regions)

  const gateways = await Promise.all(
    PAYMENT_GATEWAYS.map((gateway) =>
      buildGatewayStatus(cfg, gateway, enabled, countries)
    )
  )

  res.json({
    store_country: storeCountry,
    store_countries: [...countries],
    gateways,
  })
}
