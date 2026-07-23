import { Metadata } from "next"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that govern your use of this store.",
}

const sections: { title: string; body: string }[] = [
  {
    title: "Your account",
    body: "You are responsible for keeping your account credentials confidential and for all activity under your account. Provide accurate, current information when you register and keep it up to date.",
  },
  {
    title: "Orders and payment",
    body: "All orders are subject to acceptance and availability. Prices, promotions and product availability may change at any time before an order is accepted. If we cannot fulfill your order, we will notify you and refund any amount already paid.",
  },
  {
    title: "Shipping and returns",
    body: "Delivery estimates are provided in good faith but are not guaranteed. If something arrives damaged or is not what you ordered, contact us and we will make it right in line with our returns process.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to misuse this store: no attempts to interfere with its operation, access other customers' data, or use its content for unlawful purposes.",
  },
  {
    title: "Intellectual property",
    body: "All content on this store — product images, text, logos and design — belongs to the store or its licensors and may not be reproduced without permission.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these terms from time to time. The version published on this page applies to every order at the time it is placed. Continued use of the store after changes means you accept the updated terms.",
  },
]

export default function TermsOfUsePage() {
  return (
    <div className="learts-theme">
      <div className="page-title-section section">
        <div className="container">
          <div className="row">
            <div className="col">
              <div className="page-title">
                <h1 className="title">Terms of Use</h1>
                <ul className="breadcrumb">
                  <li className="breadcrumb-item">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb-item active">Terms of Use</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-8 col-12 mx-auto">
              <p style={{ color: "#777", marginBottom: 32 }}>
                By using this store and placing orders you agree to the terms
                below. Please read them before you shop.
              </p>
              {sections.map((section) => (
                <div key={section.title} style={{ marginBottom: 28 }}>
                  <h3 className="title" style={{ fontSize: 20, marginBottom: 10 }}>
                    {section.title}
                  </h3>
                  <p style={{ color: "#555", lineHeight: 1.8 }}>{section.body}</p>
                </div>
              ))}
              <p style={{ color: "#777", marginTop: 36 }}>
                Questions?{" "}
                <LocalizedClientLink href="/contact" className="underline">
                  Contact us
                </LocalizedClientLink>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
