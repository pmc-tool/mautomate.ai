"use client"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the rich_text CMS block.                           */
/*                                                                      */
/* Consumes the SAME resolved block data the Learts/Aurora/Cignet       */
/* renderers do (spread as props via `<RichText {...block} />`), so it  */
/* also carries block_type / schema_version / countryCode /             */
/* sectionScope which we simply ignore. The backend registry defines    */
/* `html` (sanitized HTML body) + `width` only — that path renders the  */
/* authored HTML inside the template's generic `.ec-page-content`       */
/* section shell.                                                       */
/*                                                                      */
/* FAQ accordion variant: when the (open) prop bag additionally carries */
/* an `items` array of question/answer pairs we render the template's   */
/* FAQ markup (elemets-accordions.html: .ec-faq-container-1 /           */
/* .ec-faq-block / .ec-faq-title / .ec-faq-content) instead — the       */
/* template's jQuery slideToggle is NOT loaded; expand/collapse is      */
/* reimplemented with React state driving the panel's display, the same */
/* single-open pattern as the Cignet RichText accordion. The whole file */
/* is a client component because both variants share it; the plain-HTML */
/* path uses no interactivity and still server-renders. All HTML goes   */
/* through the shared sanitizer before dangerouslySetInnerHTML.         */
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

/** Sanitize an answer; wrap plain text in a <p> so `.ec-faq-content p` styles apply. */
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
  const [open, setOpen] = useState<number | null>(0)

  const raw = typeof props.html === "string" ? props.html : ""
  const faqItems = toFaqItems(props.items)

  if (!raw.trim() && !faqItems.length) {
    return null
  }

  /* ----------------------- FAQ accordion variant ----------------------- */
  if (faqItems.length) {
    return (
      <section className="section ec-page-content section-space-p ekka-rich-text">
        <div className="container">
          <div className="row">
            {raw.trim() ? (
              <div className="col-md-12 text-center">
                {/* Section Title Start */}
                <div
                  className="section-title"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
                />
                {/* Section Title End */}
              </div>
            ) : null}

            <div className="ec-faq-container-1">
              <div className="ec-faq-wrapper">
                {faqItems.map((item, i) => {
                  const expanded = open === i
                  return (
                    <div className="col-sm-12 ec-faq-block" key={i}>
                      <h4
                        className="ec-faq-title"
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setOpen(expanded ? null : i)
                          }
                        }}
                      >
                        {item.question}
                      </h4>
                      <div
                        className="ec-faq-content"
                        role="region"
                        style={{ display: expanded ? "block" : "none" }}
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
      </section>
    )
  }

  /* ------------------------ Plain rich-text variant -------------------- */
  const { container, col } = layoutFor(props.width)

  return (
    <section className="section ec-page-content section-space-p ekka-rich-text">
      <div className={container}>
        <div className="row justify-content-center">
          <div className={col}>
            <div
              className="ekka-rich-text-entry"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default RichText
