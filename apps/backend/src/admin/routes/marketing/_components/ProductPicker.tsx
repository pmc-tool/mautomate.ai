/**
 * Marketing — attach-product picker.
 *
 * A Drawer with a debounced product search (via useProducts) and multi-select.
 * Compose opens it to set `product_ids`; the selected products are surfaced as
 * removable chips back in the composer.
 */
import { CheckCircleSolid, MagnifyingGlass, Photo } from "@medusajs/icons"
import { Button, Drawer, Input, Text, clx } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useProducts } from "./useProducts"
import type { PickerProduct } from "./lib"

export function ProductPicker({
  open,
  initialSelected,
  onClose,
  onConfirm,
}: {
  open: boolean
  initialSelected: PickerProduct[]
  onClose: () => void
  onConfirm: (products: PickerProduct[]) => void
}) {
  const { query, setQuery, products, loading, error } = useProducts()
  const [selected, setSelected] = useState<Record<string, PickerProduct>>({})

  useEffect(() => {
    if (open) {
      const map: Record<string, PickerProduct> = {}
      initialSelected.forEach((p) => (map[p.id] = p))
      setSelected(map)
    }
  }, [open, initialSelected])

  const toggle = (p: PickerProduct) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[p.id]) delete next[p.id]
      else next[p.id] = p
      return next
    })
  }

  const selectedList = Object.values(selected)

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-xl">
        <Drawer.Header>
          <Drawer.Title>Attach products</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ui-fg-muted">
              <MagnifyingGlass />
            </span>
            <Input
              autoFocus
              value={query}
              placeholder="Search products…"
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error ? (
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
          ) : loading && products.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              Searching…
            </Text>
          ) : products.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              No products found.
            </Text>
          ) : (
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {products.map((p) => {
                const isSelected = !!selected[p.id]
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p)}
                    className={clx(
                      "flex items-center gap-x-3 px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-ui-bg-highlight"
                        : "bg-ui-bg-base hover:bg-ui-bg-base-hover"
                    )}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle text-ui-fg-muted">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Photo />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Text size="small" weight="plus" className="truncate">
                        {p.title}
                      </Text>
                      <Text
                        size="xsmall"
                        className="truncate font-mono text-ui-fg-muted"
                      >
                        {p.id}
                      </Text>
                    </div>
                    {isSelected && (
                      <span className="text-ui-fg-interactive">
                        <CheckCircleSolid />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex flex-1 items-center">
            <Text size="small" className="text-ui-fg-subtle">
              {selectedList.length} selected
            </Text>
          </div>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={() => onConfirm(selectedList)}>
            Attach
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

export default ProductPicker
