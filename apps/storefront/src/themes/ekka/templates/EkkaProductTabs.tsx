"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Ekka product detail TAB SECTION (product-left-sidebar.html: the      */
/* "Detail" / "More Information" nav-tabs). The template's Bootstrap    */
/* tab JS is reimplemented here with React state; the tab classes       */
/* (nav-tabs / tab-pane fade show active) are kept so the template CSS  */
/* styles them. Content is populated from the product's description     */
/* and its structured attributes (type, material, weight, dimensions,   */
/* origin) — the same fields the shared product-tabs component reads.   */
/* Renders null when there is nothing to show.                          */
/* ------------------------------------------------------------------ */

type EkkaProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const EkkaProductTabs = ({ product }: EkkaProductTabsProps) => {
  const [activeTab, setActiveTab] = useState(0)

  const specs = [
    { label: "Product Type", value: product.type?.value },
    { label: "Material", value: product.material },
    { label: "Weight", value: product.weight ? `${product.weight} g` : null },
    {
      label: "Dimensions",
      value:
        product.length && product.width && product.height
          ? `${product.length}L x ${product.width}W x ${product.height}H`
          : null,
    },
    { label: "Country of Origin", value: product.origin_country },
  ].filter((row) => !!row.value)

  const tabs: { id: "details" | "info"; label: string }[] = []
  if (product.description) {
    tabs.push({ id: "details", label: "Detail" })
  }
  if (specs.length) {
    tabs.push({ id: "info", label: "More Information" })
  }

  if (!tabs.length) {
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <div className="ec-single-pro-tab">
      <div className="ec-single-pro-tab-wrapper">
        <div className="ec-single-pro-tab-nav">
          <ul className="nav nav-tabs" role="tablist">
            {tabs.map((tab, index) => (
              <li className="nav-item" role="presentation" key={tab.id}>
                <button
                  type="button"
                  role="tab"
                  className={`nav-link${active.id === tab.id ? " active" : ""}`}
                  aria-selected={active.id === tab.id}
                  onClick={() => setActiveTab(index)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="tab-content ec-single-pro-tab-content">
          {/* Tab pane: Detail */}
          {!!product.description && (
            <div
              className={`tab-pane fade${
                active.id === "details" ? " show active" : ""
              }`}
              role="tabpanel"
            >
              <div className="ec-single-pro-tab-desc">
                <p>{product.description}</p>
              </div>
            </div>
          )}

          {/* Tab pane: More Information */}
          {specs.length > 0 && (
            <div
              className={`tab-pane fade${
                active.id === "info" ? " show active" : ""
              }`}
              role="tabpanel"
            >
              <div className="ec-single-pro-tab-moreinfo">
                <ul>
                  {specs.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span> {row.value}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EkkaProductTabs
