"use client"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the rich_text CMS block.                           */
/*                                                                      */
/* Consumes the SAME resolved block data the Learts/Cignet renderers do */
/* (spread as props via `<RichText {...block} />`), so it also carries  */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. The backend registry defines `html` (sanitized HTML   */
/* body) + `width` only — that path renders the authored HTML inside    */
/* the template's `.simple-article.size-3` content styling (Questrial   */
/* body, Raleway 900 uppercase headings).                               */
/*                                                                      */
/* FAQ accordion variant: when the (open) prop bag additionally carries */
/* an `items` array of question/answer pairs we render an accordion —   */
/* Exzo ships no accordion markup of its own, so it is composed from    */
/* the template's building blocks (.simple-input pill borders, Raleway  */
/* 700 uppercase headers, FA4 fa-angle chevrons, .simple-article        */
/* bodies) with expand/collapse in React state (no template JS).        */
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

/** Sanitize an answer; wrap plain text in a <p> so paragraph styles apply. */
function answerHtml(answer: string): string {
  const safe = sanitizeHtml(answer)
  return /<[a-z][\s\S]*>/i.test(safe) ? safe : `<p>${safe}</p>`
}

/** Map the locale-invariant width onto Bootstrap 3 container + columns. */
function layoutFor(width: RichTextWidth | undefined): {
  container: string
  col: string
  flush: boolean
} {
  switch (width) {
    case "narrow":
      return {
        container: "container",
        col: "col-md-6 col-md-offset-3 col-sm-8 col-sm-offset-2",
        flush: false,
      }
    case "wide":
      return { container: "container-fluid", col: "col-xs-12", flush: false }
    case "full":
      return { container: "container-fluid", col: "col-xs-12", flush: true }
    case "normal":
    default:
      return {
        container: "container",
        col: "col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1",
        flush: false,
      }
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
      <div className="exzo-accordion">
        {faqItems.map((item, i) => {
          const expanded = open === i
          const headingId = `${baseId}-heading-${i}`
          const panelId = `${baseId}-panel-${i}`
          return (
            <div
              className="exzo-accordion-item"
              key={i}
              style={{
                border: expanded ? "1px solid #b8cd06" : "1px solid #eee",
                borderRadius: 26,
                marginBottom: 10,
                background: "#fff",
                overflow: "hidden",
                transition: "border-color .15s",
              }}
            >
              <h3 style={{ margin: 0 }} id={headingId}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(expanded ? null : i)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "16px 30px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Raleway', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    lineHeight: "18px",
                    textTransform: "uppercase",
                    color: expanded ? "#b8cd06" : "#343434",
                  }}
                >
                  {item.question}
                  <i
                    className={`fa ${
                      expanded ? "fa-angle-up" : "fa-angle-down"
                    }`}
                    aria-hidden="true"
                    style={{ float: "right", fontSize: 16, lineHeight: "18px" }}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={headingId}
                style={{ display: expanded ? "block" : "none" }}
              >
                <div
                  className="simple-article size-2"
                  style={{ padding: "0 30px 20px" }}
                  dangerouslySetInnerHTML={{ __html: answerHtml(item.answer) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )

    return (
      <div className="exzo-rich-text exzo-faqs">
        <div className="container">
          <div className="row">
            {raw.trim() ? (
              <>
                <div className="col-md-5 col-xs-b30 col-md-b0">
                  <div
                    className="simple-article size-3"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
                  />
                </div>
                <div className="col-md-7">{accordion}</div>
              </>
            ) : (
              <div className="col-md-8 col-md-offset-2">{accordion}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ------------------------ Plain rich-text variant -------------------- */
  const { container, col, flush } = layoutFor(props.width)

  return (
    <div className="exzo-rich-text">
      <div
        className={container}
        style={flush ? { paddingLeft: 0, paddingRight: 0 } : undefined}
      >
        <div className="row">
          <div className={col}>
            <div
              className="simple-article size-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RichText
