import type { ModuleProviderExports } from "@medusajs/framework/types"

import FlutterwaveProvider from "../redirect/flutterwave"

const providerExport: ModuleProviderExports = {
  services: [FlutterwaveProvider],
}

export default providerExport
