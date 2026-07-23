"use client";

import { useState } from "react";
import { MailIcon } from "./icons";

// Newsletter signup — posts to /api/newsletter, the same endpoint the current
// landing uses (the landing server records the address). Progressive: if the
// request fails the user still sees a graceful message.
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setState("error");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
      if (res.ok) setEmail("");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="w-full text-sm text-white/70 lg:max-w-md">
        Thanks — you're on the list. Watch your inbox for what we ship next.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full items-center gap-4 lg:max-w-md"
      aria-label="Newsletter signup"
    >
      <div className="flex flex-1 items-center gap-2 border-b border-white/25 pb-2 transition-colors focus-within:border-brand">
        <MailIcon className="h-4 w-4 flex-none text-white/50" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />
      </div>
      <button
        type="submit"
        disabled={state === "sending"}
        className="flex-none rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-white/90 disabled:opacity-60"
      >
        {state === "sending" ? "…" : "Subscribe"}
      </button>
    </form>
  );
}
