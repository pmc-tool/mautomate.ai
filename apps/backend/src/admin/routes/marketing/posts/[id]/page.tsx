/**
 * Marketing — Post detail.
 *
 * The single-post screen at /marketing/posts/:id. Nested detail route, so it has
 * no `defineRouteConfig` and does not appear in the sidebar.
 *
 * Layout:
 *   - header    : status, channels, refresh + delete
 *   - content   : editable master copy with save + rework-with-AI
 *   - targets   : per-platform copy and publishing status
 *   - media     : attached image/video assets
 *   - revisions : history with restore
 *   - side rail : schedule + approve / reject / publish actions
 *
 * API: GET/POST/DELETE /admin/marketing/posts/:id (+ /rework /schedule /approve).
 * Everything degrades gracefully when the endpoint is missing or empty.
 */
import {
  ArrowLeft,
  ArrowPath,
  ArrowUturnLeft,
  Calendar,
  CheckCircle,
  ChatBubbleLeftRight,
  Clock,
  DocumentText,
  ExclamationCircle,
  Photo,
  Sparkles,
  Trash,
  XCircle,
} from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Text,
  Textarea,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PlatformChip } from "../../_components/PlatformChip"
import { StatusBadge } from "../../_components/StatusBadge"
import { BrandIcon, brandDef } from "../../_components/brand-icons"
import { usePolling } from "../../_components/usePolling"
import {
  approvePost,
  deletePost,
  formatDateTime,
  getPost,
  isoToLocalInput,
  localInputToISO,
  platformMeta,
  reworkPost,
  schedulePost,
  snippet,
  updatePost,
  type PostDetail,
  type PostRevision,
  type PostTarget,
} from "../../_components/lib"

const PostDetailPage = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const prompt = usePrompt()

  const [data, setData] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editors.
  const [content, setContent] = useState("")
  const [dirty, setDirty] = useState(false)
  const [reworkInstruction, setReworkInstruction] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const apply = useCallback((detail: PostDetail) => {
    setData(detail)
    setContent(detail.post.content ?? "")
    setScheduledAt(isoToLocalInput(detail.post.scheduled_at))
    setDirty(false)
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const detail = await getPost(id)
        // Do not clobber an unsaved edit during a silent poll.
        if (opts?.silent && dirty) {
          setData(detail)
        } else {
          apply(detail)
        }
      } catch (e: any) {
        if (!opts?.silent) setError(e?.message ?? "Unexpected error.")
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [id, apply, dirty]
  )

  useEffect(() => {
    load()
  }, [load])

  // Poll while a target is mid-publish so status chips settle on their own.
  const isPublishing = !!data?.targets?.some(
    (t) => t.status === "publishing" || t.status === "scheduled"
  )
  usePolling(() => load({ silent: true }), 6000, isPublishing)

  /* --------------------------------------------------------------- */
  /* Actions                                                          */
  /* --------------------------------------------------------------- */

  const run = async (
    key: string,
    fn: () => Promise<PostDetail | { deleted?: boolean }>,
    successMsg: string,
    opts?: { afterDelete?: boolean }
  ) => {
    setBusy(key)
    try {
      const res = await fn()
      toast.success(successMsg)
      if (opts?.afterDelete) {
        navigate("/marketing/posts")
        return
      }
      if (res && "post" in res) apply(res as PostDetail)
      else await load({ silent: true })
    } catch (e: any) {
      toast.error("Action failed", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusy(null)
    }
  }

  const handleSave = () =>
    run("save", () => updatePost(id, { content: content.trim() || null }), "Saved")

  const handleRework = () => {
    if (!reworkInstruction.trim()) {
      toast.error("Tell the AI what to change")
      return
    }
    return run(
      "rework",
      async () => {
        const d = await reworkPost(id, { instruction: reworkInstruction.trim() })
        setReworkInstruction("")
        return d
      },
      "Reworked with AI"
    )
  }

  const handleSchedule = () => {
    const iso = localInputToISO(scheduledAt)
    if (!iso) {
      toast.error("Pick a date and time")
      return
    }
    return run("schedule", () => schedulePost(id, { scheduled_at: iso }), "Scheduled")
  }

  const handleUnschedule = () =>
    run("unschedule", () => schedulePost(id, { scheduled_at: null }), "Unscheduled")

  const handleApprove = (action: string, msg: string) =>
    run(`approve-${action}`, () => approvePost(id, { action }), msg)

  const handleRestore = (rev: PostRevision) =>
    run(
      "restore",
      () => updatePost(id, { content: rev.content ?? "", restore_revision_id: rev.id }),
      "Revision restored"
    )

  const handleDelete = async () => {
    const ok = await prompt({
      title: "Delete post",
      description:
        "This permanently deletes the post and its per-platform drafts. This cannot be undone.",
      variant: "danger",
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!ok) return
    return run("delete", () => deletePost(id), "Post deleted", {
      afterDelete: true,
    })
  }

  /* --------------------------------------------------------------- */
  /* Loading / error                                                  */
  /* --------------------------------------------------------------- */

  if (loading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading post…</Text>
        </div>
      </Container>
    )
  }

  if (error || !data) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text className="text-ui-fg-error">{error ?? "Post not found."}</Text>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => navigate("/marketing/posts")}
            >
              <ArrowLeft />
              Back to Post Hub
            </Button>
            <Button size="small" variant="secondary" onClick={() => load()}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        </div>
      </Container>
    )
  }

  const { post, targets, media, revisions } = data
  const status = post.status
  const busyAny = !!busy

  return (
    <div className="flex flex-col gap-y-4">
      {/* Header */}
      <Container className="flex flex-col gap-y-4 p-0">
        <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/marketing/posts")}
            className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
          >
            <ArrowLeft />
            <Text size="small">Post Hub</Text>
          </button>

          <div className="flex flex-col gap-y-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-col gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Heading level="h2">Post</Heading>
                <StatusBadge status={status} />
                {(post.platforms ?? []).map((pl) => (
                  <PlatformChip key={pl} platform={pl} showLabel />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-fg-muted">
                <Text size="xsmall" className="font-mono">
                  {post.id}
                </Text>
                <Text size="xsmall">Created {formatDateTime(post.created_at)}</Text>
                {post.scheduled_at && (
                  <span className="flex items-center gap-x-1">
                    <Calendar />
                    <Text size="xsmall">
                      Scheduled {formatDateTime(post.scheduled_at)}
                    </Text>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-x-1">
              <Tooltip content="Refresh">
                <IconButton
                  size="small"
                  variant="transparent"
                  onClick={() => load()}
                >
                  <ArrowPath />
                </IconButton>
              </Tooltip>
              <Tooltip content="Delete post">
                <IconButton
                  size="small"
                  variant="transparent"
                  disabled={busyAny}
                  onClick={handleDelete}
                >
                  <Trash />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          {post.error && (
            <div className="flex items-start gap-x-2 rounded-lg border border-ui-border-error bg-ui-bg-subtle px-3 py-2 text-ui-fg-error">
              <ExclamationCircle />
              <Text size="small">{post.error}</Text>
            </div>
          )}
        </div>
      </Container>

      {/* Body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-y-4 lg:col-span-2">
          {/* Content editor */}
          <Section icon={<DocumentText />} title="Content">
            <Textarea
              value={content}
              rows={7}
              onChange={(e) => {
                setContent(e.target.value)
                setDirty(true)
              }}
            />
            <div className="flex items-center justify-between">
              <Text size="xsmall" className="text-ui-fg-muted">
                {content.length} characters
              </Text>
              <Button
                size="small"
                variant="secondary"
                disabled={!dirty || busyAny}
                isLoading={busy === "save"}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>

            {/* Rework with AI */}
            <div className="mt-2 flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <div className="flex items-center gap-x-2 text-ui-fg-interactive">
                <Sparkles />
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  Rework with AI
                </Text>
              </div>
              <Textarea
                value={reworkInstruction}
                rows={2}
                placeholder="e.g. Make it punchier and add a call to action."
                onChange={(e) => setReworkInstruction(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="small"
                  disabled={busyAny}
                  isLoading={busy === "rework"}
                  onClick={handleRework}
                >
                  <Sparkles />
                  Rework
                </Button>
              </div>
            </div>
          </Section>

          {/* Targets */}
          <Section
            icon={<ChatBubbleLeftRight />}
            title="Per-platform"
            action={
              <Text size="xsmall" className="text-ui-fg-muted">
                {targets?.length ?? 0} channels
              </Text>
            }
          >
            <TargetsList targets={targets ?? []} fallback={post.content} />
          </Section>

          {/* Media */}
          <Section icon={<Photo />} title="Media">
            {media?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="relative aspect-square overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle"
                  >
                    <img
                      src={m.url}
                      alt={m.alt ?? ""}
                      className="size-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                No media attached.
              </Text>
            )}
          </Section>
        </div>

        {/* Side rail */}
        <div className="flex flex-col gap-y-4 lg:col-span-1">
          {/* Approval / publish */}
          <Section icon={<CheckCircle />} title="Publish">
            <div className="flex flex-col gap-y-2">
              {status === "needs_approval" ? (
                <>
                  <Button
                    size="small"
                    disabled={busyAny}
                    isLoading={busy === "approve-approve"}
                    onClick={() => handleApprove("approve", "Approved")}
                  >
                    <CheckCircle />
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={busyAny}
                    isLoading={busy === "approve-reject"}
                    onClick={() => handleApprove("reject", "Rejected")}
                  >
                    <XCircle />
                    Reject
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="secondary"
                  disabled={busyAny}
                  isLoading={busy === "approve-submit"}
                  onClick={() => handleApprove("submit", "Submitted for approval")}
                >
                  Submit for approval
                </Button>
              )}
              <Button
                size="small"
                disabled={busyAny}
                isLoading={busy === "approve-publish"}
                onClick={() => handleApprove("publish", "Publishing now")}
              >
                Publish now
              </Button>
            </div>
          </Section>

          {/* Schedule */}
          <Section icon={<Clock />} title="Schedule">
            <div className="flex flex-col gap-y-2">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  className="flex-1"
                  disabled={busyAny}
                  isLoading={busy === "schedule"}
                  onClick={handleSchedule}
                >
                  <Calendar />
                  Schedule
                </Button>
                {post.scheduled_at && (
                  <Button
                    size="small"
                    variant="transparent"
                    disabled={busyAny}
                    isLoading={busy === "unschedule"}
                    onClick={handleUnschedule}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Section>

          {/* Revisions */}
          <Section icon={<ArrowUturnLeft />} title="Revisions">
            <RevisionList
              revisions={revisions ?? []}
              busy={busy === "restore"}
              disabled={busyAny}
              onRestore={handleRestore}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

function TargetsList({
  targets,
  fallback,
}: {
  targets: PostTarget[]
  fallback: string | null
}) {
  if (!targets.length) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        No per-platform variants yet.
      </Text>
    )
  }
  return (
    <div className="flex flex-col gap-y-3">
      {targets.map((t) => {
        const meta = platformMeta(t.platform)
        const body = t.content ?? fallback ?? ""
        const over = body.length > meta.charLimit
        return (
          <div
            key={t.id}
            className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-x-2">
              <div className="flex min-w-0 items-center gap-x-2">
                <BrandIcon platform={t.platform} size={24} />
                <Text size="small" weight="plus" className="truncate">
                  {brandDef(t.platform).label}
                </Text>
              </div>
              <div className="flex items-center gap-x-2">
                <StatusBadge status={t.status} variant="target" />
                {t.external_url && (
                  <a
                    href={t.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-fg-interactive hover:underline"
                  >
                    <Text size="xsmall">View</Text>
                  </a>
                )}
              </div>
            </div>
            <Text size="small" className="whitespace-pre-wrap">
              {t.content ? (
                snippet(t.content, 400)
              ) : (
                <span className="italic text-ui-fg-muted">
                  Uses master content
                </span>
              )}
            </Text>
            <div className="flex items-center gap-x-3">
              <Text
                size="xsmall"
                className={over ? "text-ui-fg-error" : "text-ui-fg-muted"}
              >
                {body.length}/{meta.charLimit}
              </Text>
              {t.scheduled_at && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {formatDateTime(t.scheduled_at)}
                </Text>
              )}
              {t.error && (
                <Text size="xsmall" className="text-ui-fg-error">
                  {t.error}
                </Text>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Revisions                                                           */
/* ------------------------------------------------------------------ */

function RevisionList({
  revisions,
  busy,
  disabled,
  onRestore,
}: {
  revisions: PostRevision[]
  busy: boolean
  disabled: boolean
  onRestore: (rev: PostRevision) => void
}) {
  if (!revisions.length) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        No revisions yet.
      </Text>
    )
  }
  return (
    <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
      {revisions.map((r) => (
        <div
          key={r.id}
          className="flex items-start justify-between gap-x-3 bg-ui-bg-base px-3 py-2"
        >
          <div className="flex min-w-0 flex-col gap-y-0.5">
            <Text size="xsmall" weight="plus">
              {r.label || r.author || "Revision"}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {formatDateTime(r.created_at)}
            </Text>
            {r.content && (
              <Text size="xsmall" className="line-clamp-2 text-ui-fg-subtle">
                {snippet(r.content, 90)}
              </Text>
            )}
          </div>
          <Button
            size="small"
            variant="transparent"
            disabled={disabled}
            isLoading={busy}
            onClick={() => onRestore(r)}
          >
            <ArrowUturnLeft />
          </Button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section shell                                                       */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Container className="flex flex-col gap-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <span className="text-ui-fg-subtle">{icon}</span>
          <Heading level="h3">{title}</Heading>
        </div>
        {action}
      </div>
      {children}
    </Container>
  )
}

export default PostDetailPage
