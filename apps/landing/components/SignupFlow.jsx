"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ArrowRight } from "./icons";
import { PLANS, BILLING, priceFor, TRIAL_DAYS } from "@/lib/plans";
import { SIGNUP_PATH, SIGNUP_STATUS_PATH, STORE_DOMAIN, slugify } from "@/lib/site";

// Restores the old landing's working signup, rebuilt in the new design.
// Flow: collect store name / email / password for the chosen plan, then
//   POST {SIGNUP_API}/platform/signup { name, slug, email, password, package }
//   -> 202, then poll /platform/signup/status?slug= until status === "live",
//   then send the merchant to their new store admin.
// No payment is collected here (the old form didn't either) — every plan starts
// with a {TRIAL_DAYS}-day free trial; billing is handled in the store later.

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 60; // ~3 minutes

function emailValid(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export default function SignupFlow() {
  const [planKey, setPlanKey] = useState("starter");
  const [billing, setBilling] = useState("monthly");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState("form"); // form | provisioning | success | failed
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { slug, admin_url, store_url }

  const pollRef = useRef({ tries: 0, timer: null });

  // Read ?plan / ?billing from the URL on mount (set by the pricing CTAs).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("plan");
    const b = q.get("billing");
    if (p && PLANS.some((x) => x.id === p)) setPlanKey(p);
    if (b && BILLING.some((x) => x.id === b)) setBilling(b);
  }, []);

  // Keep slug in sync with the store name until the user edits it themselves.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Clean up any pending poll timer on unmount.
  useEffect(() => () => clearTimeout(pollRef.current.timer), []);

  const plan = PLANS.find((p) => p.id === planKey) || PLANS[0];
  const price = priceFor(plan, billing);

  function validate() {
    if (!name.trim()) return "Enter your store name.";
    if (!slug || slug.length < 3) return "Choose a store address of at least 3 characters.";
    if (!emailValid(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Use a password of at least 8 characters.";
    return null;
  }

  function pollStatus(finalSlug) {
    const p = pollRef.current;
    p.tries += 1;
    fetch(`${SIGNUP_STATUS_PATH}?slug=${encodeURIComponent(finalSlug)}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.status === "live") {
            setResult((r) => ({
              ...r,
              admin_url: data.admin_url ?? r?.admin_url,
              store_url: data.store_url ?? r?.store_url,
            }));
            setStep("success");
            return;
          }
          if (data.status === "failed") {
            setError("Something went wrong while building your store. Please try again.");
            setStep("failed");
            return;
          }
        }
        if (p.tries >= POLL_MAX_TRIES) {
          setError(
            "This is taking longer than expected — your store may still be finishing. Try opening your admin in a few minutes, or start over."
          );
          setStep("failed");
          return;
        }
        p.timer = setTimeout(() => pollStatus(finalSlug), POLL_INTERVAL_MS);
      })
      .catch(() => {
        if (p.tries >= POLL_MAX_TRIES) {
          setError("We lost connection while building your store. Please try again.");
          setStep("failed");
          return;
        }
        p.timer = setTimeout(() => pollStatus(finalSlug), POLL_INTERVAL_MS);
      });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const finalSlug = slugify(slug);
    setSubmitting(true);
    try {
      const res = await fetch(SIGNUP_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: finalSlug,
          email: email.trim(),
          password,
          package: plan.id,
        }),
      });

      // The backend creates the store and responds 2xx. It may return the store
      // already "live" (synchronous, current behavior) with an auto-login
      // admin_url, or "provisioning" (async) — in which case we poll for "live".
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const rslug = data.slug ?? finalSlug;

        // Paid plan: the account starts on a free trial and we take the card
        // FIRST via the Paddle 7-day-trial checkout ($0 today, plan begins after
        // 7 days). Go straight there — never drop the visitor into the dashboard
        // before the card step.
        if (data.requires_card && (data.checkout_url || data.admin_url)) {
          setStep("redirecting");
          window.location.href = data.checkout_url || data.admin_url;
          return;
        }

        setResult({
          slug: rslug,
          admin_url: data.admin_url,
          store_url: data.store_url ?? `https://${rslug}.${STORE_DOMAIN}`,
        });
        if (data.status !== "provisioning" && data.admin_url) {
          setStep("success");
          return;
        }
        setStep("provisioning");
        pollRef.current = { tries: 0, timer: null };
        pollRef.current.timer = setTimeout(() => pollStatus(rslug), POLL_INTERVAL_MS);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(
          data.message || "That store address is already taken. Try a different one."
        );
      } else if (res.status === 400) {
        setError(data.message || "Please check your details and try again.");
      } else {
        setError(data.message || "We couldn't create your store just now. Please try again.");
      }
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Redirecting to the card-first trial checkout ----
  if (step === "redirecting") {
    return (
      <StatusCard>
        <Spinner />
        <h2 className="mt-6 text-h3 font-bold text-ink">
          Taking you to secure checkout…
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Add your card to start your {TRIAL_DAYS}-day free trial. You won&apos;t
          be charged today — your plan begins automatically after {TRIAL_DAYS}{" "}
          days, and you can cancel any time before then.
        </p>
      </StatusCard>
    );
  }

  // ---- Provisioning / success / failed screens ----
  if (step === "provisioning") {
    return (
      <StatusCard>
        <Spinner />
        <h2 className="mt-6 text-h3 font-bold text-ink">Building your store…</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We&apos;re setting up <b className="text-ink">{result?.store_url?.replace(/^https?:\/\//, "")}</b>,
          creating your storefront, and getting the AI ready. This usually takes
          under a minute — keep this tab open.
        </p>
      </StatusCard>
    );
  }

  if (step === "success") {
    return (
      <StatusCard>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-h3 font-bold text-ink">Your store is live.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {result?.store_url ? (
            <>
              It&apos;s ready at{" "}
              <a
                href={result.store_url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand hover:underline"
              >
                {result.store_url.replace(/^https?:\/\//, "")}
              </a>
              . Head to your dashboard to start building.
            </>
          ) : (
            "Head to your dashboard to start building."
          )}
        </p>
        {result?.admin_url ? (
          <a href={result.admin_url} className="btn-primary mt-8">
            Go to your dashboard
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : null}
      </StatusCard>
    );
  }

  if (step === "failed") {
    return (
      <StatusCard>
        <h2 className="text-h3 font-bold text-ink">We hit a snag.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setError(null);
          }}
          className="btn-primary mt-8"
        >
          Try again
        </button>
      </StatusCard>
    );
  }

  // ---- Signup form ----
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* form */}
      <div className="card-base p-6 sm:p-8">
        <h2 className="text-h3 font-bold text-ink">Create your store</h2>
        <p className="mt-2 text-sm text-muted">
          Free for {TRIAL_DAYS} days. No card needed to start.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          <Field label="Store name" htmlFor="store-name">
            <input
              id="store-name"
              type="text"
              autoComplete="organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nova Athletics"
              className={inputCls}
            />
          </Field>

          <Field label="Store address" htmlFor="store-slug">
            <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand">
              <input
                id="store-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="nova-athletics"
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-ink outline-none"
              />
              <span className="flex items-center whitespace-nowrap border-l border-line bg-surface-alt px-3 text-sm text-muted">
                .{STORE_DOMAIN}
              </span>
            </div>
          </Field>

          <Field label="Email" htmlFor="store-email">
            <input
              id="store-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brand.com"
              className={inputCls}
            />
          </Field>

          <Field label="Password" htmlFor="store-password">
            <input
              id="store-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputCls}
            />
          </Field>

          {error ? (
            <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating your store…" : `Start ${TRIAL_DAYS}-day free trial`}
          </button>

          <p className="text-center text-xs leading-relaxed text-muted">
            No charge today. When your {TRIAL_DAYS}-day trial ends your plan
            begins — cancel any time before then and you won&apos;t be billed. By
            continuing you agree to our{" "}
            <a href="/terms" className="font-medium text-ink hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="font-medium text-ink hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </div>

      {/* chosen-plan summary */}
      <aside className="lg:pt-2">
        <div className="rounded-3xl border border-line bg-brand-soft p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Your plan</span>
            <a href="/get-started" className="text-xs font-semibold text-brand hover:underline">
              Change
            </a>
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <h3 className="text-2xl font-bold text-ink">{plan.name}</h3>
          </div>
          <p className="mt-1 text-sm text-muted">{plan.audience}</p>

          <div className="mt-5 flex items-end gap-1 border-t border-brand/20 pt-5">
            <span className="text-4xl font-bold text-ink">${price}</span>
            <span className="mb-1 text-sm text-muted">/mo after trial</span>
          </div>
          <p className="mt-1 text-sm font-medium text-accent-green">
            Free for the first {TRIAL_DAYS} days
          </p>
          <p className="mt-1 text-sm font-semibold text-brand">{plan.credits}</p>

          <ul className="mt-6 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-white text-brand">
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
                <span className="text-xs leading-relaxed text-ink/80">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand";

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusCard({ children }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="card-base flex flex-col items-center p-8 text-center sm:p-12">
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="h-12 w-12 animate-spin rounded-full border-4 border-brand/20 border-t-brand"
      aria-label="Loading"
    />
  );
}
