"use client"

import { useState } from "react"

/* ------------------------------------------------------------------ */
/* Rokon footer widget: one .footer__widget column with the template's  */
/* mobile accordion behavior (script.js toggled "active" on the widget  */
/* and slid the .footer__widget--inner open below 768px; the CSS hides  */
/* the inner + shows the arrow icon only at mobile widths). Rebuilt as  */
/* a client component so the server-rendered RokonFooter keeps the      */
/* interaction without any template JavaScript.                         */
/* ------------------------------------------------------------------ */

type Props = {
  title: string
  /** Extra classes for the h2 (the template hides the About Us title on
      mobile with "d-none d-md-block"). */
  titleClassName?: string
  children: React.ReactNode
}

const RokonFooterWidget = ({ title, titleClassName, children }: Props) => {
  const [active, setActive] = useState(false)

  return (
    <div className={`footer__widget${active ? " active" : ""}`}>
      <h2
        className={`footer__widget--title${
          titleClassName ? ` ${titleClassName}` : ""
        }`}
      >
        {title}{" "}
        <button
          className="footer__widget--button"
          aria-label="footer widget button"
          aria-expanded={active}
          type="button"
          onClick={() => setActive((x) => !x)}
        ></button>
        <svg
          className="footer__widget--title__arrowdown--icon"
          xmlns="http://www.w3.org/2000/svg"
          width="12.355"
          height="8.394"
          viewBox="0 0 10.355 6.394"
        >
          <path
            d="M15.138,8.59l-3.961,3.952L7.217,8.59,6,9.807l5.178,5.178,5.178-5.178Z"
            transform="translate(-6 -8.59)"
            fill="currentColor"
          ></path>
        </svg>
      </h2>
      <div
        className="footer__widget--inner"
        style={active ? { display: "block" } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

export default RokonFooterWidget
