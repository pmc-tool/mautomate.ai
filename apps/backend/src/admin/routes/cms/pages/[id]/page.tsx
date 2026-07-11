/**
 * Forever Finds CMS — Page editor (Phase 3).
 *
 * The multi-block page builder. Loads the DRAFT tree (page + ordered sections +
 * translations), lets an editor:
 *   - reorder sections (up/down — @dnd-kit is not installed, so we use arrow
 *     reordering, which calls POST /admin/cms/pages/:id/sections/reorder),
 *   - add a section from the block palette (POSTs defaultData() from the admin
 *     block-editor registry),
 *   - edit a section in a Drawer (renders the registered block editor; EN edits
 *     the full payload, BN edits the sparse translation override),
 *   - enable/disable and delete sections,
 *   - edit page settings (title / slug / status / SEO, per-locale),
 *   - publish the current locale (POST /admin/cms/pages/:id/publish?locale=).
 *
 * This route has no `defineRouteConfig`, so it is reachable at /cms/pages/:id but
 * does not appear in the sidebar.
 */
import {
  ArrowLeft,
  ArrowDownMini,
  ArrowPath,
  ArrowUpMini,
  ArrowUturnLeft,
  Clock,
  CogSixTooth,
  DocumentText,
  EllipsisHorizontal,
  Eye,
  PencilSquare,
  Plus,
  RocketLaunch,
  Trash,
  XMarkMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  clx,
  Container,
  DatePicker,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { Locale } from "../../../../../modules/cms/types"
import {
  ADD_SECTION_PALETTE,
  getBlockEditor,
  type BlockEditorLocale,
} from "../../../../components/cms/blocks/registry"
import {
  addSection,
  cancelSchedulePublish,
  deletePage,
  deleteSection,
  getPage,
  getRevision,
  listRevisions,
  mintPreviewToken,
  publishPage,
  reorderSections,
  restoreRevision,
  schedulePublish,
  sectionTranslationData,
  STATUS_BADGE,
  updatePage,
  updateSection,
  type CmsPageFull,
  type CmsRevisionFull,
  type CmsRevisionRow,
  type CmsSection,
  type CompiledPageData,
  type CompiledSection,
  type LocaleStatusMap,
  type PageScalarInput,
  type PageStatus,
} from "../lib"

type EditorLocale = BlockEditorLocale

const LOCALES: EditorLocale[] = ["en", "bn"]

/** Native-script display label for the locale switcher / publish controls. */
const LOCALE_LABEL: Record<EditorLocale, string> = {
  en: "English",
  bn: "বাংলা",
}

/** Human-readable date + time for the scheduled-publish status line. */
const formatDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/* ================================================================== */
/* Page editor                                                         */
/* ================================================================== */

const PageEditor = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const dialog = usePrompt()

  const [page, setPage] = useState<CmsPageFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [locale, setLocale] = useState<EditorLocale>("en")

  // Server-computed per-locale publish status (live version + drift).
  const [localeStatus, setLocaleStatus] = useState<LocaleStatusMap | null>(null)
  // Which locale is currently being published (null = idle).
  const [publishingLocale, setPublishingLocale] = useState<EditorLocale | null>(
    null
  )
  // Optimistic "draft has changes" flag, for instant feedback before the next
  // load() reconciles it against the authoritative server locale_status.
  const [optimisticDirty, setOptimisticDirty] = useState<
    Record<string, boolean>
  >({})

  const [editingSection, setEditingSection] = useState<CmsSection | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busyRow, setBusyRow] = useState<string | null>(null)

  const markDirty = useCallback(() => {
    // Any structural / content change invalidates every locale's snapshot
    // (a bn snapshot is deepMerge(en, bn override), so en edits stale bn too).
    setOptimisticDirty({ en: true, bn: true })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { page, locale_status } = await getPage(id)
      page.sections = (page.sections ?? []).slice().sort((a, b) => a.rank - b.rank)
      setPage(page)
      setLocaleStatus(locale_status)
      // Server status is authoritative — clear any optimistic drift flags.
      setOptimisticDirty({})
    } catch (e: any) {
      toast.error("Could not load page", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  /* -------- section ops -------- */

  const move = async (index: number, dir: -1 | 1) => {
    if (!page) return
    const sections = page.sections
    const target = index + dir
    if (target < 0 || target >= sections.length) return
    const next = sections.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    // Optimistic.
    setPage({ ...page, sections: next.map((s, i) => ({ ...s, rank: i })) })
    try {
      const { sections: saved } = await reorderSections(
        id,
        next.map((s) => s.id)
      )
      setPage((p) =>
        p
          ? {
              ...p,
              sections: saved.slice().sort((a, b) => a.rank - b.rank),
            }
          : p
      )
      markDirty()
    } catch (e: any) {
      toast.error("Could not reorder", { description: e?.message })
      load()
    }
  }

  const add = async (type: string) => {
    const entry = getBlockEditor(type)
    if (!entry) return
    try {
      await addSection(id, { type: entry.type, data: entry.defaultData() })
      toast.success("Section added", { description: entry.label })
      markDirty()
      await load()
    } catch (e: any) {
      toast.error("Could not add section", { description: e?.message })
    }
  }

  const toggleEnabled = async (section: CmsSection, enabled: boolean) => {
    setBusyRow(section.id)
    // Optimistic.
    setPage((p) =>
      p
        ? {
            ...p,
            sections: p.sections.map((s) =>
              s.id === section.id ? { ...s, enabled } : s
            ),
          }
        : p
    )
    try {
      await updateSection(section.id, { enabled })
      markDirty()
    } catch (e: any) {
      toast.error("Could not update", { description: e?.message })
      load()
    } finally {
      setBusyRow(null)
    }
  }

  const removeSection = async (section: CmsSection) => {
    const ok = await dialog({
      title: "Delete section",
      description: `Remove this ${
        getBlockEditor(section.type)?.label ?? section.type
      } section? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deleteSection(section.id)
      toast.success("Section deleted")
      markDirty()
      await load()
    } catch (e: any) {
      toast.error("Could not delete", { description: e?.message })
    }
  }

  /* -------- publish -------- */

  const publish = async (target: EditorLocale) => {
    if (!page) return
    // Guard: a bn snapshot is a deepMerge over the en snapshot, so EN must be
    // live before BN can be published. The backend enforces this too (422); we
    // pre-empt it here for a friendlier UX.
    if (target === "bn" && !localeStatus?.en.published) {
      toast.error("Publish English first", {
        description:
          "Bengali is published as overrides on top of the English snapshot.",
      })
      return
    }
    setPublishingLocale(target)
    try {
      const { snapshot } = await publishPage(id, target as Locale)
      toast.success(`Published ${LOCALE_LABEL[target]}`, {
        description: `/${snapshot.slug} · v${snapshot.version}`,
      })
      // Refresh authoritative per-locale status (version, published_at, drift).
      await load()
    } catch (e: any) {
      toast.error("Publish failed", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishingLocale(null)
    }
  }

  /* -------- preview -------- */

  const [previewing, setPreviewing] = useState(false)

  const openPreview = async () => {
    setPreviewing(true)
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then redirect it to the signed preview URL once the token is minted.
    const win = window.open("about:blank", "_blank")
    if (win) {
      win.opener = null
    }
    try {
      const { url } = await mintPreviewToken(id, locale as Locale)
      if (win) {
        win.location.href = url
      } else {
        // Popup was blocked despite the sync open — fall back to a direct open.
        window.open(url, "_blank", "noopener,noreferrer")
      }
    } catch (e: any) {
      if (win) {
        win.close()
      }
      toast.error("Could not open preview", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPreviewing(false)
    }
  }

  /* -------- schedule publish -------- */

  const [scheduling, setScheduling] = useState(false)

  const schedule = async (when: Date) => {
    setScheduling(true)
    try {
      await schedulePublish(id, when.toISOString())
      toast.success("Publish scheduled", {
        description: `${LOCALE_LABEL[page!.default_locale as EditorLocale] ?? page!.default_locale} · ${formatDateTime(when.toISOString())}`,
      })
      await load()
    } catch (e: any) {
      toast.error("Could not schedule publish", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setScheduling(false)
    }
  }

  const cancelSchedule = async () => {
    setScheduling(true)
    try {
      await cancelSchedulePublish(id)
      toast.success("Schedule cancelled")
      await load()
    } catch (e: any) {
      toast.error("Could not cancel schedule", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setScheduling(false)
    }
  }

  /* -------- page delete -------- */

  const removePage = async () => {
    if (!page) return
    const ok = await dialog({
      title: "Delete page",
      description: `"${page.title}" will be removed. Published snapshots are kept for history.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deletePage(id)
      toast.success("Page deleted")
      navigate("/cms/pages")
    } catch (e: any) {
      toast.error("Could not delete page", { description: e?.message })
    }
  }

  /* ----------------------------------------------------------------- */

  if (loading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading page…</Text>
        </div>
      </Container>
    )
  }

  if (!page) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text className="text-ui-fg-subtle">Page not found.</Text>
          <Button size="small" variant="secondary" onClick={() => navigate("/cms/pages")}>
            <ArrowLeft />
            Back to pages
          </Button>
        </div>
      </Container>
    )
  }

  const badge = STATUS_BADGE[page.status]

  // A locale's draft has changes worth republishing when the server says so, or
  // (optimistically, between an edit and the next reload) when an edit happened
  // after it was last published. Before the first publish, "not published"
  // already carries the call-to-action, so optimistic drift is ignored there.
  const localeHasChanges = (l: EditorLocale): boolean => {
    const st = localeStatus?.[l]
    if (!st) return false
    return st.has_unpublished_changes || (st.published && !!optimisticDirty[l])
  }
  const dirty = localeHasChanges(locale)
  const enLive = !!localeStatus?.en.published

  return (
    <Container className="p-0">
      {/* Top bar */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
        <button
          type="button"
          onClick={() => navigate("/cms/pages")}
          className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ArrowLeft />
          <Text size="small">Pages</Text>
        </button>

        <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-y-1">
            <div className="flex items-center gap-x-2">
              <Heading level="h2" className="truncate">
                {page.title}
              </Heading>
              {page.is_home && (
                <Badge size="2xsmall" color="blue">
                  Home
                </Badge>
              )}
              <Badge size="2xsmall" color={badge.color}>
                {badge.label}
              </Badge>
              {dirty && (
                <Badge size="2xsmall" color="orange">
                  Unpublished changes
                </Badge>
              )}
            </div>
            <Text size="small" className="font-mono text-ui-fg-subtle">
              /{page.slug}
            </Text>
          </div>

          <div className="flex items-center gap-x-3">
            <LocaleSwitcher locale={locale} onChange={setLocale} />
            <Tooltip
              content={`Open a live draft preview of ${LOCALE_LABEL[locale]} in a new tab`}
            >
              <Button
                size="small"
                variant="secondary"
                onClick={openPreview}
                isLoading={previewing}
              >
                <Eye />
                Preview
              </Button>
            </Tooltip>
            <Tooltip content={`Revision history for ${LOCALE_LABEL[locale]}`}>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setHistoryOpen(true)}
              >
                <Clock />
                History
              </Button>
            </Tooltip>
            <Button size="small" variant="secondary" onClick={() => setSettingsOpen(true)}>
              <CogSixTooth />
              Settings
            </Button>
          </div>
        </div>

        {locale === "bn" && (
          <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-2.5">
            <Text size="small" className="text-ui-fg-subtle">
              Editing Bengali (বাংলা) overrides. Structure, images and links are
              shared across locales — only translatable text is editable here.
              Publish English before Bengali.
            </Text>
          </div>
        )}

        {/* Per-locale publish controls + live status */}
        <PublishControls
          localeStatus={localeStatus}
          activeLocale={locale}
          publishingLocale={publishingLocale}
          hasChanges={localeHasChanges}
          enLive={enLive}
          onPublish={publish}
        />

        {/* Scheduled publish */}
        <SchedulePanel
          scheduledAt={page.scheduled_at}
          defaultLocale={page.default_locale}
          busy={scheduling}
          onSchedule={schedule}
          onCancel={cancelSchedule}
        />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-y-4 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Heading level="h3">Sections</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Blocks render top-to-bottom in this order.
            </Text>
          </div>
          <AddSectionMenu onAdd={add} />
        </div>

        {page.sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
              <DocumentText />
            </div>
            <Text weight="plus">No sections yet</Text>
            <Text size="small" className="text-ui-fg-subtle">
              Add a content block to start building this page.
            </Text>
            <AddSectionMenu onAdd={add} />
          </div>
        ) : (
          <div className="flex flex-col gap-y-2">
            {page.sections.map((section, i) => (
              <SectionRow
                key={section.id}
                section={section}
                index={i}
                total={page.sections.length}
                busy={busyRow === section.id}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onToggle={(v) => toggleEnabled(section, v)}
                onEdit={() => setEditingSection(section)}
                onDelete={() => removeSection(section)}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end border-t border-ui-border-base pt-4">
          <Button
            size="small"
            variant="transparent"
            className="text-ui-fg-error"
            onClick={removePage}
          >
            <Trash />
            Delete page
          </Button>
        </div>
      </div>

      {/* Section editor drawer */}
      {editingSection && (
        <SectionDrawer
          key={editingSection.id + locale}
          section={editingSection}
          locale={locale}
          onClose={() => setEditingSection(null)}
          onSaved={async () => {
            setEditingSection(null)
            markDirty()
            await load()
          }}
        />
      )}

      {/* Page settings drawer */}
      {settingsOpen && (
        <PageSettingsDrawer
          page={page}
          locale={locale}
          onClose={() => setSettingsOpen(false)}
          onSaved={async () => {
            setSettingsOpen(false)
            markDirty()
            await load()
          }}
        />
      )}

      {/* Revision history drawer */}
      {historyOpen && (
        <RevisionHistoryDrawer
          pageId={id}
          locale={locale}
          onClose={() => setHistoryOpen(false)}
          onRestored={async () => {
            // The restored version is now live — reconcile per-locale status.
            await load()
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Locale switcher                                                     */
/* ------------------------------------------------------------------ */

function LocaleSwitcher({
  locale,
  onChange,
}: {
  locale: EditorLocale
  onChange: (l: EditorLocale) => void
}) {
  return (
    <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
      {LOCALES.map((l) => (
        <Button
          key={l}
          size="small"
          variant={locale === l ? "primary" : "transparent"}
          onClick={() => onChange(l)}
          aria-label={`Edit ${LOCALE_LABEL[l]} content`}
        >
          {LOCALE_LABEL[l]}
        </Button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Publish controls (per-locale status + publish buttons)              */
/* ------------------------------------------------------------------ */

function PublishControls({
  localeStatus,
  activeLocale,
  publishingLocale,
  hasChanges,
  enLive,
  onPublish,
}: {
  localeStatus: LocaleStatusMap | null
  activeLocale: EditorLocale
  publishingLocale: EditorLocale | null
  hasChanges: (l: EditorLocale) => boolean
  enLive: boolean
  onPublish: (l: EditorLocale) => void
}) {
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:gap-x-5">
        {LOCALES.map((l) => (
          <LocaleStatusBadge
            key={l}
            locale={l}
            status={localeStatus?.[l] ?? null}
            changed={hasChanges(l)}
            active={l === activeLocale}
          />
        ))}
      </div>
      <div className="flex items-center gap-x-2">
        {LOCALES.map((l) => {
          const blocked = l === "bn" && !enLive
          const btn = (
            <Button
              key={l}
              size="small"
              variant={l === "en" ? "primary" : "secondary"}
              onClick={() => onPublish(l)}
              isLoading={publishingLocale === l}
              disabled={blocked || (!!publishingLocale && publishingLocale !== l)}
            >
              <RocketLaunch />
              Publish {LOCALE_LABEL[l]}
            </Button>
          )
          return blocked ? (
            <Tooltip
              key={l}
              content="Publish English first — Bengali is published as overrides on top of the English snapshot."
            >
              {/* Tooltip needs a focusable wrapper around the disabled button. */}
              <span tabIndex={0}>{btn}</span>
            </Tooltip>
          ) : (
            btn
          )
        })}
      </div>
    </div>
  )
}

function LocaleStatusBadge({
  locale,
  status,
  changed,
  active,
}: {
  locale: EditorLocale
  status: LocaleStatusMap[EditorLocale] | null
  changed: boolean
  active: boolean
}) {
  // Resolve the colored pill + caption for one locale's publish state.
  let color: "green" | "orange" | "grey" = "grey"
  let pill = "Not published"
  if (status?.published) {
    if (changed) {
      color = "orange"
      pill = `Live v${status.version} · draft changes`
    } else {
      color = "green"
      pill = `Live v${status.version}`
    }
  } else if (changed) {
    // Never published but the (en) draft already differs from nothing — still
    // surfaced as a draft state so the editor knows there is content to ship.
    pill = "Draft"
  }

  return (
    <div className="flex items-center gap-x-2">
      <Text
        size="xsmall"
        weight="plus"
        className={clx(active ? "text-ui-fg-base" : "text-ui-fg-subtle")}
      >
        {LOCALE_LABEL[locale]}
      </Text>
      <Badge size="2xsmall" color={color}>
        {pill}
      </Badge>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scheduled publish panel                                             */
/* ------------------------------------------------------------------ */

function SchedulePanel({
  scheduledAt,
  defaultLocale,
  busy,
  onSchedule,
  onCancel,
}: {
  scheduledAt: string | null
  defaultLocale: string
  busy: boolean
  onSchedule: (when: Date) => void
  onCancel: () => void
}) {
  const [when, setWhen] = useState<Date | null>(null)

  // Publish runs against the page's default locale (the scheduled job ignores
  // the active editor locale), so name it explicitly to avoid surprises.
  const localeName =
    LOCALE_LABEL[defaultLocale as EditorLocale] ?? defaultLocale

  const isScheduled = !!scheduledAt
  const future = !!when && when.getTime() > Date.now()

  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
      <div className="flex items-center gap-x-2">
        <Clock className="text-ui-fg-subtle" />
        <Text size="small" weight="plus">
          Scheduled publish
        </Text>
        {isScheduled && (
          <Badge size="2xsmall" color="orange">
            Scheduled
          </Badge>
        )}
      </div>

      {isScheduled ? (
        <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:justify-between">
          <Text size="small" className="text-ui-fg-subtle">
            Publishes {localeName} on{" "}
            <span className="text-ui-fg-base">
              {formatDateTime(scheduledAt!)}
            </span>
            . Editing the page before then will be included in the scheduled
            publish.
          </Text>
          <Button
            size="small"
            variant="secondary"
            onClick={onCancel}
            isLoading={busy}
          >
            <XMarkMini />
            Cancel schedule
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">
            Pick a future date and time to automatically publish {localeName}.
          </Text>
          <div className="flex flex-col gap-x-2 gap-y-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <DatePicker
                granularity="minute"
                value={when}
                onChange={setWhen}
                minValue={new Date()}
                shouldCloseOnSelect={false}
                aria-label="Scheduled publish date and time"
              />
            </div>
            <Button
              size="small"
              onClick={() => when && onSchedule(when)}
              isLoading={busy}
              disabled={!future}
            >
              <Clock />
              Schedule
            </Button>
          </div>
          {when && !future && (
            <Text size="xsmall" className="text-ui-fg-error">
              Choose a time in the future.
            </Text>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add section palette                                                 */
/* ------------------------------------------------------------------ */

function AddSectionMenu({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size="small" variant="secondary">
          <Plus />
          Add section
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {ADD_SECTION_PALETTE.map((entry) => (
          <DropdownMenu.Item
            key={entry.type}
            onClick={() => onAdd(entry.type)}
            className="flex flex-col items-start gap-y-0.5"
          >
            <span className="font-medium">{entry.label}</span>
            {entry.description && (
              <span className="text-ui-fg-subtle text-xs">{entry.description}</span>
            )}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Section row                                                         */
/* ------------------------------------------------------------------ */

function SectionRow({
  section,
  index,
  total,
  busy,
  onMoveUp,
  onMoveDown,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: CmsSection
  index: number
  total: number
  busy: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: (v: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const entry = getBlockEditor(section.type)
  const title = section.label || entry?.label || section.type
  const editable = !!entry

  return (
    <div
      className={clx(
        "flex items-center gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2.5 transition-opacity",
        !section.enabled && "opacity-60"
      )}
    >
      {/* Reorder arrows */}
      <div className="flex flex-col">
        <IconButton
          size="2xsmall"
          variant="transparent"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <ArrowUpMini />
        </IconButton>
        <IconButton
          size="2xsmall"
          variant="transparent"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <ArrowDownMini />
        </IconButton>
      </div>

      {/* Identity */}
      <button
        type="button"
        onClick={editable ? onEdit : undefined}
        disabled={!editable}
        className={clx(
          "flex min-w-0 flex-1 items-center gap-x-3 text-left",
          editable && "cursor-pointer"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
          <DocumentText />
        </div>
        <div className="flex min-w-0 flex-col">
          <Text size="small" weight="plus" className="truncate">
            {title}
          </Text>
          <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
            {section.type}
            {!editable && " · no editor (Phase 4)"}
          </Text>
        </div>
      </button>

      {/* Controls */}
      <div className="flex items-center gap-x-2">
        {!section.enabled && (
          <Badge size="2xsmall" color="grey">
            Hidden
          </Badge>
        )}
        <Tooltip content={section.enabled ? "Enabled" : "Disabled"}>
          <Switch
            checked={section.enabled}
            disabled={busy}
            onCheckedChange={onToggle}
          />
        </Tooltip>

        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent" aria-label="Section actions">
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={onEdit} disabled={!editable}>
              <PencilSquare className="text-ui-fg-subtle" />
              Edit content
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={onDelete} className="text-ui-fg-error">
              <Trash className="text-ui-fg-error" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section editor drawer                                               */
/* ------------------------------------------------------------------ */

function SectionDrawer({
  section,
  locale,
  onClose,
  onSaved,
}: {
  section: CmsSection
  locale: EditorLocale
  onClose: () => void
  onSaved: () => void
}) {
  const entry = getBlockEditor(section.type)

  // The editor works on the full data object for the active locale:
  //  - en : the section's en payload (section.data)
  //  - bn : the existing bn override if any, else a clone of the en payload so the
  //         editor can show the (read-only) structure/images and the override
  //         carries every locale-invariant field (translation arrays replace
  //         wholesale, so the override must be a complete object).
  const [value, setValue] = useState<Record<string, any>>(() => {
    if (locale === "en") return { ...(section.data ?? {}) }
    const override = sectionTranslationData(section, locale)
    return Object.keys(override).length
      ? override
      : JSON.parse(JSON.stringify(section.data ?? {}))
  })
  const [label, setLabel] = useState(section.label ?? "")
  const [enabled, setEnabled] = useState(section.enabled)
  const [saving, setSaving] = useState(false)

  const Editor = entry?.Editor

  const save = async () => {
    setSaving(true)
    try {
      if (locale === "en") {
        await updateSection(section.id, {
          data: value,
          label: label.trim() || null,
          enabled,
        })
      } else {
        // Full per-locale override (arrays replace wholesale at publish-merge).
        await updateSection(section.id, {
          translations: { [locale]: value },
        })
      }
      toast.success("Section saved")
      onSaved()
    } catch (e: any) {
      toast.error("Could not save section", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-2xl">
        <Drawer.Header>
          <Drawer.Title>
            {entry?.label ?? section.type}
            {locale === "bn" && " · Bengali"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {locale === "en" && (
            <div className="flex flex-col gap-y-4 border-b border-ui-border-base pb-6">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Internal label
                </Label>
                <Input
                  value={label}
                  placeholder={entry?.label ?? section.type}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Admin-only name to tell sections apart. Not shown on the storefront.
                </Text>
              </div>
              <div className="flex items-start justify-between gap-x-4 rounded-lg border border-ui-border-base px-4 py-3">
                <div className="flex flex-col">
                  <Label size="small" weight="plus">
                    Enabled
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Disabled sections are excluded from the published page.
                  </Text>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          )}

          {Editor ? (
            <Editor value={value} onChange={setValue} locale={locale} />
          ) : (
            <div className="rounded-lg border border-dashed border-ui-border-strong px-4 py-8 text-center">
              <Text size="small" className="text-ui-fg-subtle">
                No editor is available for the “{section.type}” block yet. It will be
                published as-is and rendered when its block ships in a later phase.
              </Text>
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={save} isLoading={saving} disabled={!Editor && locale === "bn"}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
/* Page settings drawer                                                */
/* ------------------------------------------------------------------ */

function PageSettingsDrawer({
  page,
  locale,
  onClose,
  onSaved,
}: {
  page: CmsPageFull
  locale: EditorLocale
  onClose: () => void
  onSaved: () => void
}) {
  const bnTranslation = page.translations?.find((t) => t.locale === "bn")

  // EN scalar fields.
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [status, setStatus] = useState<PageStatus>(page.status)
  const [isHome, setIsHome] = useState(page.is_home)
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "")
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "")

  // BN overrides.
  const [bnTitle, setBnTitle] = useState(bnTranslation?.title ?? "")
  const [bnSeoTitle, setBnSeoTitle] = useState(bnTranslation?.seo_title ?? "")
  const [bnSeoDescription, setBnSeoDescription] = useState(
    bnTranslation?.seo_description ?? ""
  )

  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const body: PageScalarInput =
        locale === "en"
          ? {
              title: title.trim(),
              slug: slug.trim(),
              status,
              is_home: isHome,
              seo_title: seoTitle.trim() || null,
              seo_description: seoDescription.trim() || null,
            }
          : {
              translations: {
                bn: {
                  title: bnTitle.trim() || null,
                  seo_title: bnSeoTitle.trim() || null,
                  seo_description: bnSeoDescription.trim() || null,
                },
              },
            }
      await updatePage(page.id, body)
      toast.success("Page settings saved")
      onSaved()
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            Page settings{locale === "bn" && " · Bengali"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          {locale === "en" ? (
            <>
              <Labeled label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Labeled>
              <Labeled label="Slug" hint="Storefront route. Must be unique.">
                <Input
                  value={slug}
                  className="font-mono"
                  onChange={(e) => setSlug(e.target.value)}
                />
              </Labeled>
              <Labeled label="Status">
                <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
                  {(["draft", "active", "archived"] as const).map((s) => (
                    <Button
                      key={s}
                      size="small"
                      variant={status === s ? "primary" : "transparent"}
                      onClick={() => setStatus(s)}
                    >
                      {STATUS_BADGE[s].label}
                    </Button>
                  ))}
                </div>
              </Labeled>
              <div className="flex items-start justify-between gap-x-4 rounded-lg border border-ui-border-base px-4 py-3">
                <div className="flex flex-col">
                  <Label size="small" weight="plus">
                    Home page
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Render at the storefront root.
                  </Text>
                </div>
                <Switch checked={isHome} onCheckedChange={setIsHome} />
              </div>
              <div className="flex flex-col gap-y-4 border-t border-ui-border-base pt-5">
                <Heading level="h3">SEO</Heading>
                <Labeled label="SEO title">
                  <Input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                  />
                </Labeled>
                <Labeled label="SEO description">
                  <Textarea
                    value={seoDescription}
                    rows={3}
                    onChange={(e) => setSeoDescription(e.target.value)}
                  />
                </Labeled>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-2.5">
                <Text size="small" className="text-ui-fg-subtle">
                  Bengali overrides. Leave a field empty to fall back to English.
                  Slug, status and home are shared across locales (edit on the EN tab).
                </Text>
              </div>
              <Labeled label="Title · BN">
                <Input
                  value={bnTitle}
                  placeholder={page.title}
                  onChange={(e) => setBnTitle(e.target.value)}
                />
              </Labeled>
              <Labeled label="SEO title · BN">
                <Input
                  value={bnSeoTitle}
                  placeholder={page.seo_title ?? ""}
                  onChange={(e) => setBnSeoTitle(e.target.value)}
                />
              </Labeled>
              <Labeled label="SEO description · BN">
                <Textarea
                  value={bnSeoDescription}
                  rows={3}
                  placeholder={page.seo_description ?? ""}
                  onChange={(e) => setBnSeoDescription(e.target.value)}
                />
              </Labeled>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={save} isLoading={saving}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Revision history drawer                                             */
/* ------------------------------------------------------------------ */

type HistoryTab = "summary" | "json" | "diff"

/** Short, human-ish label for a `published_by` admin user id (or "system"). */
function authorLabel(publishedBy: string | null): string {
  if (!publishedBy) return "System"
  // User ids are long (user_01J…) — show a recognisable tail.
  return publishedBy.length > 14 ? `…${publishedBy.slice(-8)}` : publishedBy
}

function RevisionHistoryDrawer({
  pageId,
  locale,
  onClose,
  onRestored,
}: {
  pageId: string
  locale: EditorLocale
  onClose: () => void
  onRestored: () => Promise<void> | void
}) {
  const dialog = usePrompt()

  const [revisions, setRevisions] = useState<CmsRevisionRow[] | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [selectedSnap, setSelectedSnap] = useState<CmsRevisionFull | null>(null)
  const [liveSnap, setLiveSnap] = useState<CmsRevisionFull | null>(null)
  const [loadingSnap, setLoadingSnap] = useState(false)

  const [tab, setTab] = useState<HistoryTab>("summary")
  const [restoring, setRestoring] = useState(false)

  const liveVersion = revisions?.find((r) => r.is_live)?.version ?? null

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const { revisions } = await listRevisions(pageId, locale as Locale)
      setRevisions(revisions)
      // Default selection: the live version (or the newest one).
      const live = revisions.find((r) => r.is_live)
      const initial = live?.version ?? revisions[0]?.version ?? null
      setSelectedVersion(initial)
    } catch (e: any) {
      toast.error("Could not load history", {
        description: e?.message ?? "Unexpected error.",
      })
      setRevisions([])
    } finally {
      setLoadingList(false)
    }
  }, [pageId, locale])

  // (Re)load the list whenever the drawer's locale changes.
  useEffect(() => {
    loadList()
  }, [loadList])

  // Fetch the full live snapshot once per (locale, liveVersion) — it is the
  // baseline for the diff view.
  useEffect(() => {
    let cancelled = false
    if (liveVersion == null) {
      setLiveSnap(null)
      return
    }
    if (liveSnap?.version === liveVersion && liveSnap?.locale === locale) {
      return
    }
    getRevision(pageId, liveVersion, locale as Locale)
      .then(({ revision }) => {
        if (!cancelled) setLiveSnap(revision)
      })
      .catch(() => {
        if (!cancelled) setLiveSnap(null)
      })
    return () => {
      cancelled = true
    }
  }, [pageId, locale, liveVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the selected version's full snapshot.
  useEffect(() => {
    let cancelled = false
    if (selectedVersion == null) {
      setSelectedSnap(null)
      return
    }
    setLoadingSnap(true)
    getRevision(pageId, selectedVersion, locale as Locale)
      .then(({ revision }) => {
        if (!cancelled) setSelectedSnap(revision)
      })
      .catch((e: any) => {
        if (!cancelled) {
          setSelectedSnap(null)
          toast.error("Could not load revision", {
            description: e?.message ?? "Unexpected error.",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSnap(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageId, locale, selectedVersion])

  const isSelectedLive = selectedVersion != null && selectedVersion === liveVersion

  const restore = async () => {
    if (selectedVersion == null || isSelectedLive) return
    const ok = await dialog({
      title: `Restore v${selectedVersion}?`,
      description:
        `This republishes the content of v${selectedVersion} as a new live ` +
        `version for ${LOCALE_LABEL[locale]}. History is append-only — the ` +
        `current live version is kept below it and nothing is overwritten. ` +
        `Your unpublished draft edits are not affected.`,
      confirmText: "Restore this version",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    setRestoring(true)
    try {
      const { snapshot, from_version } = await restoreRevision(
        pageId,
        selectedVersion,
        locale as Locale
      )
      toast.success(`Restored v${from_version}`, {
        description: `${LOCALE_LABEL[locale]} is now live at v${snapshot.version}.`,
      })
      await loadList()
      setSelectedVersion(snapshot.version)
      await onRestored()
    } catch (e: any) {
      toast.error("Restore failed", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-4xl">
        <Drawer.Header>
          <Drawer.Title>
            Revision history · {LOCALE_LABEL[locale]}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex min-h-0 flex-1 gap-x-4 overflow-hidden p-0">
          {/* Version list */}
          <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-ui-border-base">
            {loadingList ? (
              <div className="px-4 py-6">
                <Text size="small" className="text-ui-fg-subtle">
                  Loading history…
                </Text>
              </div>
            ) : !revisions || revisions.length === 0 ? (
              <div className="px-4 py-6">
                <Text size="small" className="text-ui-fg-subtle">
                  No published versions yet for {LOCALE_LABEL[locale]}.
                </Text>
              </div>
            ) : (
              <ul className="flex flex-col">
                {revisions.map((rev) => (
                  <li key={rev.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedVersion(rev.version)}
                      className={clx(
                        "flex w-full flex-col gap-y-1 border-b border-ui-border-base px-4 py-3 text-left transition-colors hover:bg-ui-bg-base-hover",
                        rev.version === selectedVersion && "bg-ui-bg-base-pressed"
                      )}
                    >
                      <div className="flex items-center gap-x-2">
                        <Text size="small" weight="plus">
                          v{rev.version}
                        </Text>
                        {rev.is_live && (
                          <Badge size="2xsmall" color="green">
                            Live
                          </Badge>
                        )}
                      </div>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {rev.published_at
                          ? formatDateTime(rev.published_at)
                          : "—"}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        by {authorLabel(rev.published_by)}
                      </Text>
                      {rev.note && (
                        <Text
                          size="xsmall"
                          className="truncate italic text-ui-fg-muted"
                        >
                          {rev.note}
                        </Text>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail pane */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5 py-4">
            {selectedVersion == null ? (
              <Text size="small" className="text-ui-fg-subtle">
                Select a version to inspect it.
              </Text>
            ) : (
              <>
                <div className="flex items-center justify-between gap-x-3">
                  <div className="flex items-center gap-x-2">
                    <Heading level="h3">v{selectedVersion}</Heading>
                    {isSelectedLive && (
                      <Badge size="2xsmall" color="green">
                        Live
                      </Badge>
                    )}
                  </div>
                  <Tooltip
                    content={
                      isSelectedLive
                        ? "This version is already live."
                        : `Republish v${selectedVersion} as a new live version.`
                    }
                  >
                    <span tabIndex={0}>
                      <Button
                        size="small"
                        variant="primary"
                        onClick={restore}
                        isLoading={restoring}
                        disabled={isSelectedLive || loadingSnap}
                      >
                        <ArrowUturnLeft />
                        Restore this version
                      </Button>
                    </span>
                  </Tooltip>
                </div>

                {/* Tabs */}
                <div className="mt-4 flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
                  {(
                    [
                      ["summary", "Summary"],
                      ["diff", "Diff vs live"],
                      ["json", "JSON"],
                    ] as [HistoryTab, string][]
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="small"
                      variant={tab === key ? "primary" : "transparent"}
                      onClick={() => setTab(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="mt-4 flex min-h-0 flex-1 flex-col">
                  {loadingSnap || !selectedSnap ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      Loading revision…
                    </Text>
                  ) : tab === "summary" ? (
                    <RevisionSummary snap={selectedSnap} />
                  ) : tab === "json" ? (
                    <RevisionJson data={selectedSnap.data} />
                  ) : (
                    <RevisionDiff
                      live={liveSnap}
                      selected={selectedSnap}
                      isSelectedLive={isSelectedLive}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" size="small" onClick={() => loadList()}>
            <ArrowPath />
            Refresh
          </Button>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Close
            </Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/** Section type + the most descriptive label we can pull from a compiled block. */
function sectionTitle(section: CompiledSection, index: number): string {
  const candidate =
    (typeof section.label === "string" && section.label) ||
    (typeof section.heading === "string" && section.heading) ||
    (typeof section.title === "string" && section.title) ||
    ""
  return candidate ? `${section.block_type} · ${candidate}` : `#${index + 1} ${section.block_type}`
}

function RevisionSummary({ snap }: { snap: CmsRevisionFull }) {
  const data = snap.data ?? {}
  const sections = data.sections ?? []
  const seo = data.seo ?? {}
  return (
    <div className="flex flex-col gap-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" value={data.meta?.title} />
        <Field label="Slug" value={data.slug} mono />
        <Field label="Locale" value={data.resolved_locale ?? data.locale} />
        <Field
          label="Compiled"
          value={
            data.meta?.compiled_at
              ? formatDateTime(data.meta.compiled_at)
              : undefined
          }
        />
      </div>

      {(seo.title || seo.description) && (
        <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-4">
          <Text size="small" weight="plus">
            SEO
          </Text>
          <Field label="SEO title" value={seo.title} />
          <Field label="SEO description" value={seo.description} />
        </div>
      )}

      <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-4">
        <Text size="small" weight="plus">
          Sections ({sections.length})
        </Text>
        {sections.length === 0 ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            No sections in this snapshot.
          </Text>
        ) : (
          <ol className="flex flex-col gap-y-1.5">
            {sections.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-x-2 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-ui-bg-base text-ui-fg-subtle">
                  <Text size="xsmall">{i + 1}</Text>
                </div>
                <Text size="xsmall" className="truncate font-mono">
                  {sectionTitle(s, i)}
                </Text>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-y-0.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text
        size="small"
        className={clx("truncate", mono && "font-mono", !value && "text-ui-fg-muted")}
      >
        {value || "—"}
      </Text>
    </div>
  )
}

function RevisionJson({ data }: { data: CompiledPageData }) {
  return (
    <pre className="max-h-[60vh] overflow-auto rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 text-xs leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

type DiffRow = {
  index: number
  status: "same" | "changed" | "added" | "removed"
  liveType?: string
  selectedType?: string
}

/** Section-by-section diff of the selected snapshot against the live one. */
function diffSections(
  live: CompiledSection[],
  selected: CompiledSection[]
): DiffRow[] {
  const max = Math.max(live.length, selected.length)
  const rows: DiffRow[] = []
  for (let i = 0; i < max; i++) {
    const l = live[i]
    const s = selected[i]
    if (l && !s) {
      rows.push({ index: i, status: "removed", liveType: l.block_type })
    } else if (!l && s) {
      rows.push({ index: i, status: "added", selectedType: s.block_type })
    } else if (l && s) {
      const same = JSON.stringify(l) === JSON.stringify(s)
      rows.push({
        index: i,
        status: same ? "same" : "changed",
        liveType: l.block_type,
        selectedType: s.block_type,
      })
    }
  }
  return rows
}

const DIFF_BADGE: Record<
  DiffRow["status"],
  { label: string; color: "green" | "orange" | "red" | "grey" }
> = {
  same: { label: "Unchanged", color: "grey" },
  changed: { label: "Changed", color: "orange" },
  added: { label: "In this version", color: "green" },
  removed: { label: "Only in live", color: "red" },
}

function RevisionDiff({
  live,
  selected,
  isSelectedLive,
}: {
  live: CmsRevisionFull | null
  selected: CmsRevisionFull
  isSelectedLive: boolean
}) {
  if (isSelectedLive) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        This is the live version — nothing to compare.
      </Text>
    )
  }
  if (!live) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        No live version to compare against yet.
      </Text>
    )
  }

  const liveSections = live.data?.sections ?? []
  const selSections = selected.data?.sections ?? []
  const rows = diffSections(liveSections, selSections)
  const changedCount = rows.filter((r) => r.status !== "same").length

  const seoChanged =
    JSON.stringify(live.data?.seo ?? {}) !==
    JSON.stringify(selected.data?.seo ?? {})
  const titleChanged =
    (live.data?.meta?.title ?? "") !== (selected.data?.meta?.title ?? "")

  return (
    <div className="flex flex-col gap-y-4">
      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          Comparing <span className="text-ui-fg-base">v{selected.version}</span>{" "}
          against the live <span className="text-ui-fg-base">v{live.version}</span>.{" "}
          {changedCount === 0 && !seoChanged && !titleChanged
            ? "Identical content."
            : `${changedCount} section change${changedCount === 1 ? "" : "s"}` +
              (titleChanged ? ", title differs" : "") +
              (seoChanged ? ", SEO differs" : "") +
              "."}
        </Text>
      </div>

      {(titleChanged || seoChanged) && (
        <div className="flex flex-wrap gap-2">
          {titleChanged && (
            <Badge size="2xsmall" color="orange">
              Page title changed
            </Badge>
          )}
          {seoChanged && (
            <Badge size="2xsmall" color="orange">
              SEO changed
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-col gap-y-1.5">
        {rows.length === 0 ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Neither version has sections.
          </Text>
        ) : (
          rows.map((row) => {
            const badge = DIFF_BADGE[row.status]
            const type =
              row.selectedType ?? row.liveType ?? "section"
            return (
              <div
                key={row.index}
                className="flex items-center justify-between gap-x-2 rounded-md border border-ui-border-base px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-x-2">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    #{row.index + 1}
                  </Text>
                  <Text size="xsmall" className="truncate font-mono">
                    {type}
                  </Text>
                </div>
                <Badge size="2xsmall" color={badge.color}>
                  {badge.label}
                </Badge>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default PageEditor
