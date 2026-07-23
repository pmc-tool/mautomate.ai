import { Metadata } from "next"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How this store collects, uses and protects your information.",
}

const sections: { title: string; body: string }[] = [
  {
    title: "Information we collect",
    body: "When you create an account, place an order or contact us, we collect the information you provide: your name, email address, phone number, shipping and billing addresses, and details of the products you purchase. Payment card details are processed by our payment providers and are never stored on our servers.",
  },
  {
    title: "How we use your information",
    body: "We use your information to process and deliver your orders, manage your account, respond to your questions, and — where you have agreed — send you updates about products and offers. We do not sell your personal information to third parties.",
  },
  {
    title: "Sharing",
    body: "We share information only with service providers who need it to operate this store: payment processors, shipping carriers and the platform that hosts this store. Each is bound to use your information solely to provide their service.",
  },
  {
    title: "Cookies",
    body: "This store uses cookies that are necessary for the shopping experience to work — keeping you signed in and remembering your cart. You can control cookies in your browser settings; disabling them may prevent parts of the store from working.",
  },
  {
    title: "Data retention and your rights",
    body: "We keep your information for as long as your account is active or as needed to comply with legal obligations. You may request access to, correction of, or deletion of your personal information at any time by contacting us.",
  },
  {
    title: "Contact",
    body: "If you have any questions about this policy or how your information is handled, please reach out through our contact page.",
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="learts-theme">
      <div className="page-title-section section">
        <div className="container">
          <div className="row">
            <div className="col">
              <div className="page-title">
                <h1 className="title">Privacy Policy</h1>
                <ul className="breadcrumb">
                  <li className="breadcrumb-item">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb-item active">Privacy Policy</li>
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
                This policy explains what information this store collects when
                you shop with us, how it is used, and the choices you have.
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
