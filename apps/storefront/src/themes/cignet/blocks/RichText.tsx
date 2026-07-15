"use client"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the rich_text CMS block.                         */
/*                                                                      */
/* Consumes the SAME resolved block data the Learts/Aurora renderers do */
/* (spread as props via `<RichText {...block} />`), so it also carries  */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. The backend registry defines `html` (sanitized HTML   */
/* body) + `width` only — that path renders the authored HTML inside    */
/* the template's `.post-entry` content styling.                        */
/*                                                                      */
/* FAQ accordion variant: the Cignet home maps its "Our FAQ" section to */
/* this block, so when the (open) prop bag additionally carries an      */
/* `items` array of question/answer pairs we render the template's      */
/* `.our-faqs` + `.faq-accordion` markup instead — Bootstrap's collapse */
/* JS is NOT loaded; expand/collapse is reimplemented with React state  */
/* toggling the same `collapsed` / `show` classes the template uses.    */
/* The whole file is a client component because both variants share it; */
/* the plain-HTML path uses no interactivity and still server-renders.  */
/* All HTML goes through the shared sanitizer before                    */
/* dangerouslySetInnerHTML.                                             */
/* ------------------------------------------------------------------ */

import { useId, useState } from "react"
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

/** Sanitize an answer; wrap plain text in a <p> so `.accordion-body p` styles apply. */
function answerHtml(answer: string): string {
  const safe = sanitizeHtml(answer)
  return /<[a-z][\s\S]*>/i.test(safe) ? safe : `<p>${safe}</p>`
}

/** Map the locale-invariant width onto Bootstrap container + column classes. */
function layoutFor(width: RichTextWidth | undefined): {
  container: string
  col: string
} {
  switch (width) {
    case "narrow":
      return { container: "container", col: "col-xl-6 col-lg-8" }
    case "wide":
      return { container: "container-fluid", col: "col-12" }
    case "full":
      return { container: "container-fluid px-0", col: "col-12" }
    case "normal":
    default:
      return { container: "container", col: "col-xl-8 col-lg-10" }
  }
}

const RichText = (props: RichTextData) => {
  const baseId = useId()
  const [open, setOpen] = useState<number | null>(0)

  const raw = typeof props.html === "string" ? props.html : ""
  const faqItems = toFaqItems(props.items)

  if (!raw.trim() && !faqItems.length) {
    return null
  }

  /* ----------------------- FAQ accordion variant ----------------------- */
  if (faqItems.length) {
    const accordion = (
      <div className="faq-accordion">
        {faqItems.map((item, i) => {
          const expanded = open === i
          const headingId = `${baseId}-heading-${i}`
          const panelId = `${baseId}-panel-${i}`
          return (
            <div className="accordion-item wow fadeInUp" key={i}>
              <h2 className="accordion-header" id={headingId}>
                <button
                  type="button"
                  className={
                    expanded ? "accordion-button" : "accordion-button collapsed"
                  }
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(expanded ? null : i)}
                >
                  {item.question}
                </button>
              </h2>
              <div
                id={panelId}
                role="region"
                aria-labelledby={headingId}
                className={
                  expanded
                    ? "accordion-collapse collapse show"
                    : "accordion-collapse collapse"
                }
              >
                <div
                  className="accordion-body"
                  dangerouslySetInnerHTML={{ __html: answerHtml(item.answer) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )

    return (
      <div className="our-faqs cignet-rich-text">
        <div className="container">
          <div className="row">
            {raw.trim() ? (
              <>
                <div className="col-xl-5">
                  {/* FAQ Content Box Start */}
                  <div className="faqs-content-box">
                    <div
                      data-el="content"
                      className="section-title"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
                    />
                  </div>
                  {/* FAQ Content Box End */}
                </div>
                <div className="col-xl-7">{accordion}</div>
              </>
            ) : (
              <div className="col-xl-8 col-lg-10 mx-auto">{accordion}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ------------------------ Plain rich-text variant -------------------- */
  const { container, col } = layoutFor(props.width)

  return (
    <div className="cignet-rich-text" style={{ padding: "60px 0" }}>
      <div className={container}>
        <div className="row justify-content-center">
          <div className={col}>
            <div
              data-el="content"
              className="post-entry"
              style={{
                borderBottom: "none",
                paddingBottom: 0,
                marginBottom: 0,
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RichText
