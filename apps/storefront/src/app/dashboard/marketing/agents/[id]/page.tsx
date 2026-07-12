"use client"

import { useParams, useRouter } from "next/navigation"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { AgentWizard } from "../agent-wizard"

/**
 * Deep link into one agent's studio: /dashboard/marketing/agents/<id>.
 *
 * The list opens the same wizard as an overlay; this route exists so an agent
 * can be linked, bookmarked and reloaded. Closing it returns to the list.
 */
export default function MarketingAgentPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useMerchantAuth()

  const id = typeof params?.id === "string" ? params.id : ""

  if (!token || !id) {
    return (
      <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50 shadow-borders-base">
        Loading agent...
      </div>
    )
  }

  return (
    <AgentWizard
      token={token}
      agentId={id}
      initialStep={1}
      onClose={() => router.push("/dashboard/marketing/agents")}
      onSaved={() => undefined}
    />
  )
}
