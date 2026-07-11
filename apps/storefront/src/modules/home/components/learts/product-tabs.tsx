"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import LeartsProductCard from "./product-card"

type Props = {
  newArrivals: HttpTypes.StoreProduct[]
  saleItems: HttpTypes.StoreProduct[]
  bestSellers: HttpTypes.StoreProduct[]
}

const TABS = [
  { key: "new", label: "New arrivals" },
  { key: "sale", label: "Sale items" },
  { key: "best", label: "Best sellers" },
] as const

const Grid = ({ products }: { products: HttpTypes.StoreProduct[] }) => (
  <div className="products row row-cols-xl-5 row-cols-lg-4 row-cols-md-3 row-cols-sm-2 row-cols-1">
    {products.map((p) => (
      <LeartsProductCard key={p.id} product={p} />
    ))}
  </div>
)

const ProductTabs = ({ newArrivals, saleItems, bestSellers }: Props) => {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>("new")

  const map = {
    new: newArrivals,
    sale: saleItems.length ? saleItems : newArrivals,
    best: bestSellers,
  }

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <ul className="product-tab-list nav">
              {TABS.map((t) => (
                <li key={t.key}>
                  <a
                    data-el="tab"
                    className={active === t.key ? "active" : ""}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setActive(t.key)
                    }}
                  >
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="prodyct-tab-content1 tab-content">
              <div className="tab-pane active">
                <Grid products={map[active]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
