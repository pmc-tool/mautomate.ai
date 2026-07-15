"use client"

/* Catalog (products + categories) for the visual editor's picker controls. */

import React, { createContext, useContext, useEffect, useState } from "react"

type Opt = { id: string; label: string; thumbnail?: string | null }
type Catalog = { products: Opt[]; categories: Opt[] }

const CatalogCtx = createContext<Catalog>({ products: [], categories: [] })

export const useCatalog = () => useContext(CatalogCtx)

export function CatalogProvider({
  editorKey,
  children,
}: {
  editorKey: string
  children: React.ReactNode
}) {
  const [catalog, setCatalog] = useState<Catalog>({ products: [], categories: [] })
  useEffect(() => {
    fetch(`/api/puck/catalog?key=${encodeURIComponent(editorKey)}`)
      .then((r) => (r.ok ? r.json() : { products: [], categories: [] }))
      .then((d: any) =>
        setCatalog({ products: d?.products ?? [], categories: d?.categories ?? [] })
      )
      .catch(() => {})
  }, [editorKey])
  return <CatalogCtx.Provider value={catalog}>{children}</CatalogCtx.Provider>
}
