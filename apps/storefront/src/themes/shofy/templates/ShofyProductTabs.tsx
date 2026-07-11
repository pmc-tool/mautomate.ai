"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Shofy product detail TAB SECTION (product-details.html:              */
/* tp-product-details-bottom "Description" / "Additional information"   */
/* nav-tabs). The template's Bootstrap tab JS is reimplemented here     */
/* with React state; the tab classes (nav nav-tabs tp-product-tab /     */
/* tab-pane fade show active) are kept so the template CSS styles them. */
/* Content is populated from the product's description and its          */
/* structured attributes (type, material, weight, dimensions, origin)   */
/* — the same fields the shared product-tabs component reads. Renders   */
/* null when there is nothing to show.                                  */
/* ------------------------------------------------------------------ */

type ShofyProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ShofyProductTabs = ({ product }: ShofyProductTabsProps) => {
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
    <div className="tp-product-details-bottom pb-140">
      <div className="container">
        <div className="row">
          <div className="col-xl-12">
            <div className="tp-product-details-tab-nav tp-tab">
              <nav>
                <div
                  className="nav nav-tabs justify-content-center p-relative tp-product-tab"
                  role="tablist"
                >
                  {tabs.map((tab, index) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      className={`nav-link${
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
                    <div className="tp-product-details-desc-wrapper pt-80">
                      <div className="row justify-content-center">
                        <div className="col-xl-10">
                          <div className="tp-product-details-desc-item">
                            <div className="row">
                              <div className="col-lg-12">
                                <div className="tp-product-details-desc-content pt-25">
                                  <h3 className="tp-product-details-desc-title">
                                    {product.title}
                                  </h3>
                                  <p>{product.description}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
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
                    <div className="tp-product-details-additional-info">
                      <div className="row justify-content-center">
                        <div className="col-xl-10">
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShofyProductTabs
