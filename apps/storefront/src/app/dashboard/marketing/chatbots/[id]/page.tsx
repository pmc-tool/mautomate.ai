"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * The per-chatbot detail page is gone: a chatbot is now edited in the studio
 * wizard, which opens over the list. This route only exists so an old bookmark
 * still lands somewhere useful instead of 404ing.
 */
export default function MarketingChatbotRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/marketing/chatbots")
  }, [router])

  return (
    <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50 shadow-borders-base">
      Opening the chatbot studio...
    </div>
  )
}
