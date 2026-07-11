import type { ModuleProviderExports } from "@medusajs/framework/types"

import PaypalProvider from "../redirect/paypal"

const providerExport: ModuleProviderExports = {
  services: [PaypalProvider],
}

export default providerExport
