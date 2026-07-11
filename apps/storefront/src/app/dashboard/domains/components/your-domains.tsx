"use client"

import React, { useState } from "react"
import { Spinner, ArrowPath, Trash, CogSixTooth, Globe } from "@medusajs/icons"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Domain, verifyDomain, disconnectDomain } from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { Callout, btnSecondary } from "./ui"
import { ManageDomainModal } from "./manage-domain-modal"

export function YourDomains({
  token,
  domains,
  loading,
  registrarConfigured,
  onChanged,
}: {
  token: string
  domains: Domain[]
  loading: boolean
  registrarConfigured: boolean | null
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manage, setManage] = useState<Domain | null>(null)

  const free = domains.find((d) => d.type === "free")
  const custom = domains.filter((d) => d.type === "custom")

  const rows: Domain[] = [
    ...(free ? [free] : []),
    ...custom,
  ]

  const handleVerify = async (d: Domain) => {
    setBusyId(d.id)
    setError(null)
    try {
      await verifyDomain(token, d.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check status")
    } finally {
      setBusyId(null)
    }
  }

  const handleDisconnect = async (d: Domain) => {
    if (!confirm(`Disconnect ${d.domain}? Your store will stop responding on it.`)) return
    setBusyId(d.id)
    setError(null)
    try {
      await disconnectDomain(token, d.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Callout tone="warning">{error}</Callout>}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-grey-50">
          <Spinner className="h-5 w-5 animate-spin" /> Loading your domains...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No domains yet"
          description="Your free mAutomate address will appear here, along with any domain you buy, connect or transfer in."
        />
      ) : (
        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-grey-10 text-grey-60">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Ownership</th>
                  <th className="px-4 py-3 font-medium">SSL</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {rows.map((d) => {
                  const isFree = d.type === "free"
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-grey-90">{d.domain}</span>
                          {d.is_primary && (
                            <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-[11px] font-medium text-grey-60">
                              Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-grey-60">
                        {isFree ? "Free subdomain" : "Custom"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.verification_status || "pending"} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.ssl_status || "pending"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isFree ? (
                            <span className="text-xs text-grey-40">Included</span>
                          ) : (
                            <>
                              <button
                                onClick={() => setManage(d)}
                                className={cn(btnSecondary, "px-3 py-1.5")}
                              >
                                <CogSixTooth className="h-4 w-4" />
                                Manage
                              </button>
                              <ActionMenu
                                items={[
                                  {
                                    label: busyId === d.id ? "Checking..." : "Check status",
                                    icon: ArrowPath,
                                    onClick: () => handleVerify(d),
                                  },
                                  {
                                    label: "Disconnect",
                                    icon: Trash,
                                    destructive: true,
                                    onClick: () => handleDisconnect(d),
                                  },
                                ]}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ManageDomainModal
        open={!!manage}
        onClose={() => setManage(null)}
        token={token}
        domain={manage}
        registrarConfigured={registrarConfigured}
      />
    </div>
  )
}
