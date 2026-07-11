/**
 * Forever Finds CMS — shared admin editor primitives (Phase 1).
 *
 * One small toolkit reused by every "Site Management" settings editor
 * (Header / Topbar / Footer / Theme / SEO).
 *
 * LOCALIZATION CONTRACT (matches the backend settings exception):
 *   cms_setting.data is a TOP-LEVEL locale map { en: <FullFlat>, bn?: DeepPartial }.
 *   - `en` is always the complete object — it is what the structural editor edits.
 *   - `bn` is a SPARSE override of translatable SCALAR strings only.
 *   Phase 1 decision: the BN tab exposes ONLY localizable scalar text fields
 *   (announcement copy, labels, headings, seo title/description …). Structural
 *   arrays (menu, links, social) and non-text settings (toggles, colors, fonts,
 *   paths) are EN-only — this keeps the bn override genuinely sparse and avoids
 *   the "arrays are replaced wholesale on override" footgun. Anything missing
 *   from bn falls back to en at read time via deepMerge on the store API.
 *
 * This file is NOT a route (it lives under src/admin/components, which the admin
 * router does not scan) — it is import-only.
 */
import {
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import { useEffect, useState, type ReactNode } from "react"
import type { SettingDataMap, SettingKey } from "../../../modules/cms/types"

/* ------------------------------------------------------------------ */
/* Tiny immutable JSON helpers (settings are plain JSON)               */
/* ------------------------------------------------------------------ */

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

type Path = (string | number)[]

const getPath = (obj: any, path: Path): any =>
  path.reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)

/** Mutates a draft in place (used inside updateEn). */
const mutPath = (draft: any, path: Path, value: any): void => {
  let cur = draft
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {}
    cur = cur[k]
  }
  cur[path[path.length - 1]] = value
}

/** Returns a new object with `path` set, or the key removed when value is empty. */
const setPathImmutable = (obj: any, path: Path, value: any): any => {
  const d = clone(obj ?? {})
  let cur = d
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {}
    cur = cur[k]
  }
  const last = path[path.length - 1]
  if (value === undefined || value === "") delete cur[last]
  else cur[last] = value
  return d
}

/* ------------------------------------------------------------------ */
/* Editor state hook                                                   */
/* ------------------------------------------------------------------ */

export const SETTING_LABELS: Record<SettingKey, string> = {
  header: "Header",
  topbar: "Topbar",
  footer: "Footer",
  theme: "Theme",
  seo_defaults: "SEO",
}

export type EditorLocale = "en" | "bn"

export type SettingEditor<K extends SettingKey> = {
  en: SettingDataMap[K] | null
  bn: Record<string, any>
  loading: boolean
  saving: boolean
  exists: boolean
  locale: EditorLocale
  setLocale: (l: EditorLocale) => void
  /** Mutate the full `en` object via an in-place draft updater. */
  updateEn: (fn: (draft: SettingDataMap[K]) => void) => void
  /** Set a sparse `bn` override at a nested path ("" clears it). */
  setBnPath: (path: Path, value: any) => void
  getBn: (path: Path) => any
  save: () => Promise<void>
}

export function useSettingEditor<K extends SettingKey>(
  key: K
): SettingEditor<K> {
  const [en, setEn] = useState<SettingDataMap[K] | null>(null)
  const [bn, setBn] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exists, setExists] = useState(false)
  const [locale, setLocale] = useState<EditorLocale>("en")

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/admin/cms/settings/${key}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const data = d?.setting?.data ?? {}
        setEn((data.en ?? null) as SettingDataMap[K] | null)
        setBn((data.bn ?? {}) as Record<string, any>)
        setExists(!!d?.exists)
      })
      .catch(() => {
        if (active) toast.error("Failed to load settings")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [key])

  const updateEn: SettingEditor<K>["updateEn"] = (fn) =>
    setEn((prev) => {
      if (!prev) return prev
      const d = clone(prev)
      fn(d)
      return d
    })

  const setBnPath: SettingEditor<K>["setBnPath"] = (path, value) =>
    setBn((prev) => setPathImmutable(prev, path, value))

  const getBn: SettingEditor<K>["getBn"] = (path) => getPath(bn, path)

  const save = async () => {
    if (!en) return
    setSaving(true)
    try {
      const hasBn = bn && Object.keys(bn).length > 0
      const body = { data: { en, ...(hasBn ? { bn } : {}) } }
      const res = await fetch(`/admin/cms/settings/${key}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.message || `Save failed (${res.status})`)
      }
      setExists(true)
      toast.success("Settings saved", {
        description: `${SETTING_LABELS[key]} settings have been updated.`,
      })
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return {
    en,
    bn,
    loading,
    saving,
    exists,
    locale,
    setLocale,
    updateEn,
    setBnPath,
    getBn,
    save,
  }
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
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
      {(["en", "bn"] as const).map((l) => (
        <Button
          key={l}
          size="small"
          variant={locale === l ? "primary" : "transparent"}
          onClick={() => onChange(l)}
        >
          {l.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}

export function EditorShell<K extends SettingKey>({
  ctx,
  title,
  description,
  localizable,
  render,
}: {
  ctx: SettingEditor<K>
  title: string
  description?: string
  localizable?: boolean
  render: () => ReactNode
}) {
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col">
          <Heading level="h2">{title}</Heading>
          {description && (
            <Text size="small" className="text-ui-fg-subtle">
              {description}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-x-3">
          {localizable && (
            <LocaleSwitcher locale={ctx.locale} onChange={ctx.setLocale} />
          )}
          <Button
            size="small"
            onClick={ctx.save}
            isLoading={ctx.saving}
            disabled={ctx.loading || !ctx.en}
          >
            Save
          </Button>
        </div>
      </div>

      {ctx.loading || !ctx.en ? (
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-y-8 px-6 py-6">
          {localizable && ctx.locale === "bn" && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
              <Text size="small" className="text-ui-fg-subtle">
                Editing Bengali (bn) overrides. Only translatable text is shown —
                leave a field empty to fall back to the English value. Structure,
                toggles, colors and links are managed in the EN tab.
              </Text>
            </div>
          )}
          {render()}
        </div>
      )}
    </Container>
  )
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between gap-x-4">
        <div className="flex flex-col">
          <Heading level="h3">{title}</Heading>
          {description && (
            <Text size="small" className="text-ui-fg-subtle">
              {description}
            </Text>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Field({
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

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Field bindings (EN-only structural / non-text fields)              */
/* ------------------------------------------------------------------ */

type FieldProps<K extends SettingKey> = {
  ctx: SettingEditor<K>
  path: Path
  label: string
  hint?: string
}

export function TextField<K extends SettingKey>({
  ctx,
  path,
  label,
  hint,
  placeholder,
  type,
  textarea,
  rows,
}: FieldProps<K> & {
  placeholder?: string
  type?: string
  textarea?: boolean
  rows?: number
}) {
  if (ctx.locale !== "en") return null
  const val = (getPath(ctx.en, path) ?? "") as string
  return (
    <Field label={label} hint={hint}>
      {textarea ? (
        <Textarea
          value={val}
          rows={rows ?? 3}
          placeholder={placeholder}
          onChange={(e) => ctx.updateEn((d) => mutPath(d, path, e.target.value))}
        />
      ) : (
        <Input
          value={val}
          type={type}
          placeholder={placeholder}
          onChange={(e) => ctx.updateEn((d) => mutPath(d, path, e.target.value))}
        />
      )}
    </Field>
  )
}

export function NumberField<K extends SettingKey>({
  ctx,
  path,
  label,
  hint,
  placeholder,
  allowNull,
}: FieldProps<K> & { placeholder?: string; allowNull?: boolean }) {
  if (ctx.locale !== "en") return null
  const raw = getPath(ctx.en, path)
  const val = raw === null || raw === undefined ? "" : String(raw)
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        value={val}
        placeholder={placeholder ?? (allowNull ? "All" : undefined)}
        onChange={(e) => {
          const v = e.target.value
          ctx.updateEn((d) =>
            mutPath(d, path, v === "" ? (allowNull ? null : 0) : Number(v))
          )
        }}
      />
    </Field>
  )
}

export function SwitchField<K extends SettingKey>({
  ctx,
  path,
  label,
  hint,
}: FieldProps<K>) {
  if (ctx.locale !== "en") return null
  const val = !!getPath(ctx.en, path)
  return (
    <div className="flex items-start justify-between gap-x-4 rounded-lg border border-ui-border-base px-4 py-3">
      <div className="flex flex-col">
        <Label size="small" weight="plus">
          {label}
        </Label>
        {hint && (
          <Text size="xsmall" className="text-ui-fg-muted">
            {hint}
          </Text>
        )}
      </div>
      <Switch
        checked={val}
        onCheckedChange={(c) => ctx.updateEn((d) => mutPath(d, path, c))}
      />
    </div>
  )
}

export function ColorField<K extends SettingKey>({
  ctx,
  path,
  label,
  hint,
}: FieldProps<K>) {
  if (ctx.locale !== "en") return null
  const val = (getPath(ctx.en, path) ?? "") as string
  const swatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#000000"
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-x-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={swatch}
          onChange={(e) => ctx.updateEn((d) => mutPath(d, path, e.target.value))}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-ui-bg-field p-0.5"
        />
        <Input
          value={val}
          className="font-mono"
          onChange={(e) => ctx.updateEn((d) => mutPath(d, path, e.target.value))}
        />
      </div>
    </Field>
  )
}

/**
 * Localized scalar string. EN tab edits `en` at `path`; BN tab edits a sparse
 * `bn` override at the same path (placeholder shows the EN value).
 */
export function LocalizedText<K extends SettingKey>({
  ctx,
  path,
  label,
  hint,
  textarea,
  rows,
}: FieldProps<K> & { textarea?: boolean; rows?: number }) {
  const enVal = (getPath(ctx.en, path) ?? "") as string
  if (ctx.locale === "en") {
    return (
      <Field label={label} hint={hint}>
        {textarea ? (
          <Textarea
            value={enVal}
            rows={rows ?? 3}
            onChange={(e) =>
              ctx.updateEn((d) => mutPath(d, path, e.target.value))
            }
          />
        ) : (
          <Input
            value={enVal}
            onChange={(e) =>
              ctx.updateEn((d) => mutPath(d, path, e.target.value))
            }
          />
        )}
      </Field>
    )
  }
  const bnVal = (ctx.getBn(path) ?? "") as string
  return (
    <Field label={`${label} · BN`} hint="Leave empty to use the English value">
      {textarea ? (
        <Textarea
          value={bnVal}
          rows={rows ?? 3}
          placeholder={enVal}
          onChange={(e) => ctx.setBnPath(path, e.target.value)}
        />
      ) : (
        <Input
          value={bnVal}
          placeholder={enVal}
          onChange={(e) => ctx.setBnPath(path, e.target.value)}
        />
      )}
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Repeatable array editor (EN-only structural lists)                  */
/* ------------------------------------------------------------------ */

export function ArrayEditor<K extends SettingKey, T = any>({
  ctx,
  path,
  title,
  description,
  newItem,
  addLabel,
  reorderable,
  renderItem,
}: {
  ctx: SettingEditor<K>
  path: Path
  title: string
  description?: string
  newItem: T
  addLabel?: string
  reorderable?: boolean
  renderItem: (item: T, patch: (changes: Partial<T>) => void, index: number) => ReactNode
}) {
  if (ctx.locale !== "en") return null
  const arr = (getPath(ctx.en, path) ?? []) as T[]
  const setArr = (next: T[]) => ctx.updateEn((d) => mutPath(d, path, next))

  const patchAt = (i: number, changes: Partial<T>) => {
    const next = arr.slice()
    next[i] = { ...(next[i] as any), ...(changes as any) }
    setArr(next)
  }
  const removeAt = (i: number) => setArr(arr.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    const next = arr.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setArr(next)
  }

  return (
    <Section
      title={title}
      description={description}
      action={
        <Button
          size="small"
          variant="secondary"
          onClick={() => setArr([...arr, clone(newItem)])}
        >
          <Plus />
          {addLabel ?? "Add"}
        </Button>
      }
    >
      {arr.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          No items yet.
        </Text>
      ) : (
        <div className="flex flex-col gap-y-3">
          {arr.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-x-3 rounded-lg border border-ui-border-base p-3"
            >
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                {renderItem(item, (changes) => patchAt(i, changes), i)}
              </div>
              <div className="flex shrink-0 flex-col gap-y-1">
                {reorderable && (
                  <>
                    <IconButton
                      size="small"
                      variant="transparent"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUpMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      disabled={i === arr.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDownMini />
                    </IconButton>
                  </>
                )}
                <IconButton
                  size="small"
                  variant="transparent"
                  onClick={() => removeAt(i)}
                >
                  <Trash />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/** Small labelled Input for use inside ArrayEditor rows. */
export function RowInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Label>
      <Input
        size="small"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
