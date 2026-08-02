"use client";

import { useState } from "react";
import { slugify, trialSignupUrl } from "@/lib/site";
import { SparkIcon, ArrowRight, CheckIcon } from "@/components/icons";

// Curated word banks. Combined with the user's keyword through a set of naming
// PATTERNS below, they produce brandable, varied results entirely in the
// browser — no backend, which suits the static export.
const PREFIXES = [
  "The", "Shop", "House of", "Studio", "Little", "Daily",
  "Nord", "Ever", "Wild", "Pure", "Urban", "Golden",
];
const SUFFIXES = [
  "Co", "Studio", "Lab", "House", "Collective", "Goods",
  "Supply", "Club", "Market", "Works", "Society", "& Co",
];
const SUFFIX_GLUED = ["ly", "ora", "ify", "ora", "era", "io", "able", "ista"];

// Title-case each word in a phrase, preserving short connector words lower.
function titleCase(str) {
  const small = new Set(["of", "and", "the", "for", "to", "&"]);
  return str
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// A single "glued" token from the keyword (first word, letters only) for
// portmanteau-style names like "Cocoaly".
function gluedRoot(keyword) {
  const first = keyword.trim().split(/\s+/)[0] || "";
  return first.replace(/[^a-zA-Z]/g, "");
}

function pick(arr, used) {
  // Prefer an unused item so a single generation batch stays varied.
  const fresh = arr.filter((x) => !used.has(x));
  const pool = fresh.length ? fresh : arr;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  used.add(choice);
  return choice;
}

function generateNames(rawKeyword) {
  const kw = titleCase(rawKeyword);
  const glued = gluedRoot(rawKeyword);
  const gluedCap = glued ? glued.charAt(0).toUpperCase() + glued.slice(1).toLowerCase() : "";

  const usedPrefix = new Set();
  const usedSuffix = new Set();
  const usedGlue = new Set();

  // Each entry is a function producing one name from the keyword.
  const patterns = [
    () => `${kw} ${pick(SUFFIXES, usedSuffix)}`,
    () => `${pick(PREFIXES, usedPrefix)} ${kw}`,
    () => `${pick(PREFIXES, usedPrefix)} ${kw} ${pick(SUFFIXES, usedSuffix)}`,
    () => (gluedCap ? `${gluedCap}${pick(SUFFIX_GLUED, usedGlue)}` : `${kw} ${pick(SUFFIXES, usedSuffix)}`),
    () => `${kw} & Co`,
    () => `The ${kw} Studio`,
    () => `Shop ${kw}`,
    () => `${kw} Collective`,
    () => `House of ${kw}`,
    () => `${kw} Supply Co`,
    () => (gluedCap ? `Hello ${kw}` : `Hello ${kw}`),
    () => `${kw} Made`,
  ];

  const seen = new Set();
  const out = [];
  let guard = 0;
  // Rotate through patterns until we have ~20 unique names (or give up).
  while (out.length < 20 && guard < 200) {
    guard += 1;
    const make = patterns[out.length % patterns.length];
    const name = make().replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (!seen.has(key) && slugify(name)) {
      seen.add(key);
      out.push(name);
    }
    // If a pattern keeps colliding (tiny keyword), fall back to numbered variants.
    if (guard > 60 && out.length < 20) {
      const filler = `${kw} ${pick(SUFFIXES, new Set())}`;
      const fk = `${filler}-${out.length}`.toLowerCase();
      if (!seen.has(fk)) {
        seen.add(fk);
        out.push(filler);
      }
    }
  }
  return out;
}

export default function StoreNameGenerator() {
  const [keyword, setKeyword] = useState("");
  const [names, setNames] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState("");

  const trimmed = keyword.trim();

  const generate = (e) => {
    e?.preventDefault();
    if (!trimmed) {
      setSubmitted(true);
      setNames([]);
      return;
    }
    setSubmitted(true);
    setNames(generateNames(trimmed));
    setCopied("");
  };

  const copy = async (name) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(name);
      setTimeout(() => setCopied((c) => (c === name ? "" : c)), 1600);
    } catch {
      // Clipboard blocked — silently ignore; the build-store link still works.
    }
  };

  const showHint = submitted && !trimmed;

  return (
    <section className="shell pb-4">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={generate} className="card-base">
          <label htmlFor="sng-keyword" className="mb-1.5 block text-sm font-semibold text-ink">
            Your niche or keyword
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="sng-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. coffee, candles, skincare, yoga"
              className="sng-input"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary shrink-0">
              <SparkIcon className="h-4 w-4" />
              {names.length ? "Regenerate" : "Generate names"}
            </button>
          </div>
          {showHint ? (
            <p className="mt-3 text-sm text-brand-dark">
              Type a word that describes what you sell, then generate.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              One or two words works best. Click any name to copy it.
            </p>
          )}
        </form>

        {names.length ? (
          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              {names.length} ideas for &ldquo;{trimmed}&rdquo;
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {names.map((name) => {
                const slug = slugify(name);
                return (
                  <li
                    key={name}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition-all duration-300 ease-smooth hover:border-brand/40 hover:shadow-card"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => copy(name)}
                        className="block truncate text-left text-base font-semibold text-ink hover:text-brand"
                        title="Click to copy"
                      >
                        {copied === name ? (
                          <span className="inline-flex items-center gap-1.5 text-accent-green">
                            <CheckIcon className="h-4 w-4" /> Copied
                          </span>
                        ) : (
                          name
                        )}
                      </button>
                      {slug ? (
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {slug}.mautomate.ai
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={trialSignupUrl()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                    >
                      Build this
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-center text-sm text-muted">
              Found one you like?{" "}
              <a
                href={trialSignupUrl()}
                className="font-semibold text-brand hover:text-brand-dark"
              >
                Claim it and let the AI build your store
              </a>{" "}
              — free for 14 days.
            </p>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .sng-input {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid #ececec;
          background: #fff;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          color: #141414;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .sng-input::placeholder {
          color: #8a8a8a;
        }
        .sng-input:focus {
          outline: none;
          border-color: rgba(241, 90, 41, 0.5);
          box-shadow: 0 0 0 3px rgba(241, 90, 41, 0.12);
        }
      `}</style>
    </section>
  );
}
