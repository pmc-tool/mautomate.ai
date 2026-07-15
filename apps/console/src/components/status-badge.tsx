"use client"

import { cn } from "@/lib/utils"

type BadgeTone = "grey" | "green" | "amber" | "red" | "blue"

function toneForStatus(status: string): BadgeTone {
  switch (status?.toLowerCase()) {
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
    case "configured":
      return "green"
    case "pending":
    case "processing":
    case "draft":
    case "partially_fulfilled":
    case "requires_action":
    case "provisioning":
      return "amber"
    case "failed":
    case "canceled":
    case "unverified":
    case "rejected":
    case "refunded":
    case "suspended":
      return "red"
    case "info":
    case "not_fulfilled":
      return "blue"
    default:
      return "grey"
  }
}

const toneClasses: Record<BadgeTone, string> = {
  grey: "bg-grey-10 text-grey-70 ring-grey-20",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
}

const dotClasses: Record<BadgeTone, string> = {
  grey: "bg-grey-400",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
}

export function StatusBadge({ status }: { status: string }) {
  const tone = toneForStatus(status)
  const label = status.replace(/_/g, " ")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset",
        toneClasses[tone]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />
      {label}
    </span>
  )
}
