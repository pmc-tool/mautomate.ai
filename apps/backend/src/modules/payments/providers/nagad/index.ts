import type { ModuleProviderExports } from "@medusajs/framework/types"

import { NagadProvider } from "../redirect/scaffolds"

const providerExport: ModuleProviderExports = {
  services: [NagadProvider],
}

export default providerExport
