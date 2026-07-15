/* ------------------------------------------------------------------ */
/* Rokon renderer for the testimonials CMS block: the template's        */
/* "testimonial__section" (index-2.html). The template's Swiper         */
/* carousel is reimplemented as a simple responsive grid of             */
/* `.testimonial__card` articles (no Swiper JS), which keeps this a     */
/* server component. Consumes the SAME resolved block-data prop bag as  */
/* the Cignet/Learts versions (`<Testimonials {...block} />`), so it    */
/* also carries block_type / schema_version / countryCode /             */
/* sectionScope which we simply ignore.                                 */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item; avatars default to the      */
/* template's /rokon/img/other/testimonialN.webp portraits cycling by   */
/* index.                                                               */
/* ------------------------------------------------------------------ */

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
  [key: string]: unknown
}

export interface TestimonialsData {
  title?: string
  items?: TestimonialItem[]
  [key: string]: unknown
}

/** Default portraits shipped with the template (cycled by index). */
function fallbackAvatar(index: number): string {
  return `/rokon/img/other/testimonial${(index % 3) + 1}.webp`
}

/* The template's quote-mark icon (index-2.html testimonial__icon). */
const QuoteIcon = () => (
  <div className="testimonial__icon">
    <svg
      className="testimonial__icon--svg"
      xmlns="http://www.w3.org/2000/svg"
      width="18.479"
      height="13.939"
      viewBox="0 0 21.479 18.939"
    >
      <path
        data-name="Path 131"
        d="M8.629,11.089A1.033,1.033,0,0,0,9.149,9.7L8.3,7.918a1.036,1.036,0,0,0-1.352-.5A11.937,11.937,0,0,0,3.206,9.841,9.053,9.053,0,0,0,.693,13.809,21.762,21.762,0,0,0,0,19.908v5.319a1.043,1.043,0,0,0,1.04,1.04h6.81a1.043,1.043,0,0,0,1.04-1.04v-6.81a1.043,1.043,0,0,0-1.04-1.04H4.592A7.306,7.306,0,0,1,5.8,13.168,6.586,6.586,0,0,1,8.629,11.089Z"
        transform="translate(0 -7.328)"
        fill="currentColor"
      ></path>
      <path
        data-name="Path 132"
        d="M79.312,11.172a1.033,1.033,0,0,0,.52-1.386l-.849-1.767a1.036,1.036,0,0,0-1.352-.5,12.552,12.552,0,0,0-3.725,2.408,9.248,9.248,0,0,0-2.53,3.985,21.47,21.47,0,0,0-.676,6.082v5.319a1.043,1.043,0,0,0,1.04,1.04h6.81a1.043,1.043,0,0,0,1.04-1.04V18.5a1.043,1.043,0,0,0-1.04-1.04H75.274a7.307,7.307,0,0,1,1.213-4.211A6.585,6.585,0,0,1,79.312,11.172Z"
        transform="translate(-58.45 -7.411)"
        fill="currentColor"
      ></path>
    </svg>
  </div>
)

const Testimonials = (props: TestimonialsData) => {
  const items = Array.isArray(props.items) ? props.items : []

  if (!items.length) {
    return null
  }

  return (
    <section className="testimonial__section section--padding">
      <div className="container">
        {props.title ? (
          <div className="section__heading text-center mb-50">
            <h2 className="section__heading--maintitle text__secondary mb-10">
              {props.title}
            </h2>
          </div>
        ) : null}
        <div className="testimonial__inner">
          <div
            className="row row-cols-lg-3 row-cols-md-2 row-cols-1"
            style={{ rowGap: "30px" }}
          >
            {items.map((item, i) => (
              <div
                data-el="item"
                data-el-item={`items:${i}`}
                className="col"
                key={i}
              >
                <article className="testimonial__card text-center">
                  <div className="testimonial__card--thumbnail">
                    <img
                      className="testimonial__card--thumbnail__img display-block"
                      src={item.avatar || fallbackAvatar(i)}
                      alt={item.author}
                    />
                  </div>
                  <div className="testimonial__content">
                    {item.quote ? (
                      <p data-el="quote" className="testimonial__content--desc">
                        {item.quote}
                      </p>
                    ) : null}
                    <h3 data-el="author" className="testimonial__content--title">
                      {item.author}
                    </h3>
                    {item.role ? (
                      <h4 className="testimonial__content--subtitle text__secondary">
                        {item.role}
                      </h4>
                    ) : null}
                  </div>
                  <QuoteIcon />
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Testimonials
