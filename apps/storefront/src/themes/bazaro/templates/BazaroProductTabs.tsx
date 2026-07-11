"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Bazaro product detail TAB SECTION (product-details-default.html:     */
/* "Description" / "Additional information" nav buttons). The           */
/* template's Bootstrap tab JS is reimplemented here with React state;  */
/* the tab classes (product-details-nav nav-links / tab-pane fade show  */
/* active) are kept so the template CSS styles them. Content is         */
/* populated from the product's description and its structured          */
/* attributes (type, material, weight, dimensions, origin) — the same   */
/* fields the shared product-tabs component reads. Renders null when    */
/* there is nothing to show.                                            */
/* ------------------------------------------------------------------ */

type BazaroProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const BazaroProductTabs = ({ product }: BazaroProductTabsProps) => {
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

  const tabs: { id: "description" | "additional"; label: string }[] = []
  if (product.description) {
    tabs.push({ id: "description", label: "Description" })
  }
  if (specs.length) {
    tabs.push({ id: "additional", label: "Additional information" })
  }

  if (!tabs.length) {
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <div className="product-details-tab pb-60">
      <div className="container">
        <div className="row">
          <div className="col-xl-12">
            <div className="product-details-tab-nav">
              <nav>
                <div
                  className="product-details-nav nav nav-tab justify-content-center p-relative"
                  role="tablist"
                >
                  {tabs.map((tab, index) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      className={`nav-links${
                        active.id === tab.id ? " active" : ""
                      }`}
                      aria-selected={active.id === tab.id}
                      onClick={() => setActiveTab(index)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="tab-content">
                {/* Description */}
                {!!product.description && (
                  <div
                    className={`tab-pane fade${
                      active.id === "description" ? " show active" : ""
                    }`}
                    role="tabpanel"
                  >
                    <div className="product-details-tab-item">
                      <div className="product-details-desc-wrap">
                        <h3 className="product-details-desc-title">
                          {product.title}
                        </h3>
                        <p className="mb-50">{product.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional information */}
                {specs.length > 0 && (
                  <div
                    className={`tab-pane fade${
                      active.id === "additional" ? " show active" : ""
                    }`}
                    role="tabpanel"
                  >
                    <div className="product-details-tab-item">
                      <div className="product-details-additional-info">
                        <div className="row">
                          <div className="col-xl-12">
                            <h4 className="product-details-additional-info-title">
                              Additional information
                            </h4>
                            <table>
                              <tbody>
                                {specs.map((row) => (
                                  <tr key={row.label}>
                                    <td>{row.label}</td>
                                    <td>{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BazaroProductTabs
