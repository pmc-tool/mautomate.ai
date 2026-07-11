"use client"

import { useState } from "react"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const ContactForm = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setStatus("sending")
    try {
      const res = await fetch(`${BACKEND_URL}/store/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
        }),
      })
      if (!res.ok) throw new Error("Request failed")
      form.reset()
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className="contact-form">
      <form id="contact-form" onSubmit={handleSubmit}>
        <div className="row learts-mb-n30">
          <div className="col-md-6 col-12 learts-mb-30">
            <input type="text" placeholder="Your Name *" name="name" required />
          </div>
          <div className="col-md-6 col-12 learts-mb-30">
            <input type="email" placeholder="Email *" name="email" required />
          </div>
          <div className="col-12 learts-mb-30">
            <textarea name="message" placeholder="Message" rows={6} required />
          </div>
          <div className="col-12 text-center learts-mb-30">
            <button
              type="submit"
              className="btn btn-dark btn-outline-hover-dark"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Submit"}
            </button>
          </div>
        </div>
      </form>
      {status === "sent" && (
        <p
          className="form-messege"
          style={{ color: "#72a499", textAlign: "center" }}
        >
          Thanks for reaching out! We&rsquo;ll get back to you shortly.
        </p>
      )}
      {status === "error" && (
        <p
          className="form-messege"
          style={{ color: "#c0392b", textAlign: "center" }}
        >
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  )
}

export default ContactForm
