import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Learts page-title banner (mirrors the contact page). Server component.
 * `title` is the current page heading; `crumbs` render the breadcrumb trail,
 * the last entry shown as the active (non-link) segment.
 */
export default function PageBanner({
  title,
  crumbs = [],
  backgroundImage = "/learts/assets/images/bg/page-title-1.webp",
}: {
  title: string
  crumbs?: { label: string; href?: string }[]
  backgroundImage?: string
}) {
  return (
    <div
      className="page-title-section section"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="container">
        <div className="row">
          <div className="col">
            <div className="page-title">
              <h1 className="title">{title}</h1>
              <ul className="breadcrumb">
                <li className="breadcrumb-item">
                  <LocalizedClientLink href="/">Home</LocalizedClientLink>
                </li>
                {crumbs.map((crumb, idx) => {
                  const isLast = idx === crumbs.length - 1
                  if (isLast || !crumb.href) {
                    return (
                      <li
                        key={`${crumb.label}-${idx}`}
                        className="breadcrumb-item active"
                      >
                        {crumb.label}
                      </li>
                    )
                  }
                  return (
                    <li
                      key={`${crumb.label}-${idx}`}
                      className="breadcrumb-item"
                    >
                      <LocalizedClientLink href={crumb.href}>
                        {crumb.label}
                      </LocalizedClientLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
