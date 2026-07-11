import React from "react"

type Item = { image?: string; caption?: string; href?: string }

/**
 * image_gallery — responsive image collage. Shared by every theme (rendered by
 * the block map), so a merchant gets the same gallery whatever theme they use.
 */
export default function ImageGallery(props: {
  heading?: string
  subheading?: string
  columns?: string | number
  gap?: string | number
  aspect?: string
  items?: Item[]
}) {
  const items = Array.isArray(props.items) ? props.items.filter((i) => i && i.image) : []
  const cols = Math.max(1, Math.min(6, Number(props.columns) || 3))
  const gap = Number(props.gap)
  const g = Number.isFinite(gap) ? gap : 12
  const ratio =
    props.aspect === "portrait"
      ? "3 / 4"
      : props.aspect === "landscape"
      ? "4 / 3"
      : props.aspect === "auto"
      ? undefined
      : "1 / 1"

  if (!items.length) return null

  return (
    <section style={{ padding: "48px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        {(props.heading || props.subheading) && (
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            {props.subheading ? (
              <div
                data-el="subheading"
                style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: "var(--ff-c-text, #666)", marginBottom: 6 }}
              >
                {props.subheading}
              </div>
            ) : null}
            {props.heading ? (
              <h2
                data-el="heading"
                style={{ fontSize: 30, margin: 0, color: "var(--ff-c-heading, #1f1f1f)", fontFamily: "var(--ff-font-heading, inherit)" }}
              >
                {props.heading}
              </h2>
            ) : null}
          </div>
        )}
        <div
          data-el="grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: g,
          }}
        >
          {items.map((it, i) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.image}
                alt={it.caption || ""}
                style={{
                  width: "100%",
                  height: ratio ? "100%" : "auto",
                  aspectRatio: ratio,
                  objectFit: ratio ? "cover" : undefined,
                  display: "block",
                  borderRadius: 4,
                }}
              />
            )
            return (
              <figure key={i} style={{ margin: 0 }}>
                {it.href ? (
                  <a href={it.href} style={{ display: "block" }}>
                    {img}
                  </a>
                ) : (
                  img
                )}
                {it.caption ? (
                  <figcaption style={{ fontSize: 12, color: "var(--ff-c-text, #666)", marginTop: 6, textAlign: "center" }}>
                    {it.caption}
                  </figcaption>
                ) : null}
              </figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}
