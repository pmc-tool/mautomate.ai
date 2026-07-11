import type { ModuleProviderExports } from "@medusajs/framework/types"

import RazorpayProvider from "../redirect/razorpay"

const providerExport: ModuleProviderExports = {
  services: [RazorpayProvider],
}

export default providerExport
