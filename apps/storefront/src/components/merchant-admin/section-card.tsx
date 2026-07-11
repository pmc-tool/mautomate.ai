"use client"

import React from "react"
import { cn } from "@lib/util/cn"

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  id,
  icon: Icon,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-large border border-grey-20 bg-white p-6 shadow-borders-base",
        className
      )}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="rounded-base bg-grey-10 p-2 text-grey-60">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-grey-90">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-grey-50">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}
