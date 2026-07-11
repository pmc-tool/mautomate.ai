import type { ModuleProviderExports } from "@medusajs/framework/types"

import StripeGatewayProvider from "./service"

const services = [StripeGatewayProvider]

const providerExport: ModuleProviderExports = {
  services,
}

export default providerExport
export { StripeGatewayProvider }
