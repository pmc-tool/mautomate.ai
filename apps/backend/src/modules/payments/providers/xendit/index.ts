import type { ModuleProviderExports } from "@medusajs/framework/types"

import XenditProvider from "../redirect/xendit"

const providerExport: ModuleProviderExports = {
  services: [XenditProvider],
}

export default providerExport
