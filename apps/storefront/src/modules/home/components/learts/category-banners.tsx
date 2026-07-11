import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getBrandName, brandHandle } from "@lib/brand"

const IMG = "/learts/assets/images/banner"

const CategoryBanners = async () => {
  const brand = await getBrandName()
  return (
  <div className="section section-fluid learts-pt-30 bg-white learts-theme">
    <div className="container">
      <div className="row learts-mb-n30">
        {/* Intro blockquote */}
        <div className="col-xxl-6 col-xl-8 col-12 learts-mb-30">
          <div className="learts-blockquote">
            <div className="inner">
              <h2 className="title">
                {brand} — handcrafted goods and thoughtful gifts, delivered.
              </h2>
              <div className="desc">
                <p>
                  Crafting beautiful stuff with our own hands and the help from
                  useful tools is a wonderful process, where you can enjoy
                  yourself while pulling out some ideas and busy perfecting your
                  work. We provide high-end unique vases, wall arts, home
                  accessories, and furniture pieces.
                </p>
              </div>
              <LocalizedClientLink href="/store" className="link">
                ABOUT US
              </LocalizedClientLink>
            </div>
          </div>
        </div>

        {/* Spring sale banner */}
        <div className="col-xxl-3 col-xl-4 col-md-6 col-12 learts-mb-30">
          <div className="sale-banner3-1">
            <div className="image">
              <img src={`${IMG}/sale/sale-banner3-1.webp`} alt="Spring sale" />
            </div>
            <div className="content">
              <span className="special-title">Spring sale</span>
              <h2 className="title">Sale up to 10% all</h2>
              <LocalizedClientLink href="/store" className="link">
                SHOP NOW
              </LocalizedClientLink>
            </div>
          </div>
        </div>

        {/* Home Decor */}
        <div className="col-xxl-3 col-xl-4 col-md-6 col-12 learts-mb-30">
          <div className="category-banner3">
            <LocalizedClientLink href="/store" className="inner">
              <div className="image">
                <img src={`${IMG}/category/banner-s2-7.webp`} alt="Home Decor" />
              </div>
              <div className="content">
                <h3 className="title">
                  Home Decor<span className="number">16 items</span>
                </h3>
              </div>
            </LocalizedClientLink>
          </div>
        </div>

        {/* Gift Ideas */}
        <div className="col-xxl-3 col-xl-4 col-md-6 col-12 learts-mb-30">
          <div className="category-banner3">
            <LocalizedClientLink href="/store" className="inner">
              <div className="image">
                <img src={`${IMG}/category/banner-s2-8.webp`} alt="Gift Ideas" />
              </div>
              <div className="content">
                <h3 className="title">
                  Gift Ideas<span className="number">16 items</span>
                </h3>
              </div>
            </LocalizedClientLink>
          </div>
        </div>

        {/* Instagram */}
        <div className="col-xxl-3 col-xl-4 col-md-6 col-12 order-xxl-6 learts-mb-30">
          <div className="instagram-banner1">
            <div className="inner">
              <div className="image">
                <img src={`${IMG}/instagram-1.webp`} alt="Instagram" />
              </div>
              <div className="content">
                <div className="icon">
                  <i className="fab fa-instagram" />
                </div>
                <span className="sub-title">Follow us on instagram</span>
                <h3 className="title">
                  <a href="#">{brandHandle(brand)}</a>
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Toys (wide) */}
        <div className="col-xxl-6 col-xl-8 col-12 learts-mb-30">
          <div className="category-banner3">
            <LocalizedClientLink href="/store" className="inner">
              <div className="image">
                <img src={`${IMG}/category/banner-s2-9.webp`} alt="Toys" />
              </div>
              <div className="content">
                <h3 className="title">
                  Toys<span className="number">6 items</span>
                </h3>
              </div>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}

export default CategoryBanners
