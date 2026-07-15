"use client"

import React from "react"
import { InboxSolid } from "@medusajs/icons"
import { cn } from "@/lib/utils"

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = InboxSolid,
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
        "flex flex-col items-center justify-center rounded-large border border-grey-20 bg-white p-8 text-center shadow-borders-base",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-grey-10 text-grey-50">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-grey-90">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-grey-50">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
