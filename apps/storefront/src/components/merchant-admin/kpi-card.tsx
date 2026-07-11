"use client"

import React from "react"
import { cn } from "@lib/util/cn"

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "grey",
}: {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  trend?: string
  tone?: "grey" | "brand" | "green"
}) {
  const toneClasses = {
    grey: "bg-grey-10 text-grey-60",
    brand: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
  }

  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-grey-50">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-grey-90">{value}</p>
        </div>
        {Icon && (
          <div className={cn("shrink-0 rounded-base p-2 transition-colors", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && <p className="mt-3 text-xs text-grey-50">{trend}</p>}
    </div>
  )
}
