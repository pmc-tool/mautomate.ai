/**
 * Marketing — SEO & Blog.
 *
 * The keyword → brief → article → publish pipeline in one self-contained page:
 *   1. Select or create an SEO project.
 *   2. Track keywords (add by hand OR "Suggest with AI" → accept ideas).
 *   3. Generate a content brief from a keyword (shows the AI outline).
 *   4. Generate a product-grounded article from the brief (shows body + SEO score).
 *   5. Edit the draft, then Publish it into the store's CMS blog.
 *
 * Everything degrades gracefully: when no AI provider is configured the backend
 * returns `needs_ai` and the UI shows a "Connect an AI provider" hint instead of
 * failing. A CMS hiccup on publish keeps the article in "review" with a toast.
 *
 * API (all under /admin/marketing/seo):
 *   GET/POST   projects            · GET/POST/DELETE projects/:id
 *   GET/POST   keywords            · POST keywords/suggest
 *   GET/POST   briefs
 *   GET        articles            · POST articles/generate
 *   GET/POST/DELETE articles/:id   · POST articles/:id/publish
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowUpTray,
  DocumentText,
  MagnifyingGlass,
  Newspaper,
  PencilSquare,
  Plus,
  Sparkles,
  Trash,
  XMarkMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  EmptyState,
  PageHeader,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SeoProject = {
  id: string
  name: string
  domain?: string | null
  target_locale?: string | null
}

type Keyword = {
  id: string
  seo_project_id?: string | null
  term: string
  intent?: string | null
  volume?: number | null
  difficulty?: number | null
  status?: string | null
}

type BriefOutline = {
  title?: string
  meta_description?: string
  h2s?: string[]
  talking_points?: string[]
  internal_link_ideas?: string[]
  draft_body?: string
  draft_meta?: string
}

type Brief = {
  id: string
  seo_project_id?: string | null
  keyword_id?: string | null
  outline?: BriefOutline | null
  status?: string | null
}

type Article = {
  id: string
  brief_id?: string | null
  cms_blog_post_id?: string | null
  title?: string | null
  status?: string | null
  seo_score?: number | null
}

type KeywordSuggestion = {
  term: string
  intent?: string | null
}

type PickerProduct = {
  id: string
  title: string
  thumbnail?: string | null
}

/* ------------------------------------------------------------------ */
/* Data layer                                                          */
/* ------------------------------------------------------------------ */

async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

const listProjects = () =>
  api<{ projects: SeoProject[] }>(`/admin/marketing/seo/projects`)

const createProject = (body: {
  name: string
  domain?: string
  target_locale?: string
}) =>
  api<{ project: SeoProject }>(`/admin/marketing/seo/projects`, {
    method: "POST",
    json: body,
  })

const getProject = (id: string) =>
  api<{
    project: SeoProject
    keywords: Keyword[]
    briefs: Brief[]
    articles: Article[]
  }>(`/admin/marketing/seo/projects/${id}`)

const deleteProject = (id: string) =>
  api(`/admin/marketing/seo/projects/${id}`, { method: "DELETE" })

const createKeyword = (body: {
  seo_project_id: string
  term: string
  intent?: string
}) =>
  api<{ keyword: Keyword }>(`/admin/marketing/seo/keywords`, {
    method: "POST",
    json: body,
  })

const suggestKeywords = (body: {
  seo_project_id: string
  seed_term: string
  count?: number
}) =>
  api<{ keywords: KeywordSuggestion[]; needs_ai: boolean }>(
    `/admin/marketing/seo/keywords/suggest`,
    { method: "POST", json: body }
  )

const generateBrief = (body: { seo_project_id: string; keyword_id: string }) =>
  api<{ brief: Brief; needs_ai: boolean }>(`/admin/marketing/seo/briefs`, {
    method: "POST",
    json: body,
  })

const generateArticle = (body: {
  brief_id: string
  brand_voice_id?: string
  product_ids?: string[]
}) =>
  api<{
    article: Article
    body: string
    meta_description: string
    seo_score: number
    needs_ai: boolean
  }>(`/admin/marketing/seo/articles/generate`, { method: "POST", json: body })

const getArticle = (id: string) =>
  api<{ article: Article; body: string; meta_description: string }>(
    `/admin/marketing/seo/articles/${id}`
  )

const updateArticle = (
  id: string,
  body: {
    title?: string
    status?: string
    body?: string
    meta_description?: string
  }
) =>
  api<{ article: Article; body: string; meta_description: string }>(
    `/admin/marketing/seo/articles/${id}`,
    { method: "POST", json: body }
  )

const deleteArticle = (id: string) =>
  api(`/admin/marketing/seo/articles/${id}`, { method: "DELETE" })

const publishArticle = (id: string) =>
  api<{
    article: Article
    cms_blog_post_id: string | null
    published: boolean
    message?: string
  }>(`/admin/marketing/seo/articles/${id}/publish`, { method: "POST" })

const listBrandVoices = () =>
  api<{ brand_voices: { id: string; name: string }[] }>(
    `/admin/marketing/brand-voice`
  ).catch(() => ({ brand_voices: [] }))

async function searchProducts(q: string): Promise<PickerProduct[]> {
  const qs = new URLSearchParams()
  if (q) qs.set("q", q)
  qs.set("limit", "10")
  qs.set("fields", "id,title,thumbnail")
  try {
    const res = await api<{ products: any[] }>(`/admin/products?${qs.toString()}`)
    return (res.products ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
    }))
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

type BadgeColor = "green" | "grey" | "orange" | "blue" | "red" | "purple"

const KEYWORD_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  tracked: { label: "Tracked", color: "grey" },
  targeted: { label: "Targeted", color: "blue" },
  ranking: { label: "Ranking", color: "green" },
}

const BRIEF_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Draft", color: "grey" },
  ready: { label: "Ready", color: "blue" },
  used: { label: "Used", color: "green" },
}

const ARTICLE_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Draft", color: "grey" },
  review: { label: "In review", color: "orange" },
  published: { label: "Published", color: "green" },
}

const humanize = (v?: string | null): string =>
  !v ? "—" : v.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

function StatusBadge({
  map,
  status,
}: {
  map: Record<string, { label: string; color: BadgeColor }>
  status?: string | null
}) {
  const meta = (status && map[status]) || { label: humanize(status), color: "grey" as BadgeColor }
  return (
    <Badge size="2xsmall" color={meta.color}>
      {meta.label}
    </Badge>
  )
}

function scoreColor(score?: number | null): BadgeColor {
  if (typeof score !== "number") return "grey"
  if (score >= 75) return "green"
  if (score >= 50) return "orange"
  return "red"
}

function NeedsAiHint({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2 ${
        className ?? ""
      }`}
    >
      <Sparkles className="text-ui-fg-muted" />
      <Text size="small" className="text-ui-fg-subtle">
        Connect an AI provider (set <code>OPENAI_API_KEY</code>) to enable
        AI-assisted suggestions and drafting.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const SeoBlogPage = () => {
  const dialog = usePrompt()

  const [projects, setProjects] = useState<SeoProject[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [brandVoices, setBrandVoices] = useState<{ id: string; name: string }[]>(
    []
  )

  // New-project form
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [npName, setNpName] = useState("")
  const [npDomain, setNpDomain] = useState("")
  const [npLocale, setNpLocale] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)

  // Keyword add
  const [kwTerm, setKwTerm] = useState("")
  const [kwIntent, setKwIntent] = useState("")
  const [addingKw, setAddingKw] = useState(false)

  // Suggest
  const [seedTerm, setSeedTerm] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[] | null>(
    null
  )
  const [suggestNeedsAi, setSuggestNeedsAi] = useState(false)

  // Per-row busy flags
  const [briefBusyKw, setBriefBusyKw] = useState<string | null>(null)
  const [articleBusyBrief, setArticleBusyBrief] = useState<string | null>(null)

  // Article drawer
  const [openArticleId, setOpenArticleId] = useState<string | null>(null)

  /* ---- load projects ---- */
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    setProjectsError(null)
    try {
      const data = await listProjects()
      const list = data.projects ?? []
      setProjects(list)
      setSelectedId((cur) => cur ?? list[0]?.id ?? null)
    } catch (e: any) {
      setProjectsError(e?.message ?? "Unexpected error.")
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
    listBrandVoices().then((d) => setBrandVoices(d.brand_voices ?? []))
  }, [loadProjects])

  /* ---- load detail for selected project ---- */
  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const data = await getProject(id)
      setKeywords(data.keywords ?? [])
      setBriefs(data.briefs ?? [])
      setArticles(data.articles ?? [])
    } catch (e: any) {
      toast.error("Could not load project", {
        description: e?.message ?? "Unexpected error.",
      })
      setKeywords([])
      setBriefs([])
      setArticles([])
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId)
      setSuggestions(null)
    }
  }, [selectedId, loadDetail])

  const selectedProject = (projects ?? []).find((p) => p.id === selectedId)

  /* ---- project actions ---- */
  const submitNewProject = async () => {
    if (!npName.trim()) {
      toast.error("A project name is required")
      return
    }
    setCreatingProject(true)
    try {
      const res = await createProject({
        name: npName.trim(),
        domain: npDomain.trim() || undefined,
        target_locale: npLocale.trim() || undefined,
      })
      toast.success("SEO project created")
      setNewProjectOpen(false)
      setNpName("")
      setNpDomain("")
      setNpLocale("")
      await loadProjects()
      setSelectedId(res.project.id)
    } catch (e: any) {
      toast.error("Could not create project", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setCreatingProject(false)
    }
  }

  const removeProject = async (p: SeoProject) => {
    const ok = await dialog({
      title: "Delete SEO project",
      description: `Delete "${p.name}"? Its keywords and briefs stay, but the project is removed.`,
      confirmText: "Delete",
      cancelText: "Keep",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deleteProject(p.id)
      toast.success("Project deleted")
      setSelectedId(null)
      await loadProjects()
    } catch (e: any) {
      toast.error("Could not delete project", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  /* ---- keyword actions ---- */
  const addKeyword = async () => {
    if (!selectedId) return
    if (!kwTerm.trim()) {
      toast.error("Enter a keyword term")
      return
    }
    setAddingKw(true)
    try {
      await createKeyword({
        seo_project_id: selectedId,
        term: kwTerm.trim(),
        intent: kwIntent.trim() || undefined,
      })
      setKwTerm("")
      setKwIntent("")
      toast.success("Keyword added")
      await loadDetail(selectedId)
    } catch (e: any) {
      toast.error("Could not add keyword", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setAddingKw(false)
    }
  }

  const runSuggest = async () => {
    if (!selectedId) return
    if (!seedTerm.trim()) {
      toast.error("Enter a seed term to brainstorm around")
      return
    }
    setSuggesting(true)
    setSuggestions(null)
    setSuggestNeedsAi(false)
    try {
      const res = await suggestKeywords({
        seo_project_id: selectedId,
        seed_term: seedTerm.trim(),
        count: 10,
      })
      setSuggestions(res.keywords ?? [])
      setSuggestNeedsAi(res.needs_ai)
      if (res.needs_ai) {
        toast.info("AI is not connected — no suggestions were generated.")
      } else if (!res.keywords?.length) {
        toast.info("No suggestions came back. Try a different seed term.")
      }
    } catch (e: any) {
      toast.error("Could not suggest keywords", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSuggesting(false)
    }
  }

  const acceptSuggestion = async (s: KeywordSuggestion) => {
    if (!selectedId) return
    try {
      await createKeyword({
        seo_project_id: selectedId,
        term: s.term,
        intent: s.intent ?? undefined,
      })
      toast.success(`Added "${s.term}"`)
      setSuggestions((cur) => (cur ?? []).filter((x) => x.term !== s.term))
      await loadDetail(selectedId)
    } catch (e: any) {
      toast.error("Could not add keyword", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  const makeBrief = async (kw: Keyword) => {
    if (!selectedId) return
    setBriefBusyKw(kw.id)
    try {
      const res = await generateBrief({
        seo_project_id: selectedId,
        keyword_id: kw.id,
      })
      if (res.needs_ai) {
        toast.info("AI is not connected — a minimal brief was created.", {
          description: "Connect an AI provider to auto-fill the outline.",
        })
      } else {
        toast.success("Brief generated")
      }
      await loadDetail(selectedId)
    } catch (e: any) {
      toast.error("Could not generate brief", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBriefBusyKw(null)
    }
  }

  /* ---- article actions ---- */
  const makeArticle = async (
    brief: Brief,
    brandVoiceId?: string,
    productIds?: string[]
  ) => {
    setArticleBusyBrief(brief.id)
    try {
      const res = await generateArticle({
        brief_id: brief.id,
        brand_voice_id: brandVoiceId,
        product_ids: productIds,
      })
      if (res.needs_ai) {
        toast.info("AI is not connected — an empty draft was created.", {
          description: "Connect an AI provider to draft the article body.",
        })
      } else {
        toast.success(`Article drafted · SEO score ${res.seo_score}`)
      }
      if (selectedId) await loadDetail(selectedId)
      setOpenArticleId(res.article?.id ?? null)
    } catch (e: any) {
      toast.error("Could not generate article", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setArticleBusyBrief(null)
    }
  }

  const keywordById = (id?: string | null) =>
    keywords.find((k) => k.id === id) ?? null

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={MagnifyingGlass}
          accent="teal"
          title="SEO & Blog"
          subtitle="Track keywords, brief and draft product-grounded articles, then publish them to your store blog."
          actions={
            <>
              {projects && projects.length > 0 && (
                <div className="min-w-[12rem]">
                  <Select
                    value={selectedId ?? undefined}
                    onValueChange={(v) => setSelectedId(v)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a project" />
                    </Select.Trigger>
                    <Select.Content>
                      {projects.map((p) => (
                        <Select.Item key={p.id} value={p.id}>
                          {p.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
              <Button size="small" onClick={() => setNewProjectOpen(true)}>
                <Plus />
                New project
              </Button>
            </>
          }
        />
      </div>

      {/* New project form */}
      {newProjectOpen && (
        <div className="flex flex-col gap-y-3 border-b border-ui-border-base bg-ui-bg-subtle px-6 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <LabeledField label="Name">
              <Input
                value={npName}
                placeholder="Store blog"
                onChange={(e) => setNpName(e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Domain (optional)">
              <Input
                value={npDomain}
                placeholder="mystore.com"
                onChange={(e) => setNpDomain(e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Target locale (optional)">
              <Input
                value={npLocale}
                placeholder="en"
                onChange={(e) => setNpLocale(e.target.value)}
              />
            </LabeledField>
          </div>
          <div className="flex items-center justify-end gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setNewProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="small"
              onClick={submitNewProject}
              isLoading={creatingProject}
            >
              Create project
            </Button>
          </div>
        </div>
      )}

      {/* Body */}
      {projectsError ? (
        <ErrorBlock message={projectsError} onRetry={loadProjects} />
      ) : loadingProjects && !projects ? (
        <Text className="px-6 py-12 text-ui-fg-subtle">Loading projects…</Text>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          accent="teal"
          title="No SEO projects yet"
          description="Create a project to start tracking keywords and drafting blog articles."
        />
      ) : !selectedProject ? (
        <EmptyState
          icon={MagnifyingGlass}
          accent="teal"
          title="Pick a project"
          description="Select an SEO project above to view its keywords and articles."
        />
      ) : (
        <div className="flex flex-col gap-y-8 px-6 py-6">
          {/* Project meta row */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-y-0.5">
              <Text weight="plus">{selectedProject.name}</Text>
              <Text size="xsmall" className="text-ui-fg-muted">
                {selectedProject.domain || "no domain"} ·{" "}
                {(selectedProject.target_locale || "en").toUpperCase()}
              </Text>
            </div>
            <Button
              size="small"
              variant="transparent"
              onClick={() => removeProject(selectedProject)}
            >
              <Trash />
              Delete project
            </Button>
          </div>

          {/* --- Keywords --- */}
          <Section
            title="Keywords"
            subtitle="Add terms by hand or brainstorm ideas grounded in your catalog."
          >
            {/* add + suggest controls */}
            <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_12rem_auto]">
                <Input
                  value={kwTerm}
                  placeholder="e.g. best wireless earbuds"
                  onChange={(e) => setKwTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                />
                <Input
                  value={kwIntent}
                  placeholder="intent (optional)"
                  onChange={(e) => setKwIntent(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                />
                <Button onClick={addKeyword} isLoading={addingKw}>
                  <Plus />
                  Add keyword
                </Button>
              </div>

              <div className="h-px bg-ui-border-base" />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={seedTerm}
                  placeholder="Seed term to brainstorm around…"
                  onChange={(e) => setSeedTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSuggest()}
                />
                <Button
                  variant="secondary"
                  onClick={runSuggest}
                  isLoading={suggesting}
                >
                  <Sparkles />
                  Suggest with AI
                </Button>
              </div>

              {suggestNeedsAi && <NeedsAiHint />}

              {suggestions && suggestions.length > 0 && (
                <div className="flex flex-col gap-y-2 rounded-lg bg-ui-bg-subtle p-3">
                  <Text size="small" weight="plus">
                    Suggested keywords — click to add
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.term}
                        type="button"
                        onClick={() => acceptSuggestion(s)}
                        className="inline-flex items-center gap-x-1.5 rounded-md border border-ui-border-base bg-ui-bg-base px-2.5 py-1 text-left transition-colors hover:bg-ui-bg-base-hover"
                      >
                        <Plus className="text-ui-fg-muted" />
                        <span className="text-ui-fg-base text-sm">{s.term}</span>
                        {s.intent && (
                          <Badge size="2xsmall" color="grey">
                            {s.intent}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* keyword table */}
            {loadingDetail ? (
              <Text size="small" className="px-1 py-3 text-ui-fg-subtle">
                Loading…
              </Text>
            ) : keywords.length === 0 ? (
              <EmptyState
                icon={MagnifyingGlass}
                accent="teal"
                title="No keywords yet"
                description="Add a term by hand or brainstorm ideas with AI above."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-ui-border-base">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">Term</th>
                      <th className="px-3 py-2 font-medium">Intent</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-border-base">
                    {keywords.map((k) => (
                      <tr key={k.id}>
                        <td className="px-3 py-2 text-ui-fg-base">{k.term}</td>
                        <td className="px-3 py-2 text-ui-fg-subtle">
                          {k.intent || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge map={KEYWORD_STATUS} status={k.status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="small"
                            variant="secondary"
                            isLoading={briefBusyKw === k.id}
                            onClick={() => makeBrief(k)}
                          >
                            <DocumentText />
                            Brief
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* --- Briefs --- */}
          <Section
            title="Content briefs"
            subtitle="AI outlines. Generate an article from any ready brief."
          >
            {briefs.length === 0 ? (
              <EmptyState
                icon={DocumentText}
                accent="teal"
                title="No briefs yet"
                description="Generate a content brief from any keyword above."
              />
            ) : (
              <div className="flex flex-col gap-y-3">
                {briefs.map((brief) => (
                  <BriefCard
                    key={brief.id}
                    brief={brief}
                    keyword={keywordById(brief.keyword_id)}
                    brandVoices={brandVoices}
                    busy={articleBusyBrief === brief.id}
                    onGenerate={(voiceId, productIds) =>
                      makeArticle(brief, voiceId, productIds)
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          {/* --- Articles --- */}
          <Section
            title="Articles"
            subtitle="Draft, edit and publish to your store blog."
          >
            {articles.length === 0 ? (
              <EmptyState
                icon={Newspaper}
                accent="teal"
                title="No articles yet"
                description="Draft an article from a ready brief above."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-ui-border-base">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">SEO</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-border-base">
                    {articles.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 text-ui-fg-base">
                          {a.title || "Untitled"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            map={ARTICLE_STATUS}
                            status={a.status}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Badge size="2xsmall" color={scoreColor(a.seo_score)}>
                            {typeof a.seo_score === "number"
                              ? a.seo_score
                              : "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => setOpenArticleId(a.id)}
                          >
                            <PencilSquare />
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Article drawer */}
      <ArticleDrawer
        articleId={openArticleId}
        onClose={() => setOpenArticleId(null)}
        onChanged={() => selectedId && loadDetail(selectedId)}
      />
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Brief card (with product grounding for article generation)          */
/* ------------------------------------------------------------------ */

function BriefCard({
  brief,
  keyword,
  brandVoices,
  busy,
  onGenerate,
}: {
  brief: Brief
  keyword: Keyword | null
  brandVoices: { id: string; name: string }[]
  busy: boolean
  onGenerate: (brandVoiceId?: string, productIds?: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [voiceId, setVoiceId] = useState<string>("")
  const [products, setProducts] = useState<PickerProduct[]>([])
  const [pquery, setPquery] = useState("")
  const [presults, setPresults] = useState<PickerProduct[]>([])
  const [searching, setSearching] = useState(false)

  const outline = brief.outline ?? {}

  const doSearch = async () => {
    setSearching(true)
    try {
      setPresults(await searchProducts(pquery))
    } finally {
      setSearching(false)
    }
  }

  const addProduct = (p: PickerProduct) => {
    setProducts((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]))
  }
  const removeProduct = (id: string) =>
    setProducts((cur) => cur.filter((x) => x.id !== id))

  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-start justify-between gap-x-3">
        <div className="flex min-w-0 flex-col gap-y-0.5">
          <Text size="small" weight="plus" className="truncate">
            {outline.title || keyword?.term || "Untitled brief"}
          </Text>
          <div className="flex items-center gap-x-2">
            <StatusBadge map={BRIEF_STATUS} status={brief.status} />
            {keyword && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {keyword.term}
              </Text>
            )}
          </div>
        </div>
        <Button
          size="small"
          variant="transparent"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide outline" : "View outline"}
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-y-3 rounded-lg bg-ui-bg-subtle p-3">
          {outline.meta_description && (
            <OutlineBlock label="Meta description">
              <Text size="small" className="text-ui-fg-subtle">
                {outline.meta_description}
              </Text>
            </OutlineBlock>
          )}
          {!!outline.h2s?.length && (
            <OutlineBlock label="Section headings">
              <ul className="list-disc pl-5">
                {outline.h2s.map((h, i) => (
                  <li key={i} className="text-ui-fg-subtle text-sm">
                    {h}
                  </li>
                ))}
              </ul>
            </OutlineBlock>
          )}
          {!!outline.talking_points?.length && (
            <OutlineBlock label="Talking points">
              <ul className="list-disc pl-5">
                {outline.talking_points.map((h, i) => (
                  <li key={i} className="text-ui-fg-subtle text-sm">
                    {h}
                  </li>
                ))}
              </ul>
            </OutlineBlock>
          )}
          {!!outline.internal_link_ideas?.length && (
            <OutlineBlock label="Internal link ideas">
              <div className="flex flex-wrap gap-1.5">
                {outline.internal_link_ideas.map((h, i) => (
                  <Badge key={i} size="2xsmall" color="blue">
                    {h}
                  </Badge>
                ))}
              </div>
            </OutlineBlock>
          )}
          {!outline.h2s?.length &&
            !outline.talking_points?.length &&
            !outline.meta_description && (
              <Text size="small" className="text-ui-fg-muted">
                This brief has no AI outline yet.
              </Text>
            )}
        </div>
      )}

      {/* Article generation controls */}
      <div className="flex flex-col gap-y-3 border-t border-ui-border-base pt-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledField label="Brand voice (optional)">
            <Select value={voiceId} onValueChange={setVoiceId}>
              <Select.Trigger>
                <Select.Value placeholder="Default voice" />
              </Select.Trigger>
              <Select.Content>
                {brandVoices.map((v) => (
                  <Select.Item key={v.id} value={v.id}>
                    {v.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </LabeledField>
          <LabeledField label="Ground in products (optional)">
            <div className="flex gap-x-2">
              <Input
                value={pquery}
                placeholder="Search products…"
                onChange={(e) => setPquery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
              />
              <Button
                variant="secondary"
                onClick={doSearch}
                isLoading={searching}
              >
                <MagnifyingGlass />
              </Button>
            </div>
          </LabeledField>
        </div>

        {presults.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="inline-flex items-center gap-x-1 rounded-md border border-ui-border-base bg-ui-bg-base px-2 py-1 text-left text-sm transition-colors hover:bg-ui-bg-base-hover"
              >
                <Plus className="text-ui-fg-muted" />
                {p.title}
              </button>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {products.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-x-1 rounded-md border border-ui-border-base bg-ui-bg-subtle px-2 py-0.5 text-sm"
              >
                {p.title}
                <button
                  type="button"
                  aria-label={`Remove ${p.title}`}
                  onClick={() => removeProduct(p.id)}
                  className="text-ui-fg-muted hover:text-ui-fg-base"
                >
                  <XMarkMini />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() =>
              onGenerate(
                voiceId || undefined,
                products.length ? products.map((p) => p.id) : undefined
              )
            }
            isLoading={busy}
          >
            <Sparkles />
            Generate article
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Article drawer                                                      */
/* ------------------------------------------------------------------ */

function ArticleDrawer({
  articleId,
  onClose,
  onChanged,
}: {
  articleId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const dialog = usePrompt()
  const [article, setArticle] = useState<Article | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [meta, setMeta] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = !!articleId

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getArticle(id)
      setArticle(data.article)
      setTitle(data.article.title ?? "")
      setBody(data.body ?? "")
      setMeta(data.meta_description ?? "")
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (articleId) load(articleId)
  }, [articleId, load])

  const save = async () => {
    if (!articleId) return
    setSaving(true)
    try {
      const data = await updateArticle(articleId, {
        title: title.trim(),
        body,
        meta_description: meta,
      })
      setArticle(data.article)
      toast.success("Article saved")
      onChanged()
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!articleId) return
    setPublishing(true)
    try {
      // Save any in-flight edits first so the CMS gets the latest body.
      await updateArticle(articleId, {
        title: title.trim(),
        body,
        meta_description: meta,
      }).catch(() => {})

      const res = await publishArticle(articleId)
      setArticle(res.article)
      if (res.published) {
        toast.success("Published to your store blog")
      } else {
        toast.warning("Not published", {
          description:
            res.message ??
            "The article was kept in review. Try again in a moment.",
        })
      }
      onChanged()
    } catch (e: any) {
      toast.error("Could not publish", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishing(false)
    }
  }

  const remove = async () => {
    if (!articleId) return
    const ok = await dialog({
      title: "Delete article",
      description: "Delete this article draft? This can't be undone.",
      confirmText: "Delete",
      cancelText: "Keep",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deleteArticle(articleId)
      toast.success("Article deleted")
      onChanged()
      onClose()
    } catch (e: any) {
      toast.error("Could not delete", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <div className="flex items-center gap-x-2">
            <Drawer.Title>Article</Drawer.Title>
            {article && (
              <StatusBadge map={ARTICLE_STATUS} status={article.status} />
            )}
            {article && typeof article.seo_score === "number" && (
              <Badge size="2xsmall" color={scoreColor(article.seo_score)}>
                SEO {article.seo_score}
              </Badge>
            )}
          </div>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          {error ? (
            <ErrorBlock message={error} onRetry={() => articleId && load(articleId)} />
          ) : loading ? (
            <Text className="text-ui-fg-subtle">Loading article…</Text>
          ) : (
            <>
              <LabeledField label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Meta description">
                <Textarea
                  rows={2}
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Body (markdown)">
                <Textarea
                  rows={18}
                  value={body}
                  placeholder="The generated article body appears here."
                  onChange={(e) => setBody(e.target.value)}
                />
              </LabeledField>
              {!body.trim() && (
                <Text size="small" className="text-ui-fg-muted">
                  This article has no body yet — generate it (with AI connected)
                  before publishing.
                </Text>
              )}
              {article?.cms_blog_post_id && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Linked CMS post: {article.cms_blog_post_id}
                </Text>
              )}
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between">
            <Button size="small" variant="transparent" onClick={remove}>
              <Trash />
              Delete
            </Button>
            <div className="flex items-center gap-x-2">
              <Button
                size="small"
                variant="secondary"
                onClick={save}
                isLoading={saving}
              >
                <ArrowPath />
                Save
              </Button>
              <Button
                size="small"
                onClick={publish}
                isLoading={publishing}
                disabled={!body.trim()}
              >
                <ArrowUpTray />
                Publish to blog
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-col gap-y-0.5">
        <Heading level="h3">{title}</Heading>
        {subtitle && (
          <Text size="small" className="text-ui-fg-subtle">
            {subtitle}
          </Text>
        )}
      </div>
      {children}
    </div>
  )
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
    </div>
  )
}

function OutlineBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1">
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
        {label}
      </Text>
      {children}
    </div>
  )
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-y-3 px-6 py-12">
      <Text weight="plus">Something went wrong</Text>
      <Text size="small" className="text-ui-fg-subtle">
        {message}
      </Text>
      <Button size="small" variant="secondary" onClick={onRetry}>
        <ArrowPath />
        Retry
      </Button>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "SEO & Blog",
  icon: MagnifyingGlass,
})

export default SeoBlogPage
