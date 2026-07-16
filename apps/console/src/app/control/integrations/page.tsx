"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  Check,
  CreditCard,
  Envelope,
  ExclamationCircle,
  Server,
  Sparkles,
  Trash,
  Puzzle,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  clearIntegrationKey,
  listIntegrations,
  setIntegrationKey,
  testIntegration,
  type IntegrationProvider,
  type PlatformGuide,
} from "@/lib/api/integrations"
import { EmptyState } from "@/components/empty-state"
import { BRAND, brandForCategory } from "@/components/brand-icons"
import { cn } from "@/lib/utils"

/**
 * Integrations & Keys — the connections hub.
 *
 * Master–detail: a status rail on the left shows every platform and its
 * connection state at a glance; the right panel focuses on ONE platform at a
 * time — its credentials, the URLs to register, its full setup guide. The
 * dark header carries overall progress and the employee playbook.
 */

/* ---------- tiny inline glyphs ---------- */
const Glyph = {
  search: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  ext: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
  ),
  copy: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  bolt: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
  ),
  book: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
}

function SimpleIcon({ category, className }: { category: string; className?: string }) {
  const c = category.toLowerCase()
  const Cmp =
    c.includes("ai") ? Sparkles
      : c.includes("payment") ? CreditCard
        : c.includes("domain") || c.includes("email") ? Envelope
          : c.includes("telephony") ? Server
            : Puzzle
  return <Cmp className={className ?? "h-5 w-5"} />
}

/* ---------- status ---------- */
type Tone = "ok" | "warn" | "err" | "none"
const DOT: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  err: "bg-rose-500",
  none: "bg-grey-300",
}
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls: Record<Tone, string> = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
    err: "bg-rose-50 text-rose-800 ring-rose-200",
    none: "bg-grey-10 text-grey-60 ring-grey-20",
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", cls[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} />
      {children}
    </span>
  )
}

/* ---------- rail item model ---------- */
type RailItem = {
  key: string // category for grouped platforms, env for singles
  kind: "platform" | "single"
  name: string
  section: string
  providers: IntegrationProvider[]
  brandKey: ReturnType<typeof brandForCategory>
}

const SECTION_ORDER = ["Social", "Messaging", "Advertising", "AI", "Payments", "Domains & Email", "Telephony & SMS"]

export default function IntegrationsPage() {
  const { token } = useControlAuth()
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [guides, setGuides] = useState<PlatformGuide[]>([])
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [tests, setTests] = useState<Record<string, { ok: boolean; message?: string } | null>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [q, setQ] = useState("")
  // Chrome ignores autocomplete="off" and force-fills the console login email
  // into any text field it fancies. Browsers never autofill a READ-ONLY input,
  // so the filter stays readOnly until a human focuses it.
  const [filterUnlocked, setFilterUnlocked] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listIntegrations(token)
      setProviders(res.providers)
      setGuides(res.guides)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  /* ---------- build rail ---------- */
  const items = useMemo<RailItem[]>(() => {
    const byCat = new Map<string, IntegrationProvider[]>()
    for (const p of providers) {
      const arr = byCat.get(p.category) ?? []
      arr.push(p)
      byCat.set(p.category, arr)
    }
    const out: RailItem[] = []
    for (const [cat, arr] of Array.from(byCat.entries())) {
      if (cat.startsWith("Social") || cat.startsWith("Messaging") || cat.startsWith("Ads")) {
        out.push({
          key: cat,
          kind: "platform",
          name: cat.split("·").pop()?.trim() || cat,
          section: cat.startsWith("Social") ? "Social" : cat.startsWith("Messaging") ? "Messaging" : "Advertising",
          providers: arr,
          brandKey: brandForCategory(cat),
        })
      } else {
        for (const p of arr) {
          out.push({ key: p.key, kind: "single", name: p.name, section: cat, providers: [p], brandKey: null })
        }
      }
    }
    return out
  }, [providers])

  const filteredItems = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return items
    return items.filter((it) =>
      `${it.name} ${it.section} ${it.providers.map((p) => `${p.name} ${p.key}`).join(" ")}`.toLowerCase().includes(ql)
    )
  }, [items, q])

  const sections = useMemo(() => {
    const m = new Map<string, RailItem[]>()
    for (const it of filteredItems) {
      const arr = m.get(it.section) ?? []
      arr.push(it)
      m.set(it.section, arr)
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      const ia = SECTION_ORDER.indexOf(a), ib = SECTION_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [filteredItems])

  const itemTone = useCallback((it: RailItem): Tone => {
    const failing = it.providers.some((p) => { const t = tests[p.key]; return (t && !t.ok) || p.status === "error" })
    if (failing) return "err"
    const done = it.providers.filter((p) => p.configured).length
    if (done === 0) return "none"
    if (done < it.providers.length) return "warn"
    return "ok"
  }, [tests])

  // Default selection: first not-fully-configured item, else the first item.
  useEffect(() => {
    if (selected || items.length === 0) return
    const todo = items.find((it) => it.providers.some((p) => !p.configured))
    setSelected((todo ?? items[0]).key)
  }, [items, selected])

  const current = useMemo(
    () => items.find((it) => it.key === selected) ?? null,
    [items, selected]
  )

  const stats = useMemo(() => {
    const total = providers.length
    const configured = providers.filter((p) => p.configured).length
    const failing = providers.filter((p) => { const t = tests[p.key]; return (t && !t.ok) || p.status === "error" }).length
    return { total, configured, failing, pct: total ? configured / total : 0 }
  }, [providers, tests])

  /* ---------- actions ---------- */
  const setVal = (env: string, v: string) => setInputs((p) => ({ ...p, [env]: v }))
  const handleSave = async (envs: string[]) => {
    if (!token) return
    setWorking(envs[0])
    try {
      let any = false
      for (const env of envs) {
        const v = (inputs[env] ?? "").trim()
        if (v) { await setIntegrationKey(token, env, v); setInputs((p) => ({ ...p, [env]: "" })); any = true }
      }
      if (!any) { setError("Enter a value before saving."); return }
      setError(null)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save") }
    finally { setWorking(null) }
  }
  const handleClear = async (env: string) => {
    if (!token) return
    setWorking(env)
    try { await clearIntegrationKey(token, env); await load() }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to clear") }
    finally { setWorking(null) }
  }
  const handleTest = async (env: string) => {
    if (!token) return
    setWorking(env)
    try { const r = await testIntegration(token, env); setTests((p) => ({ ...p, [env]: r })) }
    catch (e) { setTests((p) => ({ ...p, [env]: { ok: false, message: e instanceof Error ? e.message : "Test failed" } })) }
    finally { setWorking(null) }
  }
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
    setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
  }

  /* =============================== render =============================== */
  return (
    <div className="space-y-5">
      {/* ---- dark hero: progress ring + search + playbook ---- */}
      <div className="overflow-hidden rounded-2xl bg-grey-90 text-white shadow-borders-base">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <ProgressRing pct={stats.pct} label={`${stats.configured}/${stats.total}`} />
            <div>
              <h1 className="text-base font-semibold tracking-tight">Integrations &amp; Keys</h1>
              <p className="mt-0.5 text-xs text-white/60">
                {stats.configured} of {stats.total} connected
                {stats.failing > 0 && <span className="text-rose-300"> · {stats.failing} failing</span>}
                {" · "}keys are stored encrypted and apply within a minute
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            {guides.some((g) => g.key === "playbook") && (
              <button
                onClick={() => setOpenGuide("playbook")}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-grey-90 transition-transform hover:-translate-y-px"
              >
                {Glyph.book("h-4 w-4")} API playbook
              </button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/80 ring-1 ring-inset ring-white/10 hover:bg-white/15 disabled:opacity-50"
              aria-label="Refresh"
            >
              <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="h-[480px] animate-pulse rounded-2xl border border-grey-20 bg-grey-10" />
          <div className="h-[480px] animate-pulse rounded-2xl border border-grey-20 bg-grey-10" />
        </div>
      ) : providers.length === 0 ? (
        <EmptyState title="No integrations" description="Provider integrations appear here once registered on the platform." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          {/* ---------------- rail ---------------- */}
          <nav className="rounded-2xl border border-grey-20 bg-white p-2 shadow-borders-base lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {/* rail filter — typed only; the attribute set below keeps browser
                autofill from dumping saved credentials into it */}
            <div className="mb-1 flex items-center gap-2 rounded-xl bg-grey-10 px-3 py-2 text-grey-40 focus-within:bg-grey-5 focus-within:ring-1 focus-within:ring-grey-30">
              {Glyph.search("h-3.5 w-3.5 shrink-0")}
              <input
                type="search"
                name="integrations-rail-filter"
                value={q}
                onChange={(e) => { if (filterUnlocked) setQ(e.target.value) }}
                readOnly={!filterUnlocked}
                onFocus={() => setFilterUnlocked(true)}
                onTouchStart={() => setFilterUnlocked(true)}
                placeholder="Filter…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Filter platforms and keys"
                className="w-full border-0 bg-transparent text-[13px] text-grey-90 outline-none placeholder:text-grey-40 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {q && (
                <button onClick={() => setQ("")} className="shrink-0 text-[11px] text-grey-40 hover:text-grey-90" aria-label="Clear filter">
                  clear
                </button>
              )}
            </div>
            {sections.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-grey-40">Nothing matches “{q}”.</p>
            )}
            {sections.map(([section, arr]) => (
              <div key={section} className="mb-1.5">
                <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-grey-40">
                  {section}
                </div>
                {arr.map((it) => {
                  const tone = itemTone(it)
                  const brand = it.brandKey ? BRAND[it.brandKey] : null
                  const active = selected === it.key
                  const done = it.providers.filter((p) => p.configured).length
                  return (
                    <button
                      key={it.key}
                      onClick={() => setSelected(it.key)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors",
                        active ? "bg-grey-90 text-white" : "text-grey-70 hover:bg-grey-10"
                      )}
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        style={
                          active
                            ? { background: "rgba(255,255,255,.12)", color: "#fff" }
                            : { background: `${brand?.color ?? "#71717a"}1a`, color: brand?.color ?? "#71717a" }
                        }
                      >
                        {brand
                          ? <brand.Icon className="h-4 w-4" />
                          : <SimpleIcon category={it.section} className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{it.name}</span>
                      {it.providers.length > 1 && (
                        <span className={cn("font-mono text-[10px] tabular-nums", active ? "text-white/60" : "text-grey-40")}>
                          {done}/{it.providers.length}
                        </span>
                      )}
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} />
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* ---------------- detail ---------------- */}
          {current ? (
            <DetailPanel
              key={current.key}
              item={current}
              tone={itemTone(current)}
              guide={guides.find((g) => g.key === current.key) ?? null}
              inputs={inputs}
              setVal={setVal}
              working={working}
              tests={tests}
              copied={copied}
              onOpenGuide={() => setOpenGuide(current.key)}
              onSave={handleSave}
              onTest={handleTest}
              onClear={handleClear}
              onCopy={copy}
            />
          ) : (
            <div className="rounded-2xl border border-grey-20 bg-white p-10 text-center text-sm text-grey-40 shadow-borders-base">
              Pick a platform on the left.
            </div>
          )}
        </div>
      )}

      {openGuide && (
        <GuideView
          guide={guides.find((g) => g.key === openGuide) ?? null}
          onClose={() => setOpenGuide(null)}
          onCopy={copy}
          copied={copied}
        />
      )}
    </div>
  )
}

/* ---------- progress ring ---------- */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={pct >= 1 ? "#34d399" : "#fbbf24"}
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.02, pct))}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-semibold tabular-nums">{label}</span>
    </div>
  )
}

/* ============================== Detail panel ============================== */
function DetailPanel(props: {
  item: RailItem
  tone: Tone
  guide: PlatformGuide | null
  inputs: Record<string, string>
  setVal: (env: string, v: string) => void
  working: string | null
  tests: Record<string, { ok: boolean; message?: string } | null>
  copied: string | null
  onOpenGuide: () => void
  onSave: (envs: string[]) => void
  onTest: (env: string) => void
  onClear: (env: string) => void
  onCopy: (text: string, id: string) => void
}) {
  const { item, tone, guide, inputs, setVal, working, tests, copied, onOpenGuide, onSave, onTest, onClear, onCopy } = props
  const brand = item.brandKey ? BRAND[item.brandKey] : null
  const color = brand?.color ?? "#71717a"
  const envs = item.providers.map((p) => p.key)
  const busy = envs.includes(working ?? "")
  const configured = item.providers.filter((p) => p.configured).length
  const total = item.providers.length
  const docs = item.providers.find((p) => p.docs)?.docs
  const connectUrl = item.providers.find((p) => p.connect_url)?.connect_url
  const isWebhook = item.section === "Messaging" || item.providers.some((p) => p.key.includes("VERIFY"))
  const testable = item.providers.find((p) => p.testable)
  const failingTest = envs.map((e) => tests[e]).find((t) => t && !t.ok)
  const credentialFields = item.providers.filter((p) => !p.key.includes("VERIFY"))
  const verifyFields = item.providers.filter((p) => p.key.includes("VERIFY"))
  const anyDirty = envs.some((e) => (inputs[e] ?? "").trim())

  const statusText =
    tone === "err" ? "Action needed" : tone === "ok" ? "Connected" : tone === "warn" ? `Needs setup · ${configured}/${total}` : "Not started"

  return (
    <div className="overflow-hidden rounded-2xl border border-grey-20 bg-white shadow-borders-base">
      {/* brand header */}
      <div
        className="px-6 pb-5 pt-6"
        style={{ background: `linear-gradient(135deg, ${color}14, transparent 55%)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
              {brand ? <brand.Icon className="h-6 w-6" /> : <SimpleIcon category={item.section} className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-grey-90">{item.name}</h2>
              <p className="text-xs text-grey-50">
                {item.kind === "platform"
                  ? isWebhook ? "App secret + webhook connection" : "OAuth application"
                  : item.providers[0]?.help ?? item.section}
              </p>
            </div>
          </div>
          <Pill tone={tone}>{statusText}</Pill>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {guide && (
            <button
              onClick={onOpenGuide}
              className="inline-flex items-center gap-2 rounded-lg bg-grey-90 px-3.5 py-2 text-xs font-medium text-white hover:bg-grey-80"
            >
              {Glyph.book("h-3.5 w-3.5")} Full setup guide
            </button>
          )}
          {docs && (
            <a
              href={docs} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3.5 py-2 text-xs font-medium text-grey-70 hover:bg-grey-10"
            >
              {Glyph.ext("h-3.5 w-3.5")} Developer console
            </a>
          )}
          {testable && (
            <button
              onClick={() => onTest(testable.key)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3.5 py-2 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50"
            >
              {busy ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : Glyph.bolt("h-3.5 w-3.5")} Test connection
            </button>
          )}
        </div>
      </div>

      {failingTest && (
        <div className="mx-6 mb-1 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
          Test failed: {failingTest.message ?? "the platform rejected the credentials."}
        </div>
      )}

      {/* credentials */}
      <div className="border-t border-grey-20 px-6 py-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-grey-40">Credentials</h3>
        <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
          {credentialFields.map((p) => (
            <FieldRow key={p.key} p={p} value={inputs[p.key] ?? ""} onChange={(v) => setVal(p.key, v)} onClear={() => onClear(p.key)} working={working === p.key} />
          ))}
        </div>
      </div>

      {/* URLs + verify tokens */}
      {(connectUrl || verifyFields.length > 0) && (
        <div className="border-t border-grey-20 px-6 py-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-grey-40">
            {isWebhook ? "Webhook to register" : "Redirect URI to register"}
          </h3>
          {connectUrl && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-grey-20 bg-grey-10 px-3.5 py-2.5">
              <input readOnly value={connectUrl} className="w-full border-0 bg-transparent font-mono text-xs text-grey-60 outline-none" />
              <button
                onClick={() => onCopy(connectUrl, item.key)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] text-grey-60 hover:bg-grey-10"
              >
                {copied === item.key ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</> : <>{Glyph.copy("h-3.5 w-3.5")} Copy</>}
              </button>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-grey-40">
            Register this exact URL inside your {item.name} developer app{isWebhook ? ", together with the verify token below" : ""}.
          </p>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {verifyFields.map((p) => (
              <FieldRow key={p.key} p={p} value={inputs[p.key] ?? ""} onChange={(v) => setVal(p.key, v)} onClear={() => onClear(p.key)} working={working === p.key} chooseYourOwn />
            ))}
          </div>
        </div>
      )}

      {/* save bar */}
      <div className="flex items-center justify-between gap-3 border-t border-grey-20 bg-grey-10 px-6 py-3.5">
        <p className="text-[11px] text-grey-40">
          {configured === total
            ? "All keys saved — values are write-only; leave a field blank to keep the stored one."
            : `${total - configured} field${total - configured > 1 ? "s" : ""} still empty.`}
        </p>
        <button
          onClick={() => onSave(envs)}
          disabled={busy || !anyDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-grey-90 px-4 py-2 text-xs font-semibold text-white hover:bg-grey-80 disabled:opacity-40"
        >
          {busy ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save changes
        </button>
      </div>
    </div>
  )
}

/* ---------- one credential field ---------- */
function FieldRow({ p, value, onChange, onClear, working, chooseYourOwn }: {
  p: IntegrationProvider
  value: string
  onChange: (v: string) => void
  onClear: () => void
  working: boolean
  chooseYourOwn?: boolean
}) {
  const isSecret = p.secret !== false
  return (
    <div className="py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] font-medium text-grey-70">
          {p.name}
          {isSecret && <span className="ml-1 font-normal text-grey-40">secret</span>}
        </label>
        <span className="flex items-center gap-2">
          {p.configured && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              p.source === "env" ? "text-sky-700" : "text-emerald-700"
            )}>
              <Check className="h-3 w-3" /> {p.source === "env" ? "from env" : "saved"}
            </span>
          )}
          {p.configured && p.source !== "env" && (
            <button
              onClick={onClear}
              disabled={working}
              title="Remove this key"
              className="text-grey-30 hover:text-rose-500 disabled:opacity-50"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
      <input
        type={isSecret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={p.configured ? "•••••••• leave blank to keep" : chooseYourOwn ? "Invent a long random string…" : "Paste value…"}
        autoComplete="off"
        className={cn(
          "w-full rounded-lg border px-3 py-2 font-mono text-[13px] text-grey-90 outline-none transition-shadow placeholder:font-sans placeholder:text-grey-40",
          value ? "border-grey-90 ring-1 ring-grey-90" : "border-grey-20 focus:border-grey-40"
        )}
      />
      {p.help && !p.configured && (
        <p className="mt-1 text-[11px] leading-relaxed text-grey-40">{p.help}</p>
      )}
    </div>
  )
}
/* ============================ Full setup guide reader ============================ */
function GuideView({
  guide,
  onClose,
  onCopy,
  copied,
}: {
  guide: PlatformGuide | null
  onClose: () => void
  onCopy: (text: string, id: string) => void
  copied: string | null
}) {
  if (!guide) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-grey-90/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-grey-20 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-grey-90">{guide.title}</h2>
              <p className="mt-1 text-xs text-grey-50">
                <b className="text-grey-70">Done means:</b> {guide.outcome}
              </p>
              <p className="mt-1 text-xs text-grey-50">
                <b className="text-grey-70">Timeline:</b> {guide.timeline}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md border border-grey-20 px-2.5 py-1.5 text-xs font-medium text-grey-60 hover:bg-grey-10"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* prerequisites */}
          {guide.prerequisites.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-grey-50">
                Before you start
              </h3>
              <ul className="mt-2 space-y-1.5">
                {guide.prerequisites.map((p, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-grey-70">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-grey-40" />
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* steps */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-grey-50">
              Step by step
            </h3>
            <ol className="mt-2 space-y-4">
              {guide.steps.map((s, i) => (
                <li key={i} className="rounded-xl border border-grey-20 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-grey-90 font-mono text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-grey-90">{s.title}</span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-[34px]">
                    {s.details.map((d, j) => (
                      <p key={j} className="text-[13px] leading-relaxed text-grey-70">{d}</p>
                    ))}
                    {s.links?.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                        className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] font-medium text-grey-60 hover:bg-grey-10">
                        {Glyph.ext("h-3.5 w-3.5")} {l.label}
                      </a>
                    ))}
                    {s.copy?.map((c) => (
                      <div key={c.label} className="mt-1.5">
                        <div className="text-[11px] font-medium text-grey-50">{c.label}</div>
                        <div className="mt-0.5 flex items-center gap-2 rounded-lg border border-grey-20 bg-grey-10 px-3 py-2">
                          <input readOnly value={c.value}
                            className="w-full border-0 bg-transparent font-mono text-xs text-grey-60 outline-none" />
                          <button onClick={() => onCopy(c.value, `${guide.key}:${c.label}`)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] text-grey-60 hover:bg-grey-10">
                            {copied === `${guide.key}:${c.label}`
                              ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
                              : <>{Glyph.copy("h-3.5 w-3.5")} Copy</>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* permissions w/ paste-ready justifications */}
          {guide.permissions && guide.permissions.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-grey-50">
                Permissions to request — with paste-ready justifications
              </h3>
              <p className="mt-1 text-[12px] text-grey-50">
                In App Review, request each permission below. Paste the justification text as the
                &ldquo;how will you use this&rdquo; answer (adjust freely, but keep it specific).
              </p>
              <div className="mt-2 space-y-3">
                {guide.permissions.map((perm) => (
                  <div key={perm.permission} className="rounded-xl border border-grey-20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="rounded bg-grey-10 px-2 py-0.5 font-mono text-xs font-semibold text-grey-90">
                        {perm.permission}
                      </code>
                      <button onClick={() => onCopy(perm.justification, `${guide.key}:perm:${perm.permission}`)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] text-grey-60 hover:bg-grey-10">
                        {copied === `${guide.key}:perm:${perm.permission}`
                          ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
                          : <>{Glyph.copy("h-3.5 w-3.5")} Copy justification</>}
                      </button>
                    </div>
                    <p className="mt-1 text-[12px] font-medium text-grey-70">{perm.usedFor}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-grey-50">{perm.justification}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* review checklist */}
          {guide.review && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-grey-50">
                {guide.review.title}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {guide.review.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-grey-70">
                    <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded border border-grey-30 text-[10px]" />
                    {it}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* go live */}
          {guide.golive && guide.golive.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-grey-50">Going live</h3>
              <ul className="mt-2 space-y-1.5">
                {guide.golive.map((g, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-grey-70">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-grey-40" />
                    {g}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* verify */}
          {guide.verify && guide.verify.length > 0 && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                How you know it worked
              </h3>
              <ul className="mt-2 space-y-1.5">
                {guide.verify.map((v, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-emerald-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {v}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
