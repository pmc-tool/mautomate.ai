"use client";

import { useState } from "react";
import PageShell, { PageHero } from "@/components/PageShell";
import { CONTACT_EMAIL } from "@/lib/site";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", brand: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) {
      setError("Tell us a little about your brand.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.brand ? `Contact — ${form.brand}` : "Contact form",
          message: form.message,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Something went wrong. Email us directly and we'll reply fast.");
    }
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title="Tell us about your brand"
        subtitle="Three questions, two minutes — a founder reads every note and replies within a working day."
      />

      <section className="shell pb-20 lg:pb-28">
        <div className="mx-auto max-w-xl">
          {status === "done" ? (
            <div className="card-base text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-bold text-ink">Thanks — we've got it.</h2>
              <p className="mt-2 text-muted">
                A founder will read your note and reply within a working day.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="card-base space-y-5">
              <Field label="Your name">
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Jane Founder"
                  className="input"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@brand.com"
                  className="input"
                />
              </Field>
              <Field label="What are you building?">
                <input
                  type="text"
                  value={form.brand}
                  onChange={set("brand")}
                  placeholder="e.g. a skincare brand"
                  className="input"
                />
              </Field>
              <Field label="Tell us more" required>
                <textarea
                  value={form.message}
                  onChange={set("message")}
                  rows={5}
                  required
                  placeholder="What do you sell, and who's it for?"
                  className="input resize-y"
                />
              </Field>

              {error ? <p className="text-sm text-brand-dark">{error}</p> : null}

              <button type="submit" disabled={status === "sending"} className="btn-primary w-full">
                {status === "sending" ? "Sending…" : "Send message"}
              </button>

              <p className="text-center text-sm text-muted">
                Prefer email?{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand hover:text-brand-dark">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </form>
          )}
        </div>
      </section>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid #ececec;
          background: #fff;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          color: #141414;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .input::placeholder {
          color: #8a8a8a;
        }
        .input:focus {
          outline: none;
          border-color: rgba(241, 90, 41, 0.5);
          box-shadow: 0 0 0 3px rgba(241, 90, 41, 0.12);
        }
      `}</style>
    </PageShell>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
