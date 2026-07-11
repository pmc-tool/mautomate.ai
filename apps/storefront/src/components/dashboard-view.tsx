"use client"

import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/merchant-admin/utils"

export function DashboardView() {
  const { me } = useMerchantAuth()

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-grey-90">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-grey-20 rounded-large p-6">
          <p className="text-sm text-grey-50 mb-1">Store</p>
          <p className="text-lg font-semibold text-grey-90">{me?.store.name}</p>
          <p className="text-sm text-grey-60">Slug: {me?.store.slug}</p>
          <p className="text-sm text-grey-60">Status: {me?.store.status}</p>
          {me?.store.domain && <p className="text-sm text-grey-60">Domain: {me.store.domain}</p>}
        </div>
        <div className="bg-white border border-grey-20 rounded-large p-6">
          <p className="text-sm text-grey-50 mb-1">Merchant</p>
          <p className="text-lg font-semibold text-grey-90">{me?.merchant.name}</p>
          <p className="text-sm text-grey-60">{me?.merchant.email}</p>
          <p className="text-sm text-grey-60">MFA: {me?.merchant.mfa_enabled ? "Enabled" : "Disabled"}</p>
        </div>
      </div>
    </div>
  )
}
