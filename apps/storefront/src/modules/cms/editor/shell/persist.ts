/* ------------------------------------------------------------------ */
/* Shell persistence (ARCH-CANVAS P8, seat 6C — composition root).      */
/*                                                                      */
/* The editor shell's server round-trips, extracted VERBATIM from the   */
/* shell monolith: the puck-document wire shape (serializeDoc — the     */
/* same map the autosave effect, Preview-draft flush and Publish each   */
/* carried as an inline copy), the draft autosave POST, the per-region  */
/* chrome save and the page publish. Orchestration — status copy,       */
/* dirty flags, timers — STAYS in the shell; this module only owns the  */
/* wire. No behavior change: same endpoints, same bodies, same          */
/* error-swallowing shape as the inline originals.                      */
/* ------------------------------------------------------------------ */

type Section = { block_type: string; [k: string]: unknown }

/** The /api/puck wire shape for a page document. One definition for the
 *  three writers (autosave / draft flush / publish) that each used to
 *  build it inline, identically. */
export function serializeDoc(content: Section[]): {
  root: Record<string, never>
  content: { type: string; props: Record<string, unknown> }[]
} {
  return {
    root: {},
    content: content.map((sec, i) => {
      const { block_type, ...rest } = sec
      return {
        type: block_type,
        props: { id: `${block_type}-${i}`, ...rest },
      }
    }),
  }
}

/** POST the draft buffer. Returns r.ok; throws only what fetch throws
 *  (the callers' try/catch keeps its old meaning). */
export async function autosaveDraft(
  key: string,
  slug: string,
  locale: string,
  content: Section[]
): Promise<boolean> {
  const r = await fetch(`/api/puck/autosave?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, locale, data: serializeDoc(content) }),
  })
  return r.ok
}

/** Save ONE edited chrome region (publish step 1). Never throws — a
 *  network failure reads as a failed save, exactly as the inline
 *  try/catch treated it. */
export async function saveChromeRegion(
  key: string,
  region: string,
  data: unknown
): Promise<boolean> {
  try {
    const cr = await fetch(`/api/puck/chrome?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: region, data }),
    })
    return cr.ok
  } catch {
    return false
  }
}

/** Publish the page sections (publish step 2). Returns the response's
 *  ok + parsed body (body parse failures degrade to {} exactly as the
 *  inline `.catch(() => ({}))` did); fetch-level failures throw, and the
 *  caller's try/catch narrates them. */
export async function publishPage(
  key: string,
  slug: string,
  locale: string,
  content: Section[]
): Promise<{ ok: boolean; status: number; body: any }> {
  const r = await fetch(`/api/puck/publish?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, locale, data: serializeDoc(content) }),
  })
  const body = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, body }
}

/* ---------------- shell loads (6C continuation) ------------------------
   The shell's three boot-time GETs, moved verbatim from the monolith's
   inline effects: the page list for the switcher, the editable chrome
   payload, and the page document. Parse shape and error behavior are
   identical to the inline originals; state fan-out (setters, universal
   normalization, canvas push) STAYS in the shell. */

/** GET the page list for the switcher. Non-OK degrades to [] (the inline
 *  `{ pages: [] }` fallback); fetch/parse failures throw and the caller's
 *  `.catch(() => {})` keeps its old leave-state-alone meaning. */
export async function fetchPages(
  key: string
): Promise<{ slug: string; title: string }[]> {
  const r = await fetch(`/api/puck/pages?key=${encodeURIComponent(key)}`)
  const d: any = r.ok ? await r.json() : { pages: [] }
  return Array.isArray(d?.pages) ? d.pages : []
}

/** GET the raw editable-chrome payload. Non-OK degrades to {} (the
 *  inline shape); fetch/parse failures throw — the caller's `.catch`
 *  keeps its old meaning. The caller splits the payload into the
 *  chromeRef regions itself (state fan-out is orchestration). */
export async function fetchChrome(key: string, locale: string): Promise<any> {
  const r = await fetch(
    `/api/puck/chrome?lang=${locale}&key=${encodeURIComponent(key)}`
  )
  return r.ok ? await r.json() : {}
}

/** GET the page document. Mirrors the inline load exactly: 401 reads as
 *  denied (the caller shows its own screen — and, as before, also flags
 *  loadError), any other non-OK or an unparsable body reads as a load
 *  error (so Publish can never overwrite real content after a network
 *  failure), otherwise the raw puck content items. */
export async function loadPageDocument(
  key: string,
  slug: string,
  locale: string
): Promise<
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "ok"; items: { type: string; props?: Record<string, unknown> }[] }
> {
  const r = await fetch(
    `/api/puck/load?slug=${slug}&lang=${locale}&key=${encodeURIComponent(key)}`
  )
  if (r.status === 401) return { kind: "denied" }
  if (!r.ok) return { kind: "error" }
  const d = await r.json().catch(() => null)
  if (d === null) return { kind: "error" }
  return {
    kind: "ok",
    items: (d?.data?.content ?? []) as {
      type: string
      props?: Record<string, unknown>
    }[],
  }
}

/* ---------------- canvas link resolution -------------------------------
   The pure slug math of handleLinkClick: which CMS page (if any) a
   clicked canvas href points at. The selection/navigation side-effects
   stay in the shell. Moved verbatim — same country-code heuristics,
   same known-page resolution. */

export function resolveCmsLink(
  href: string,
  knownSlugs: readonly string[]
): { slug: string; isCmsPage: boolean } | null {
  let path = String(href || "").split("?")[0].split("#")[0]
  if (!path) return null
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname
  } catch {
    // keep raw path
  }
  // Resolve the slug against the known page list so a 3-letter page slug
  // (e.g. "faq") is never mistaken for a country-code prefix.
  const known = new Set(["home", ...knownSlugs])
  const segs = path.split("/").filter((s) => s && s !== "undefined")
  const withoutCc =
    segs.length > 1 && /^[a-z]{2,3}$/.test(segs[0])
      ? segs.slice(1).join("/")
      : null
  const full = segs.join("/")
  let slug: string
  if (!segs.length) slug = "home"
  else if (known.has(full)) slug = full
  else if (withoutCc && known.has(withoutCc)) slug = withoutCc
  else if (segs.length === 1 && /^[a-z]{2,3}$/.test(segs[0])) slug = "home"
  else slug = withoutCc ?? full
  return { slug, isCmsPage: slug === "home" || known.has(slug) }
}
