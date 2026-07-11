import type { ModuleProviderExports } from "@medusajs/framework/types"

import MercadopagoProvider from "../redirect/mercadopago"

const providerExport: ModuleProviderExports = {
  services: [MercadopagoProvider],
}

export default providerExport
