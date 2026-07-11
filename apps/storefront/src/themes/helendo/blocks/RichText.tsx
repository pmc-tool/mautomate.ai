"use client"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the rich_text CMS block.                        */
/*                                                                      */
/* Consumes the SAME resolved block data the Cignet renderer does       */
/* (spread as props via `<RichText {...block} />`), so it also carries  */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. The backend registry defines `html` (sanitized HTML   */
/* body) + `width` only — that path renders the authored HTML inside a  */
/* centered bootstrap column (Helendo's base typography styles it).     */
/*                                                                      */
/* FAQ accordion variant (mirrors Cignet): when the (open) prop bag     */
/* additionally carries an `items` array of question/answer pairs we    */
/* render an accordion. Helendo ships NO accordion CSS, so the          */
/* expand/collapse look is built with inline styles in the template's   */
/* design language (1px #ededed borders, Roboto, gold #dcb14a active    */
/* accent) — no bridge-sheet dependency. Expand/collapse is React       */
/* state. The whole file is a client component because both variants    */
/* share it; the plain-HTML path uses no interactivity and still        */
/* server-renders. All HTML goes through the shared sanitizer before    */
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

/** Sanitize an answer; wrap plain text in a <p> so paragraph styles apply. */
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
    const accordion = (
      <div className="helendo-accordion">
        {faqItems.map((item, i) => {
          const expanded = open === i
          return (
            <div
              key={i}
              style={{
                border: "1px solid #ededed",
                marginBottom: i === faqItems.length - 1 ? 0 : "10px",
              }}
            >
              <h6 style={{ margin: 0 }}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "18px 20px",
                    background: "transparent",
                    border: "none",
                    borderLeft: expanded
                      ? "2px solid #dcb14a"
                      : "2px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: '"Roboto", sans-serif',
                    fontSize: "16px",
                    fontWeight: 500,
                    color: expanded ? "#dcb14a" : "#000000",
                    transition: "color 0.3s ease, border-color 0.3s ease",
                  }}
                >
                  <span>{item.question}</span>
                  <span aria-hidden="true" style={{ marginLeft: "15px" }}>
                    {expanded ? "−" : "+"}
                  </span>
                </button>
              </h6>
              {expanded ? (
                <div
                  style={{
                    padding: "0 20px 20px",
                    color: "#666666",
                  }}
                  dangerouslySetInnerHTML={{ __html: answerHtml(item.answer) }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    )

    return (
      <div
        className="helendo-rich-text section-space--ptb_90"
        style={{ paddingLeft: 0, paddingRight: 0 }}
      >
        <div className="container">
          <div className="row">
            {raw.trim() ? (
              <>
                <div className="col-lg-5">
                  <div
                    className="section-title mb-30"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
                  />
                </div>
                <div className="col-lg-7">{accordion}</div>
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
    <div className="helendo-rich-text section-space--ptb_90">
      <div className={container}>
        <div className="row justify-content-center">
          <div className={col}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RichText
