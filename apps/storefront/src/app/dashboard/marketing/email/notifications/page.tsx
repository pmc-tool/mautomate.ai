"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Envelope, ArrowRightMini } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listNotificationTemplates,
  type NotifTemplateSummary,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"

export default function NotificationTemplatesPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<NotifTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    listNotificationTemplates(token)
      .then((r) => setTemplates(r.templates || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"))
      .finally(() => setLoading(false))
  }, [token])

  const groups = useMemo(() => {
    const by: Record<string, NotifTemplateSummary[]> = {}
    for (const t of templates) (by[t.category] ||= []).push(t)
    return Object.entries(by)
  }, [templates])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email notifications"
        description="The emails your store automatically sends customers. Every store starts with these defaults — edit any of them to match your brand and voice."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50">
          Loading templates…
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-50">
                {category}
              </h2>
              <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
                <ul className="divide-y divide-grey-10">
                  {items.map((t) => (
                    <li key={t.key}>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/marketing/email/notifications/${t.key}`)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-grey-10"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-70">
                          <Envelope className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-grey-90">{t.title}</p>
                            {t.customized && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                                Edited
                              </span>
                            )}
                            {!t.enabled && (
                              <span className="rounded-full bg-grey-10 px-2 py-0.5 text-[10px] font-medium text-grey-50">
                                Off
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-grey-50">{t.description}</p>
                        </div>
                        <ArrowRightMini className="h-5 w-5 shrink-0 text-grey-40" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
