import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka PRESENTATIONAL view for the category_showcase block. Pure,       */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Ekka "Top Categories" markup: a left .ec-cat-tab-nav list */
/* whose active entry (CSS-only, hidden radios keyed by `sectionScope`)  */
/* reveals a large .cat-banner panel. Rendered BYTE-IDENTICALLY by both  */
/* the live async server block (CategoryShowcase.tsx) and the visual-    */
/* editor canvas (which fetches the same tiles from                      */
/* /api/puck/category-tiles).                                            */
/* ------------------------------------------------------------------ */

interface CategoryTile {
  label: string
  image: string
  href: string
  count?: number
}

export interface CategoryShowcaseViewProps {
  sub_title?: string
  title?: string
  tiles: CategoryTile[]
  /** Injected by the SectionRenderer ("sec-<idx>"); scopes the tab CSS. */
  sectionScope?: string
}

/* Template defaults — the index.html cat nav icons and banner photos. */
const FALLBACK_ICONS = [
  { icon: "/ekka/images/icons/cat_1.png", hover: "/ekka/images/icons/cat_1_1.png" },
  { icon: "/ekka/images/icons/cat_2.png", hover: "/ekka/images/icons/cat_2_1.png" },
  { icon: "/ekka/images/icons/cat_3.png", hover: "/ekka/images/icons/cat_3_1.png" },
  { icon: "/ekka/images/icons/cat_4.png", hover: "/ekka/images/icons/cat_4_1.png" },
]

const FALLBACK_BANNERS = [
  "/ekka/images/cat-banner/1.jpg",
  "/ekka/images/cat-banner/2.jpg",
  "/ekka/images/cat-banner/3.jpg",
  "/ekka/images/cat-banner/4.jpg",
]

/** CSS-only tab switching, scoped by the section's stable id. */
const catCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.ekka-cat-tabs .ekka-cat-radio{position:absolute;opacity:0;pointer-events:none}`,
    `.ekka-cat-tabs .cat-link{cursor:pointer;margin:0;width:100%}`,
    `.ekka-cat-tabs .tab-pane img{max-width:100%}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-cat-${i}:checked ~ .row .ekka-cat-pane-${i}{height:auto;visibility:visible;opacity:1}`,
      `#${scope}-cat-${i}:checked ~ .row .cat-link[for="${scope}-cat-${i}"]{background-color:#3474d4}`,
      `#${scope}-cat-${i}:checked ~ .row .cat-link[for="${scope}-cat-${i}"] .cat-icon-hover{display:block}`,
      `#${scope}-cat-${i}:checked ~ .row .cat-link[for="${scope}-cat-${i}"] .cat-icon{display:none}`,
      `#${scope}-cat-${i}:checked ~ .row .cat-link[for="${scope}-cat-${i}"] .cat-desc span{color:#ffffff}`,
      `#${scope}-cat-${i}:checked ~ .row .cat-link[for="${scope}-cat-${i}"] .cat-desc span + span{color:#ffffff}`
    )
  }
  return rules.join("\n")
}

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  // Stable per-section scope for the radio/label ids (sanitized for CSS ids).
  const scope = (
    typeof props.sectionScope === "string" && props.sectionScope
      ? props.sectionScope
      : "ekka-categories"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  return (
    <section className="section ec-category-section section-space-p">
      <div className="container">
        <div className="row">
          <div className="col-md-12 text-center">
            {/* Section Title Start */}
            <div className="section-title">
              {title ? <h2 className="ec-bg-title">{title}</h2> : null}
              {title ? <h2 className="ec-title">{title}</h2> : null}
              {sub_title ? <p className="sub-title">{sub_title}</p> : null}
            </div>
            {/* Section Title End */}
          </div>
        </div>

        <div className="ekka-cat-tabs">
          <style
            dangerouslySetInnerHTML={{ __html: catCss(scope, tiles.length) }}
          />

          {tiles.map((tile, i) => (
            <input
              key={`radio-${i}`}
              type="radio"
              id={`${scope}-cat-${i}`}
              name={`${scope}-cats`}
              className="ekka-cat-radio"
              defaultChecked={i === 0}
              aria-label={tile.label}
            />
          ))}

          <div className="row">
            {/* Category Nav Start */}
            <div className="col-lg-3">
              <ul className="ec-cat-tab-nav nav">
                {tiles.map((tile, i) => (
                  <li className="cat-item" key={`nav-${i}`}>
                    <label
                      className="cat-link"
                      htmlFor={`${scope}-cat-${i}`}
                    >
                      <div className="cat-icons">
                        <img
                          className="cat-icon"
                          src={FALLBACK_ICONS[i % FALLBACK_ICONS.length].icon}
                          alt="cat-icon"
                        />
                        <img
                          className="cat-icon-hover"
                          src={FALLBACK_ICONS[i % FALLBACK_ICONS.length].hover}
                          alt="cat-icon"
                        />
                      </div>
                      <div className="cat-desc">
                        <span>{tile.label}</span>
                        {typeof tile.count === "number" ? (
                          <span>{tile.count} Products</span>
                        ) : null}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            {/* Category Nav End */}

            {/* Category Tab Start */}
            <div className="col-lg-9">
              <div className="tab-content">
                {tiles.map((tile, i) => (
                  <div
                    className={`tab-pane ekka-cat-pane-${i}`}
                    key={`pane-${i}`}
                  >
                    <div className="row">
                      <img
                        src={
                          tile.image ||
                          FALLBACK_BANNERS[i % FALLBACK_BANNERS.length]
                        }
                        alt={tile.label}
                      />
                    </div>
                    <span className="panel-overlay">
                      <LocalizedClientLink
                        href={tile.href}
                        className="btn btn-primary"
                      >
                        View All
                      </LocalizedClientLink>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Category Tab End */}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CategoryShowcaseView
