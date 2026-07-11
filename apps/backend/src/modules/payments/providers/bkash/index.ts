import type { ModuleProviderExports } from "@medusajs/framework/types"

import BkashProvider from "../redirect/bkash"

const providerExport: ModuleProviderExports = {
  services: [BkashProvider],
}

export default providerExport
