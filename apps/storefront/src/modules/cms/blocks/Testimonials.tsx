/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend testimonials resolved schema). */
/* Received as the spread prop bag from the storefront SectionRenderer  */
/* (`<Testimonials {...block} />`), so it also carries block_type /      */
/* schema_version which we simply ignore.                               */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is always */
/* an array (may be empty => the whole block renders null). `role` and   */
/* `avatar` are optional per item. All avatar fields hold fully-resolved */
/* media URLs (absolute backend urls or /learts paths both work in       */
/* <img>). Renders the Learts `.testimonial` markup.                     */
/* ------------------------------------------------------------------ */

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
}

export interface TestimonialsData {
  title?: string
  items?: TestimonialItem[]
  [key: string]: unknown
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <div data-el="item" className="testimonial">
      {item.quote ? <p data-el="quote">{item.quote}</p> : null}
      <div className="author">
        {item.avatar ? <img src={item.avatar} alt={item.author} /> : null}
        <div className="content">
          <span data-el="author" className="name">
            {item.author}
          </span>
          {item.role ? <span className="title">{item.role}</span> : null}
        </div>
      </div>
    </div>
  )
}

const Testimonials = (props: TestimonialsData) => {
  const items = Array.isArray(props.items) ? props.items : []

  if (!items.length) {
    return null
  }

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        {props.title ? (
          <div className="section-title text-center">
            <h2 className="title title-icon-both">{props.title}</h2>
          </div>
        ) : null}
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 justify-content-center">
          {items.map((item, i) => (
            <div className="col learts-mb-30" key={i} data-el-item={`items:${i}`}>
              <TestimonialCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Testimonials
