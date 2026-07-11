"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Helendo product detail TAB SECTION (product-details.html:            */
/* "Description" / "Additional information" / "Reviews"). The           */
/* template's Bootstrap tab JS is reimplemented with React state; the   */
/* tab classes (.product-details-tab nav / .product_details_tab_content */
/* .tab-pane) are kept so the template CSS styles them. Content is      */
/* populated from the product's description and its structured          */
/* attributes (type, material, weight, dimensions, origin) — the same   */
/* fields CignetProductTabs reads. Renders null when there is nothing   */
/* to show. The Reviews pane keeps the template's "Be the first to      */
/* review" heading only — there is no review backend, so the template's */
/* dead comment form is intentionally not rendered.                     */
/* ------------------------------------------------------------------ */

type HelendoProductTabsProps = {
  product: HttpTypes.StoreProduct
}

type TabId = "description" | "sheet" | "reviews"

const HelendoProductTabs = ({ product }: HelendoProductTabsProps) => {
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

  const tabs: { id: TabId; label: string }[] = []
  if (product.description) {
    tabs.push({ id: "description", label: "Description" })
  }
  if (specs.length) {
    tabs.push({ id: "sheet", label: "Additional information" })
  }
  tabs.push({ id: "reviews", label: "Reviews" })

  if (!product.description && !specs.length) {
    /* Only the empty reviews pane would remain — nothing worth a tab bar. */
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <div className="row">
      <div className="col-12">
        <div className="product-details-tab section-space--pt_90">
          <ul role="tablist" className="nav">
            {tabs.map((tab, index) => (
              <li
                className={active.id === tab.id ? "active" : ""}
                role="presentation"
                key={tab.id}
              >
                <a
                  href={`#${tab.id}`}
                  role="tab"
                  className={active.id === tab.id ? "active" : ""}
                  aria-selected={active.id === tab.id}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveTab(index)
                  }}
                >
                  {tab.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="col-12">
        <div className="product_details_tab_content tab-content mt-30">
          {/* Start Single Content: Description */}
          {!!product.description && (
            <div
              className={`product_tab_content tab-pane${
                active.id === "description" ? " active" : ""
              }`}
              id="description"
              role="tabpanel"
            >
              <div className="product_description_wrap">
                <div className="product-details-wrap">
                  <div className="row align-items-center">
                    <div className="col-lg-12">
                      <div className="details mt-30">
                        <h5 className="mb-10">Detail</h5>
                        <p>{product.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* End Single Content */}

          {/* Start Single Content: Additional information */}
          {specs.length > 0 && (
            <div
              className={`product_tab_content tab-pane${
                active.id === "sheet" ? " active" : ""
              }`}
              id="sheet"
              role="tabpanel"
            >
              <div className="pro_feature">
                <table className="shop_attributes">
                  <tbody>
                    {specs.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* End Single Content */}

          {/* Start Single Content: Reviews */}
          <div
            className={`product_tab_content tab-pane${
              active.id === "reviews" ? " active" : ""
            }`}
            id="reviews"
            role="tabpanel"
          >
            <div className="rating_wrap mb-30">
              <h4 className="rating-title-2">
                Be the first to review &ldquo;{product.title}&rdquo;
              </h4>
              <p>There are no reviews yet.</p>
            </div>
          </div>
          {/* End Single Content */}
        </div>
      </div>
    </div>
  )
}

export default HelendoProductTabs
