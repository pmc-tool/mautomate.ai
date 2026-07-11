"use client"

import { useState } from "react"

import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Rokon product detail TAB SECTION (product-details.html:              */
/* "Description" / "Additional Info" product__details--tab). The        */
/* template's data-toggle tab JS is reimplemented with React state; the */
/* tab classes (product__details--tab__list active / tab_pane active    */
/* show) are kept so the template CSS styles them. Content is populated */
/* from the product's description and its structured attributes (type,  */
/* material, weight, dimensions, origin) — the same fields the shared   */
/* product-tabs component reads. Renders null when there is nothing to  */
/* show.                                                                */
/* ------------------------------------------------------------------ */

type RokonProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const RokonProductTabs = ({ product }: RokonProductTabsProps) => {
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

  const tabs: { id: "description" | "information"; label: string }[] = []
  if (product.description) {
    tabs.push({ id: "description", label: "Description" })
  }
  if (specs.length) {
    tabs.push({ id: "information", label: "Additional Info" })
  }

  if (!tabs.length) {
    return null
  }

  const active = tabs[Math.min(activeTab, tabs.length - 1)]

  return (
    <section className="product__details--tab__section section--padding pt-0">
      <div className="container">
        <div className="row row-cols-1">
          <div className="col">
            <ul className="product__tab--one product__details--tab d-flex mb-30">
              {tabs.map((tab, index) => (
                <li
                  key={tab.id}
                  role="tab"
                  aria-selected={active.id === tab.id}
                  className={`product__details--tab__list${
                    active.id === tab.id ? " active" : ""
                  }`}
                  onClick={() => setActiveTab(index)}
                >
                  {tab.label}
                </li>
              ))}
            </ul>
            <div className="product__details--tab__inner border-radius-10">
              <div className="tab_content">
                {/* Description tab */}
                {!!product.description && (
                  <div
                    id="description"
                    role="tabpanel"
                    className={`tab_pane${
                      active.id === "description" ? " active show" : ""
                    }`}
                  >
                    <div className="product__tab--content">
                      <div className="product__tab--content__step mb-30">
                        <h2 className="product__tab--content__title h4 mb-10">
                          Product Description
                        </h2>
                        <p className="product__tab--content__desc">
                          {product.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Info tab */}
                {specs.length > 0 && (
                  <div
                    id="information"
                    role="tabpanel"
                    className={`tab_pane${
                      active.id === "information" ? " active show" : ""
                    }`}
                  >
                    <div className="product__tab--content">
                      <div className="product__tab--content__step mb-30">
                        <ul className="additional__info_list">
                          {specs.map((row) => (
                            <li
                              key={row.label}
                              className="additional__info_list--item"
                            >
                              <span className="info__list--item-head">
                                <strong>{row.label}</strong>
                              </span>
                              <span className="info__list--item-content">
                                {row.value}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RokonProductTabs
