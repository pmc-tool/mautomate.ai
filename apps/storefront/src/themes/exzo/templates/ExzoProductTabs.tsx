"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Exzo product detail TAB SECTION (product.html: the .tabs-block with  */
/* the .tabulation-menu-wrapper toggle and .tab-entry panes). The       */
/* template's jQuery tab switching is reimplemented with React state;   */
/* the tabulation classes (tabulation-title / tabulation-toggle /       */
/* tab-menu active / tab-entry visible) are kept so Exzo's own CSS      */
/* styles them. Content is populated from the product's description and */
/* its structured attributes (type, material, weight, dimensions,       */
/* origin) — the same fields the shared product-tabs component reads.   */
/* Renders null when there is nothing to show. Inactive panes also get  */
/* display:none inline so no template JS is needed to hide them.        */
/* ------------------------------------------------------------------ */

type ExzoProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ExzoProductTabs = ({ product }: ExzoProductTabsProps) => {
  const [activeTab, setActiveTab] = useState(0)

  const specs = [
    { label: "product type", value: product.type?.value },
    { label: "material", value: product.material },
    { label: "weight", value: product.weight ? `${product.weight} g` : null },
    {
      label: "dimensions",
      value:
        product.length && product.width && product.height
          ? `${product.length}L x ${product.width}W x ${product.height}H`
          : null,
    },
    { label: "country of origin", value: product.origin_country },
  ].filter((row) => !!row.value)

  const tabs: { id: "description" | "specs"; label: string }[] = []
  if (product.description) {
    tabs.push({ id: "description", label: "description" })
  }
  if (specs.length) {
    tabs.push({ id: "specs", label: "technical specs" })
  }

  if (!tabs.length) {
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <div className="tabs-block">
      {/* Tabulation Menu Start */}
      <div className="tabulation-menu-wrapper text-center">
        <div className="tabulation-title simple-input">{active.label}</div>
        <ul className="tabulation-toggle">
          {tabs.map((tab, index) => (
            <li key={tab.id}>
              <a
                role="tab"
                aria-selected={active.id === tab.id}
                className={`tab-menu${active.id === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Tabulation Menu End */}

      <div className="empty-space col-xs-b30 col-sm-b60"></div>

      {/* Tab Entry: Description */}
      {!!product.description && (
        <div
          className={`tab-entry${
            active.id === "description" ? " visible" : ""
          }`}
          role="tabpanel"
          style={active.id === "description" ? undefined : { display: "none" }}
        >
          <div className="simple-article size-2">
            <p>{product.description}</p>
          </div>
        </div>
      )}

      {/* Tab Entry: Technical Specs */}
      {specs.length > 0 && (
        <div
          className={`tab-entry${active.id === "specs" ? " visible" : ""}`}
          role="tabpanel"
          style={active.id === "specs" ? undefined : { display: "none" }}
        >
          <div className="h5">{product.title}</div>
          <div className="empty-space col-xs-b15"></div>
          <div className="row">
            {specs.map((row) => (
              <div className="col-sm-6" key={row.label}>
                <div className="product-description-entry row nopadding">
                  <div className="col-xs-6">
                    <div className="h6">{row.label}:</div>
                  </div>
                  <div className="col-xs-6 text-right">
                    <div className="simple-article size-2">{row.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ExzoProductTabs
