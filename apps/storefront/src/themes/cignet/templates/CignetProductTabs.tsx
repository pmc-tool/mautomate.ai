"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Cignet product detail TAB SECTION (product-single.html: "Product     */
/* Description" / "Additional Information" nav-tabs). The template's    */
/* Bootstrap tab JS is reimplemented here with React state; the tab     */
/* classes (nav-tabs / tab-pane fade show active) are kept so the       */
/* template CSS styles them. Content is populated from the product's   */
/* description and its structured attributes (type, material, weight,  */
/* dimensions, origin) — the same fields the shared product-tabs       */
/* component reads. Renders null when there is nothing to show.        */
/* ------------------------------------------------------------------ */

type CignetProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const CignetProductTabs = ({ product }: CignetProductTabsProps) => {
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
    tabs.push({ id: "description", label: "Product Description" })
  }
  if (specs.length) {
    tabs.push({ id: "additional", label: "Additional Information" })
  }

  if (!tabs.length) {
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <div className="product-single-review-box wow fadeInUp">
      {/* Product Single Box Start */}
      <div className="product-single-review-tab tab-content">
        {/* Product Step Nav Start */}
        <div className="product-step-nav">
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
        {/* Product Step Nav End */}

        {/* Product Tab Item Box: Description */}
        {!!product.description && (
          <div
            className={`product-tab-item-box tab-pane fade${
              active.id === "description" ? " show active" : ""
            }`}
            role="tabpanel"
          >
            <div className="product-tab-item-content">
              <p>{product.description}</p>
            </div>
          </div>
        )}

        {/* Product Tab Item Box: Additional Information */}
        {specs.length > 0 && (
          <div
            className={`product-tab-item-box tab-pane fade${
              active.id === "additional" ? " show active" : ""
            }`}
            role="tabpanel"
          >
            <div className="product-additional-content">
              <div className="product-additional-content-title">
                <h2>Additional Information</h2>
              </div>
              <div className="product-additional-info-table">
                <table>
                  <tbody>
                    {specs.map((row) => (
                      <tr key={row.label}>
                        <td>
                          <b>{row.label}</b>
                        </td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Product Single Box End */}
    </div>
  )
}

export default CignetProductTabs
