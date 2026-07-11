import type { ModuleProviderExports } from "@medusajs/framework/types"

import SslcommerzProvider from "../redirect/sslcommerz"

const providerExport: ModuleProviderExports = {
  services: [SslcommerzProvider],
}

export default providerExport
