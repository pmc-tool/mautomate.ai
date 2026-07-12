"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  ExclamationCircle,
  Plus,
  Swatch,
  Trash,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  ApiError,
  createBrandVoice,
  deleteBrandVoice,
  listBrandVoices,
  updateBrandVoice,
  type MarketingBrandVoice,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { TONE_OPTIONS, toList } from "../agents/agent-utils"

/**
 * Brand voice — the rules every generated post is written under.
 *
 * A voice is a tone, a list of things to do, a list of things never to do, and
 * a sample of copy that sounds right. Agents (and the post composer) apply the
 * voice they are bound to; the default voice is applied when nothing else is
 * chosen.
 */

/** `tone` is a json column: a row may hold a string or a list. Read both. */
function toneText(voice: MarketingBrandVoice): string {
  if (Array.isArray(voice.tone)) return voice.tone.join(", ")
  return voice.tone ?? ""
}

type VoiceDraft = {
  name: string
  tone: string
  doRules: string
  dontRules: string
  sampleCopy: string
  isDefault: boolean
}

function emptyDraft(): VoiceDraft {
  return {
    name: "",
    tone: "",
    doRules: "",
    dontRules: "",
    sampleCopy: "",
    isDefault: false,
  }
}

function toDraft(voice: MarketingBrandVoice): VoiceDraft {
  return {
    name: voice.name,
    tone: toneText(voice),
    doRules: (voice.do_rules ?? []).join("\n"),
    dontRules: (voice.dont_rules ?? []).join("\n"),
    sampleCopy: voice.sample_copy ?? "",
    isDefault: voice.is_default,
  }
}

export default function BrandVoicePage() {
  const { token } = useMerchantAuth()

  const [voices, setVoices] = useState<MarketingBrandVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<MarketingBrandVoice | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<VoiceDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<MarketingBrandVoice | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    listBrandVoices(token, { limit: 100 })
      .then((res) => {
        setVoices(res.brand_voices ?? [])
        setError(null)
      })
      .catch((e) =>
        setError(
          e instanceof ApiError ? e.message : "Could not load your brand voices."
        )
      )
      .finally(() => setLoading(false))
  }, [token])

  useEffect(load, [load])

  const openCreate = () => {
    setDraft(emptyDraft())
    setEditing(null)
    setCreating(true)
  }

  const openEdit = (voice: MarketingBrandVoice) => {
    setDraft(toDraft(voice))
    setCreating(false)
    setEditing(voice)
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
  }

  const formOpen = creating || !!editing

  const save = async () => {
    if (!token) return
    if (!draft.name.trim()) {
      setError("Give the brand voice a name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: draft.name.trim(),
        tone: draft.tone.trim() || null,
        do_rules: toList(draft.doRules, "line"),
        dont_rules: toList(draft.dontRules, "line"),
        sample_copy: draft.sampleCopy.trim() || null,
        is_default: draft.isDefault,
      }

      if (editing) {
        await updateBrandVoice(token, editing.id, body)
      } else {
        await createBrandVoice(token, body)
      }
      closeForm()
      // Setting a default clears it on every other row: reload rather than patch.
      load()
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save the brand voice."
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!token || !confirmDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteBrandVoice(token, confirmDelete.id)
      setVoices((prev) => prev.filter((v) => v.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not delete the brand voice."
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand voice"
        description="The rules your AI writes under: the tone to hit, what it must always do, and what it must never do. Agents and the post composer apply them to every post."
        action={
          <button
            type="button"
            onClick={openCreate}
            disabled={!token}
            className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New brand voice
          </button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50 shadow-borders-base">
          Loading brand voices...
        </div>
      ) : voices.length === 0 ? (
        <div className="rounded-large border border-grey-20 bg-white p-6 shadow-borders-base">
          <EmptyState
            icon={Swatch}
            title="No brand voice yet"
            description="Write down how your brand sounds once, and every agent and every generated post will follow it. Mark one as the default and it is applied whenever nothing else is chosen."
            action={
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
              >
                <Plus className="h-4 w-4" />
                Create your first brand voice
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className="flex flex-col rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grey-10 text-grey-70">
                  <Swatch className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(voice)}
                      className="truncate text-sm font-semibold text-grey-90 hover:underline"
                    >
                      {voice.name}
                    </button>
                    {voice.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        <Check className="h-3 w-3" />
                        Default
                      </span>
                    )}
                    {toneText(voice) && (
                      <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                        {toneText(voice)}
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="font-medium text-grey-70">Always</dt>
                      <dd className="text-grey-50">
                        {voice.do_rules?.length
                          ? voice.do_rules.join(" — ")
                          : "No rules yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-grey-70">Never</dt>
                      <dd className="text-grey-50">
                        {voice.dont_rules?.length
                          ? voice.dont_rules.join(" — ")
                          : "No rules yet"}
                      </dd>
                    </div>
                  </dl>

                  {voice.sample_copy && (
                    <p className="mt-3 line-clamp-3 rounded-base bg-grey-10 p-3 text-xs italic text-grey-60">
                      {voice.sample_copy}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-grey-20 pt-4">
                <button
                  type="button"
                  onClick={() => openEdit(voice)}
                  className="rounded-base border border-grey-30 px-3 py-1.5 text-xs font-medium text-grey-90 transition-colors hover:bg-grey-10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(voice)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-base px-2 py-1.5 text-xs font-medium text-grey-50 transition-colors hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit brand voice" : "New brand voice"}
        description="Everything here is fed to the model before it writes a word."
      >
        <div className="space-y-5">
          <FormField label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="House voice"
            />
          </FormField>

          <FormField label="Tone">
            <Select
              value={draft.tone}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
            >
              <option value="">No specific tone</option>
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Always do"
            hint="One rule per line."
          >
            <Textarea
              rows={4}
              value={draft.doRules}
              onChange={(e) => setDraft({ ...draft, doRules: e.target.value })}
              placeholder={"Lead with the customer benefit\nUse short sentences\nName the product once"}
            />
          </FormField>

          <FormField
            label="Never do"
            hint="One rule per line."
          >
            <Textarea
              rows={4}
              value={draft.dontRules}
              onChange={(e) => setDraft({ ...draft, dontRules: e.target.value })}
              placeholder={"No hype words like revolutionary\nNo discount claims we have not agreed\nNo emojis"}
            />
          </FormField>

          <FormField
            label="Sample copy"
            hint="A short piece that already sounds exactly right. The model matches it."
          >
            <Textarea
              rows={4}
              value={draft.sampleCopy}
              onChange={(e) => setDraft({ ...draft, sampleCopy: e.target.value })}
              placeholder="Every piece is thrown by hand and fired twice. The glaze pools where the light catches it."
            />
          </FormField>

          <div className="rounded-large border border-grey-20 p-4">
            <FormToggle
              checked={draft.isDefault}
              onChange={(v) => setDraft({ ...draft, isDefault: v })}
              label="Use as the default voice"
              description="Applied whenever a post or an agent does not name a voice. Only one voice can be the default."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-base border border-grey-30 px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !draft.name.trim()}
              className={cn(
                "rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80",
                (saving || !draft.name.trim()) && "cursor-not-allowed opacity-50"
              )}
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Create brand voice"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this brand voice"
        description={`${confirmDelete?.name ?? "This voice"} is removed. Agents bound to it fall back to their own tone settings.`}
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            disabled={deleting}
            className="rounded-base border border-grey-30 px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete brand voice"}
          </button>
        </div>
      </Modal>
    </div>
  )
}
