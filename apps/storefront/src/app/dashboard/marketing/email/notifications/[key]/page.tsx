"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getNotificationTemplate,
  saveNotificationTemplate,
  resetNotificationTemplate,
  testNotificationTemplate,
  type NotifTemplateDetail,
} from "@lib/merchant-admin/api"

export default function NotificationEditorPage() {
  const params = useParams<{ key: string }>()
  const key = params?.key as string
  const router = useRouter()
  const { token } = useMerchantAuth()

  const [tpl, setTpl] = useState<NotifTemplateDetail | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const load = () => {
    if (!token || !key) return
    setLoading(true)
    getNotificationTemplate(token, key)
      .then((t) => {
        setTpl(t)
        setSubject(t.subject)
        setBody(t.body)
        setEnabled(t.enabled)
      })
      .catch((e) => setMsg({ kind: "err", text: e instanceof Error ? e.message : "Failed to load" }))
      .finally(() => setLoading(false))
  }
  useEffect(load, [token, key])

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const insertToken = (t: string) => {
    const el = bodyRef.current
    const snippet = `{{${t}}}`
    if (!el) {
      setBody((b) => b + snippet)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + snippet + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + snippet.length
      el.setSelectionRange(pos, pos)
    })
  }

  const save = async () => {
    if (!token) return
    setBusy("save")
    try {
      await saveNotificationTemplate(token, key, { subject, body, enabled })
      flash("ok", "Saved.")
      load()
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    if (!token) return
    if (!confirm("Reset this email back to the default? Your edits will be lost.")) return
    setBusy("reset")
    try {
      await resetNotificationTemplate(token, key)
      flash("ok", "Reset to default.")
      load()
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Reset failed")
    } finally {
      setBusy(null)
    }
  }

  const sendTest = async () => {
    if (!token) return
    setBusy("test")
    try {
      const r = await testNotificationTemplate(token, key)
      flash("ok", r.suppressed ? "That address is unsubscribed." : `Test sent to ${r.to || "you"}.`)
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Test failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.push("/dashboard/marketing/email/notifications")}
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" /> Back to notifications
      </button>

      {msg && (
        <div
          className={`rounded-base border p-3 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {loading || !tpl ? (
        <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50">
          Loading…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-grey-90">{tpl.title}</h1>
              <p className="mt-0.5 text-sm text-grey-50">{tpl.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-grey-70">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              {enabled ? "On — customers receive this" : "Off — this email won't send"}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Editor */}
            <div className="space-y-4 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
              <div>
                <label className="mb-1 block text-sm font-medium text-grey-90">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-grey-90">Body</label>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="w-full rounded-base border border-grey-30 px-3 py-2 font-mono text-xs leading-relaxed text-grey-90 focus:border-grey-60 focus:outline-none"
                />
                <p className="mt-1 text-xs text-grey-50">
                  Your store's header, footer, and unsubscribe link are added automatically.
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-grey-40">
                  Insert a personalization tag
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.tokens.map((tk) => (
                    <button
                      key={tk.token}
                      onClick={() => insertToken(tk.token)}
                      title={`${tk.label} — e.g. ${tk.sample}`}
                      className="rounded-full border border-grey-20 bg-grey-10 px-2.5 py-1 text-xs text-grey-70 hover:bg-grey-20"
                    >
                      {tk.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-grey-10 pt-4">
                <button
                  onClick={save}
                  disabled={busy === "save"}
                  className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={sendTest}
                  disabled={busy === "test"}
                  className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
                >
                  {busy === "test" ? "Sending…" : "Send test to me"}
                </button>
                {tpl.customized && (
                  <button
                    onClick={reset}
                    disabled={busy === "reset"}
                    className="ml-auto rounded-base px-3 py-2 text-sm font-medium text-grey-50 hover:text-red-600 disabled:opacity-50"
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-grey-90">Preview</p>
                <span className="text-xs text-grey-40">saved version · sample data</span>
              </div>
              <div className="rounded-base border border-grey-10 bg-grey-10/40 px-3 py-2 text-sm text-grey-70">
                <span className="text-grey-40">Subject: </span>
                {tpl.previewSubject}
              </div>
              <iframe
                title="Email preview"
                srcDoc={tpl.previewHtml}
                className="h-[480px] w-full rounded-base border border-grey-10 bg-white"
              />
              <p className="text-xs text-grey-40">
                Preview updates after you Save.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
