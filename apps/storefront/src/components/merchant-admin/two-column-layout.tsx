"use client"

import React from "react"
import { cn } from "@lib/util/cn"

export function TwoColumnLayout({
  children,
  sidebar,
  className,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-3",
        className
      )}
    >
      <div className="space-y-6 lg:col-span-2">{children}</div>
      <div className="space-y-6">{sidebar}</div>
    </div>
  )
}
