import type { ModuleProviderExports } from "@medusajs/framework/types"

import MidtransProvider from "../redirect/midtrans"

const providerExport: ModuleProviderExports = {
  services: [MidtransProvider],
}

export default providerExport
