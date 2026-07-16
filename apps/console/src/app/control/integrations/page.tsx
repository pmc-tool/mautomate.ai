"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  Check,
  CloudSolid,
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
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { BRAND, brandForCategory } from "@/components/brand-icons"
import { cn } from "@/lib/utils"

/* ---------- tiny inline glyphs (avoid icon-pkg export guessing) ---------- */
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
  warn: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
  ),
  bolt: (c?: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
  ),
}

/* ---------- category → icon for simple (non-social) providers ---------- */
function SimpleIcon({ category }: { category: string }) {
  const c = category.toLowerCase()
  const Cmp =
    c.includes("ai") ? Sparkles
      : c.includes("payment") ? CreditCard
        : c.includes("domain") || c.includes("email") ? Envelope
          : c.includes("telephony") ? Server
            : c.includes("cloud") ? CloudSolid
              : Puzzle
  return <Cmp className="h-5 w-5" />
}

/* ---------- status helpers ---------- */
type Tone = "ok" | "warn" | "err" | "none"
const pillClass: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  err: "bg-rose-50 text-rose-800 ring-rose-200",
  none: "bg-grey-10 text-grey-60 ring-grey-20",
}
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", pillClass[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "err" ? "bg-rose-500" : "bg-grey-400")} />
      {children}
    </span>
  )
}

export default function IntegrationsPage() {
  const { token } = useControlAuth()
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [guides, setGuides] = useState<PlatformGuide[]>([])
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [tests, setTests] = useState<Record<string, { ok: boolean; message?: string } | null>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "configured" | "todo" | "issues">("all")

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listIntegrations(token)
      setProviders(res.providers)
      setGuides(res.guides)
      setTests({})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const setVal = (env: string, v: string) => setInputs((p) => ({ ...p, [env]: v }))

  const saveOne = async (env: string): Promise<boolean> => {
    const v = (inputs[env] ?? "").trim()
    if (!v || !token) return false
    await setIntegrationKey(token, env, v)
    setInputs((p) => ({ ...p, [env]: "" }))
    return true
  }
  const handleSaveKeys = async (envs: string[]) => {
    if (!token) return
    setWorking(envs[0])
    try {
      let any = false
      for (const env of envs) if ((inputs[env] ?? "").trim()) { await saveOne(env); any = true }
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
    try {
      const r = await testIntegration(token, env)
      setTests((p) => ({ ...p, [env]: r }))
    }
    catch (e) { setTests((p) => ({ ...p, [env]: { ok: false, message: e instanceof Error ? e.message : "Test failed" } })) }
    finally { setWorking(null) }
  }
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
    setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
  }

  /* ---------- derive groups + stats ---------- */
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return providers.filter((p) => {
      if (ql && !(`${p.name} ${p.key}`.toLowerCase().includes(ql))) return false
      if (filter === "configured" && !p.configured) return false
      if (filter === "todo" && p.configured) return false
      if (filter === "issues") {
        const t = tests[p.key]
        const failing = (t && !t.ok) || p.status === "error"
        if (p.configured && !failing) return false
      }
      return true
    })
  }, [providers, q, filter, tests])

  const groups = useMemo(() => {
    const m = new Map<string, IntegrationProvider[]>()
    for (const p of filtered) {
      const arr = m.get(p.category) ?? []
      arr.push(p); m.set(p.category, arr)
    }
    const social: [string, IntegrationProvider[]][] = []
    const messaging: [string, IntegrationProvider[]][] = []
    const ads: [string, IntegrationProvider[]][] = []
    const simple: IntegrationProvider[] = []
    for (const [cat, arr] of Array.from(m.entries())) {
      if (cat.startsWith("Social")) social.push([cat, arr])
      else if (cat.startsWith("Messaging")) messaging.push([cat, arr])
      else if (cat.startsWith("Ads")) ads.push([cat, arr])
      else simple.push(...arr)
    }
    return { social, messaging, ads, simple }
  }, [filtered])

  const stats = useMemo(() => {
    const total = providers.length
    const configured = providers.filter((p) => p.configured).length
    const env = providers.filter((p) => p.source === "env").length
    const failing = providers.filter((p) => { const t = tests[p.key]; return (t && !t.ok) || p.status === "error" }).length
    return { total, configured, env, todo: total - configured, failing }
  }, [providers, tests])

  const headerAction = (
    <button onClick={load} disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 disabled:opacity-50">
      <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
    </button>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations & Keys"
        description="Connect the third-party apps that power social publishing, messaging, payments and AI. We walk you through each one."
        action={headerAction}
      />

      {/* progress strip */}
      {!loading && providers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-grey-20 bg-white p-4 shadow-borders-base">
          <div className="min-w-[220px] flex-1">
            <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-grey-10">
              <span className="h-full bg-emerald-500" style={{ width: `${(stats.configured / Math.max(stats.total, 1)) * 100}%` }} />
            </div>
            <p className="text-xs text-grey-50">
              <b className="text-grey-90">{stats.configured} / {stats.total}</b> configured
              {" · "}<b className="text-grey-90">{stats.todo}</b> to set up
              {stats.env > 0 && <>{" · "}<b className="text-grey-90">{stats.env}</b> from server env</>}
              {stats.failing > 0 && <>{" · "}<b className="text-rose-600">{stats.failing}</b> failing</>}
            </p>
          </div>
        </div>
      )}

      {/* toolbar */}
      {!loading && providers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2 text-grey-40">
            {Glyph.search("h-4 w-4")}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search provider or key…"
              className="w-full border-0 bg-transparent text-sm text-grey-90 outline-none placeholder:text-grey-40" />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-grey-20 text-sm">
            {(["all", "configured", "todo", "issues"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("border-r border-grey-20 px-3 py-2 last:border-r-0 capitalize",
                  filter === f ? "bg-grey-90 text-white" : "text-grey-60 hover:bg-grey-10")}>
                {f === "todo" ? "To set up" : f}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {/* The employee playbook — how to apply for every platform API */}
      {!loading && guides.some((g) => g.key === "playbook") && (
        <button
          onClick={() => setOpenGuide("playbook")}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-grey-90 bg-grey-90 p-4 text-left text-white shadow-borders-base transition-transform hover:-translate-y-px"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
              {Glyph.bolt("h-5 w-5")}
            </span>
            <div>
              <div className="text-sm font-semibold">Applying for the platform APIs? Start with the playbook.</div>
              <div className="mt-0.5 text-xs text-white/70">
                The order of operations, what documents to prepare once, how app reviews actually pass,
                and where every key goes. Each platform card below has its own full guide.
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium">Open playbook →</span>
        </button>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border border-grey-20 bg-grey-10" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState title="No integrations" description="Provider integrations appear here once registered on the platform." />
      ) : (
        <div className="space-y-2">
          {groups.social.length > 0 && (
            <>
              <SectionHead label="Social" />
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.social.map(([cat, arr]) => (
                  <PlatformCard key={cat} category={cat} providers={arr}
                    inputs={inputs} setVal={setVal} working={working} tests={tests} copied={copied}
                    hasGuide={guides.some((g) => g.key === cat)} onOpenGuide={() => setOpenGuide(cat)}
                    onSave={handleSaveKeys} onTest={handleTest} onClear={handleClear} onCopy={copy} />
                ))}
              </div>
            </>
          )}
          {groups.messaging.length > 0 && (
            <>
              <SectionHead label="Messaging" />
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.messaging.map(([cat, arr]) => (
                  <PlatformCard key={cat} category={cat} providers={arr}
                    inputs={inputs} setVal={setVal} working={working} tests={tests} copied={copied}
                    hasGuide={guides.some((g) => g.key === cat)} onOpenGuide={() => setOpenGuide(cat)}
                    onSave={handleSaveKeys} onTest={handleTest} onClear={handleClear} onCopy={copy} />
                ))}
              </div>
            </>
          )}
          {groups.ads.length > 0 && (
            <>
              <SectionHead label="Advertising" />
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.ads.map(([cat, arr]) => (
                  <PlatformCard key={cat} category={cat} providers={arr}
                    inputs={inputs} setVal={setVal} working={working} tests={tests} copied={copied}
                    hasGuide={guides.some((g) => g.key === cat)} onOpenGuide={() => setOpenGuide(cat)}
                    onSave={handleSaveKeys} onTest={handleTest} onClear={handleClear} onCopy={copy} />
                ))}
              </div>
            </>
          )}
          {groups.simple.length > 0 && (
            <>
              <SectionHead label="AI · Payments · Infrastructure" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.simple.map((p) => (
                  <CompactCard key={p.key} p={p}
                    value={inputs[p.key] ?? ""} setVal={setVal} working={working === p.key}
                    test={tests[p.key] ?? null} onSave={handleSaveKeys} onTest={handleTest} onClear={handleClear} />
                ))}
              </div>
            </>
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

function SectionHead({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-1 flex items-center gap-3 px-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-grey-50">{label}</span>
      <span className="h-px flex-1 bg-grey-20" />
    </div>
  )
}

/* ============================ Guided platform card ============================ */
function PlatformCard(props: {
  category: string
  providers: IntegrationProvider[]
  inputs: Record<string, string>
  setVal: (env: string, v: string) => void
  working: string | null
  tests: Record<string, { ok: boolean; message?: string } | null>
  copied: string | null
  hasGuide?: boolean
  onOpenGuide?: () => void
  onSave: (envs: string[]) => void
  onTest: (env: string) => void
  onClear: (env: string) => void
  onCopy: (text: string, id: string) => void
}) {
  const { category, providers, inputs, setVal, working, tests, copied, hasGuide, onOpenGuide, onSave, onTest, onCopy } = props
  const brandKey = brandForCategory(category)
  const brand = brandKey ? BRAND[brandKey] : null
  const platformName = category.split("·").pop()?.trim() || category

  const configuredCount = providers.filter((p) => p.configured).length
  const total = providers.length
  const anyFailing = providers.some((p) => { const t = tests[p.key]; return (t && !t.ok) || p.status === "error" })
  const rollup: Tone = anyFailing ? "err" : configuredCount === 0 ? "none" : configuredCount < total ? "warn" : "ok"
  const rollupText = anyFailing ? "Action needed" : configuredCount === 0 ? "Not started" : configuredCount < total ? `Needs setup · ${configuredCount}/${total}` : "Connected"

  const docs = providers.find((p) => p.docs)?.docs
  const connectUrl = providers.find((p) => p.connect_url)?.connect_url
  const testable = providers.find((p) => p.testable)
  const isWebhook = category.startsWith("Messaging") || providers.some((p) => p.key.includes("VERIFY"))
  const envs = providers.map((p) => p.key)
  const busy = envs.includes(working ?? "")

  return (
    <div className="overflow-hidden rounded-xl border border-grey-20 bg-white shadow-borders-base">
      {brand && <div className="h-[3px]" style={{ background: brand.color }} />}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `${brand?.color ?? "#71717a"}1f`, color: brand?.color ?? "#71717a" }}>
            {brand ? <brand.Icon className="h-5 w-5" /> : <Puzzle className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-grey-90">{platformName}</h3>
            <p className="text-[11px] text-grey-40">{isWebhook ? "App secret + webhook" : "OAuth app"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasGuide && onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] font-medium text-grey-70 hover:bg-grey-10"
            >
              Full setup guide
            </button>
          )}
          <Pill tone={rollup}>{rollupText}</Pill>
        </div>
      </div>

      <div className="border-t border-grey-20 px-4 pb-4 pt-1">
        {/* step 1 — create app */}
        <Step n={1} done={false}>
          <span className="font-medium text-grey-90">Create your app</span>{" "}
          {providers[0]?.help || "in the provider's developer console."}
          {docs && (
            <div className="mt-2">
              <a href={docs} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] font-medium text-grey-60 hover:bg-grey-10">
                {Glyph.ext("h-3.5 w-3.5")} Open developer console
              </a>
            </div>
          )}
        </Step>

        {/* step 2 — paste credentials */}
        <Step n={2} done={configuredCount > 0}>
          <span className="font-medium text-grey-90">Paste your credentials.</span>
          {providers.filter((p) => !p.key.includes("VERIFY")).map((p) => (
            <Field key={p.key} p={p} value={inputs[p.key] ?? ""} onChange={(v) => setVal(p.key, v)} />
          ))}
        </Step>

        {/* step 3 — register redirect/webhook URL */}
        {connectUrl && (
          <Step n={3} done={false}>
            <span className="font-medium text-grey-90">
              {isWebhook ? "Register the webhook URL" : "Copy your Redirect URI"}
            </span>{" "}
            {isWebhook ? "and verify token in the provider's webhook settings." : "and register it in the app you just created."}
            <div className="mt-2">
              <div className="flex items-center gap-2 rounded-lg border border-grey-20 bg-grey-10 px-3 py-2">
                <input readOnly value={connectUrl} className="w-full border-0 bg-transparent font-mono text-xs text-grey-60 outline-none" />
                <button onClick={() => onCopy(connectUrl, category)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-grey-20 bg-white px-2.5 py-1.5 text-[11px] text-grey-60 hover:bg-grey-10">
                  {copied === category ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</> : <>{Glyph.copy("h-3.5 w-3.5")} Copy</>}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-grey-40">
                Register this exact URL in your {platformName} developer app.
              </p>
            </div>
            {/* verify-token fields, if any */}
            {providers.filter((p) => p.key.includes("VERIFY")).map((p) => (
              <Field key={p.key} p={p} value={inputs[p.key] ?? ""} onChange={(v) => setVal(p.key, v)} chooseYourOwn />
            ))}
          </Step>
        )}

        {configuredCount > 0 && configuredCount < total && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {Glyph.warn("h-4 w-4 shrink-0")} Almost there — fill the remaining field{total - configuredCount > 1 ? "s" : ""} to finish connecting.
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-grey-20 bg-grey-10 px-4 py-3">
        {testable && (
          <button onClick={() => onTest(testable.key)} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50">
            {busy ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : Glyph.bolt("h-3.5 w-3.5")} Test
          </button>
        )}
        <button onClick={() => onSave(envs)} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-3 py-1.5 text-xs font-medium text-white hover:bg-grey-80 disabled:opacity-50">
          {busy ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save changes
        </button>
      </div>
    </div>
  )
}

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[24px_1fr] gap-3 border-t border-dashed border-grey-20 py-3 first:border-t-0">
      <div className={cn("grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-semibold",
        done ? "bg-emerald-500 text-white" : "bg-grey-10 text-grey-50")}>
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <div className="text-[13px] leading-relaxed text-grey-70">{children}</div>
    </div>
  )
}

function Field({ p, value, onChange, chooseYourOwn }: {
  p: IntegrationProvider; value: string; onChange: (v: string) => void; chooseYourOwn?: boolean
}) {
  const isSecret = p.secret !== false
  return (
    <div className="mt-2.5">
      <label className="mb-1 block text-[11px] font-medium text-grey-50">
        {p.name}
        {isSecret && <span className="font-normal text-grey-40"> · secret</span>}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2">
        <input
          type={isSecret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={p.configured ? "•••••••• — leave blank to keep existing" : chooseYourOwn ? "a value you choose" : "Paste value…"}
          className="w-full border-0 bg-transparent font-mono text-[13px] text-grey-90 outline-none placeholder:font-sans placeholder:text-grey-40"
          autoComplete="off"
        />
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", p.configured ? "bg-emerald-500" : "bg-grey-300")} />
      </div>
      {p.configured && p.source === "env" && (
        <p className="mt-1 text-[11px] text-sky-700">Provided by server environment — override by entering a value.</p>
      )}
    </div>
  )
}

/* ============================ Compact single-key card ============================ */
function CompactCard({ p, value, setVal, working, test, onSave, onTest, onClear }: {
  p: IntegrationProvider; value: string; setVal: (env: string, v: string) => void; working: boolean
  test: { ok: boolean; message?: string } | null
  onSave: (envs: string[]) => void; onTest: (env: string) => void; onClear: (env: string) => void
}) {
  const tone: Tone = test ? (test.ok ? "ok" : "err") : p.status === "error" ? "err" : p.configured ? "ok" : "none"
  const label = test ? (test.ok ? "Test passed" : "Test failed") : p.configured ? (p.source === "env" ? "From env" : "Configured") : "Not set"
  return (
    <div className="rounded-xl border border-grey-20 bg-white p-4 shadow-borders-base">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-grey-10 text-grey-60"><SimpleIcon category={p.category} /></div>
          <div>
            <h3 className="text-[13px] font-semibold text-grey-90">{p.name}</h3>
            <p className="text-[10.5px] text-grey-40">{p.category}</p>
          </div>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2">
        <input
          type={p.secret !== false ? "password" : "text"}
          value={value}
          onChange={(e) => setVal(p.key, e.target.value)}
          placeholder={p.configured ? "•••• leave blank to keep" : "Paste key…"}
          disabled={p.source === "env"}
          className="w-full border-0 bg-transparent font-mono text-[13px] text-grey-90 outline-none placeholder:font-sans placeholder:text-grey-40 disabled:opacity-60"
          autoComplete="off"
        />
      </div>

      {test && !test.ok && <p className="mt-1.5 text-[11px] text-rose-600">{test.message}</p>}

      <div className="mt-2.5 flex items-center justify-between">
        {p.help ? (
          p.docs
            ? <a href={p.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-grey-50 hover:text-grey-80">{Glyph.ext("h-3 w-3")} Where to get it</a>
            : <span className="text-[11px] text-grey-40">{p.help}</span>
        ) : <span />}
        {p.source === "env" && <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-[10px] text-sky-700">env</span>}
      </div>

      <div className="mt-3 flex gap-2">
        {p.testable && (
          <button onClick={() => onTest(p.key)} disabled={working}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50">
            {working ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : "Test"}
          </button>
        )}
        {p.configured && p.source !== "env" && (
          <button onClick={() => onClear(p.key)} disabled={working}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-60 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
            <Trash className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => onSave([p.key])} disabled={working || p.source === "env"}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-grey-90 px-3 py-1.5 text-xs font-medium text-white hover:bg-grey-80 disabled:opacity-50">
          {working ? <ArrowPath className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </button>
      </div>
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
