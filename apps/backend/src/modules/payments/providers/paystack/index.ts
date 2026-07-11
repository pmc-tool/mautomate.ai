import type { ModuleProviderExports } from "@medusajs/framework/types"

import PaystackProvider from "../redirect/paystack"

const providerExport: ModuleProviderExports = {
  services: [PaystackProvider],
}

export default providerExport
