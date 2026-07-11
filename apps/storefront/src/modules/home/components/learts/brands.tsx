const BRANDS = [7, 8, 1, 2, 3, 4, 5, 6]

const Brands = () => (
  <div className="section section-fluid section-padding bg-white border-top-dashed border-bottom-dashed learts-theme">
    <div className="container">
      <div className="section-title text-center">
        <h2 className="title title-icon-both">Shop by brands</h2>
      </div>
      <div
        className="brand-carousel row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 align-items-center justify-content-center"
        style={{ gap: "20px 0" }}
      >
        {BRANDS.map((n) => (
          <div className="col" key={n}>
            <div className="brand-item text-center">
              <a href="#">
                <img
                  src={`/learts/assets/images/brands/brand-${n}.webp`}
                  alt="Brand"
                />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default Brands
