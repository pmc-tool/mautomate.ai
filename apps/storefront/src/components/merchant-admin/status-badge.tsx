"use client"

import { cn } from "@lib/util/cn"

type BadgeTone = "grey" | "green" | "amber" | "red" | "blue"

function toneForStatus(status?: string | null): BadgeTone {
  switch ((status ?? "").toLowerCase()) {
    case "published":
    case "live":
    case "active":
    case "paid":
    case "completed":
    case "fulfilled":
    case "delivered":
    case "shipped":
    case "verified":
    case "success":
      return "green"
    case "pending":
    case "processing":
    case "draft":
    case "partially_fulfilled":
    case "requires_action":
      return "amber"
    case "failed":
    case "canceled":
    case "unverified":
    case "rejected":
    case "refunded":
      return "red"
    case "info":
    case "not_fulfilled":
      return "blue"
    default:
      return "grey"
  }
}

const toneClasses: Record<BadgeTone, string> = {
  grey: "bg-grey-10 text-grey-70",
  green: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-800",
  blue: "bg-sky-50 text-sky-800",
}

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = toneForStatus(status)
  const label = (status ?? "").replace(/_/g, " ") || "—"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  )
}
