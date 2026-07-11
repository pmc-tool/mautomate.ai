"use client"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the rich_text CMS block.                          */
/*                                                                      */
/* Consumes the SAME resolved block data the Cignet/Learts renderers do */
/* (spread as props via `<RichText {...block} />`), so it also carries  */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. The backend registry defines `html` (sanitized HTML   */
/* body) + `width` only — that path renders the authored HTML inside a  */
/* plain container column.                                              */
/*                                                                      */
/* FAQ accordion variant: when the (open) prop bag additionally carries */
/* an `items` array of question/answer pairs we render the template's   */
/* faq.html "Accordion Css" markup (`.accordion__container` /           */
/* `.accordion__items`) instead. The template's jQuery slideToggle is   */
/* NOT loaded; expand/collapse is reimplemented with React state that   */
/* toggles the template's `.active` class (icon rotation) and the       */
/* body's display (the template CSS keeps `.accordion__items--body`     */
/* at display none). All HTML goes through the shared sanitizer before  */
/* dangerouslySetInnerHTML.                                             */
/* ------------------------------------------------------------------ */

import { useState } from "react"
import { sanitizeHtml } from "@lib/util/sanitize-html"

export type RichTextWidth = "narrow" | "normal" | "wide" | "full"

export interface RichTextFaqItem {
  question: string
  answer: string
}

export interface RichTextData {
  html?: string
  width?: RichTextWidth
  items?: unknown
  [key: string]: unknown
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
}

/** Accept common accordion item spellings: question/answer, title/content… */
function toFaqItems(raw: unknown): RichTextFaqItem[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const items: RichTextFaqItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    const rec = entry as Record<string, unknown>
    const question = firstString(
      rec.question,
      rec.title,
      rec.heading,
      rec.label
    )
    const answer = firstString(
      rec.answer,
      rec.content,
      rec.body,
      rec.text,
      rec.html
    )
    if (question && answer) {
      items.push({ question, answer })
    }
  }
  return items
}

/** Sanitize an answer; wrap plain text in a <p> so the body styles apply. */
function answerHtml(answer: string): string {
  const safe = sanitizeHtml(answer)
  return /<[a-z][\s\S]*>/i.test(safe)
    ? safe
    : `<p class="accordion__items--body__desc">${safe}</p>`
}

/** Map the locale-invariant width onto Bootstrap column classes. */
function layoutFor(width: RichTextWidth | undefined): {
  container: string
  col: string
} {
  switch (width) {
    case "narrow":
      return { container: "container", col: "col-xl-6 col-lg-8 mx-auto" }
    case "wide":
      return { container: "container-fluid", col: "col-12" }
    case "full":
      return { container: "container-fluid p-0", col: "col-12" }
    case "normal":
    default:
      return { container: "container", col: "col-xl-8 col-lg-10 mx-auto" }
  }
}

/* The template's accordion chevron (faq.html "Accordion Css"). */
const ChevronIcon = () => (
  <span className="accordion__items--button__icon">
    <svg
      className="accordion__items--button__icon--svg"
      xmlns="http://www.w3.org/2000/svg"
      width="25.355"
      height="20.394"
      viewBox="0 0 512 512"
    >
      <path
        d="M98 190.06l139.78 163.12a24 24 0 0036.44 0L414 190.06c13.34-15.57 2.28-39.62-18.22-39.62h-279.6c-20.5 0-31.56 24.05-18.18 39.62z"
        fill="currentColor"
      />
    </svg>
  </span>
)

const RichText = (props: RichTextData) => {
  const [open, setOpen] = useState<number | null>(0)

  const raw = typeof props.html === "string" ? props.html : ""
  const faqItems = toFaqItems(props.items)

  if (!raw.trim() && !faqItems.length) {
    return null
  }

  /* ----------------------- FAQ accordion variant ----------------------- */
  if (faqItems.length) {
    return (
      <section className="faq__section section--padding rokon-rich-text">
        <div className="container">
          <div className="faq__section--inner">
            {raw.trim() ? (
              <div
                className="section__heading text-center mb-50"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
              />
            ) : null}
            <div className="row">
              <div className="col-xl-8 col-lg-10 mx-auto">
                <div className="accordion__container">
                  {faqItems.map((item, i) => {
                    const expanded = open === i
                    return (
                      <div
                        className={
                          expanded
                            ? "accordion__items active"
                            : "accordion__items"
                        }
                        key={i}
                      >
                        <h2 className="accordion__items--title">
                          <button
                            type="button"
                            className="faq__accordion--btn accordion__items--button"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : i)}
                          >
                            {item.question}
                            <ChevronIcon />
                          </button>
                        </h2>
                        <div
                          className="accordion__items--body"
                          style={{
                            display: expanded ? "block" : "none",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: answerHtml(item.answer),
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ------------------------ Plain rich-text variant -------------------- */
  const { container, col } = layoutFor(props.width)

  return (
    <section className="rokon-rich-text section--padding">
      <div className={container}>
        <div className="row justify-content-center">
          <div className={col}>
            <div
              className="rokon-rich-text__body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default RichText
