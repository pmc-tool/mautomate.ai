"use client"

import { Adjustments, ChevronDownMini } from "@medusajs/icons"
import { useState } from "react"

import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

/* ------------------------------------------------------------------ */
/* Store filter panel with a mobile collapse.                          */
/*                                                                     */
/* The Medusa `small` breakpoint is 1024px, so below it the plain       */
/* RefinementList sidebar stacks full-width ABOVE the product grid —    */
/* on a phone that means a whole screen of Sort/Color/Size before the   */
/* first product. Here we keep the desktop sidebar untouched (`small:`  */
/* and up it is always visible) but on mobile hide it behind a          */
/* "Filter & Sort" toggle so products are visible immediately.          */
/* ------------------------------------------------------------------ */

type StoreFiltersProps = {
  sortBy: SortOptions
  search?: boolean
  hideOptionsPicker?: boolean
  "data-testid"?: string
}

const StoreFilters = (props: StoreFiltersProps) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile-only toggle (hidden from the `small` breakpoint up). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="store-filter-panel"
        className="small:hidden flex items-center justify-between w-full mb-6 px-5 py-3 border border-ui-border-base rounded-md bg-ui-bg-subtle text-ui-fg-base txt-compact-small-plus"
      >
        <span className="flex items-center gap-x-2">
          <Adjustments />
          Filter &amp; Sort
        </span>
        <ChevronDownMini
          className={`transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Filters: collapsible on mobile, always-on sidebar from `small` up. */}
      <div
        id="store-filter-panel"
        className={`${open ? "block" : "hidden"} small:block`}
      >
        <RefinementList {...props} />
      </div>
    </>
  )
}

export default StoreFilters
