"use client"

import React from "react"
import { BuildingStorefront } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = BuildingStorefront,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-large border border-grey-20 bg-white p-10 text-center shadow-borders-base",
        className
      )}
    >
      <div className="mb-4 rounded-full bg-grey-10 p-3 text-grey-50">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-grey-90">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-grey-50">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
