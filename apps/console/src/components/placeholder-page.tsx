"use client"

import { PageHeader } from "./page-header"
import { EmptyState } from "./empty-state"

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Coming soon"
        description={`The ${title} page is being rebuilt with the new design. Check back shortly.`}
      />
    </div>
  )
}
