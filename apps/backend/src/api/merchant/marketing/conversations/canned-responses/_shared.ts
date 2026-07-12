/**
 * Canned-response helpers: field validation and the shortcut-uniqueness guard.
 *
 * A shortcut must resolve to exactly one response within a tenant (the DB has a
 * unique (tenant_id, shortcut) index). Both a pre-check and a unique-violation
 * catch feed the SAME clean 409 — a duplicate never surfaces as a raw 500.
 */

export const MAX_SHORTCUT_LENGTH = 64
export const MAX_TITLE_LENGTH = 120
export const MAX_CONTENT_LENGTH = 5000
export const MAX_CATEGORY_LENGTH = 64

/** Postgres unique-violation. */
export const isUniqueViolation = (e: any): boolean => {
  const code = e?.code ?? e?.original?.code ?? e?.cause?.code
  if (code === "23505") return true
  const msg = String(e?.message ?? "").toLowerCase()
  return msg.includes("duplicate key value") || msg.includes("unique constraint")
}

export const SHORTCUT_CONFLICT = {
  message:
    "A canned response with that shortcut already exists. Shortcuts must be unique within your store.",
  code: "shortcut_conflict",
}

export type CannedFields = {
  shortcut: string
  title: string
  content: string
  category: string | null
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

/**
 * Validate a canned-response body. `partial` allows omitted fields (update);
 * a present field is always validated. Returns the normalized patch, or an
 * error message.
 */
export const validateCanned = (
  body: any,
  partial: boolean
): { ok: true; value: Partial<CannedFields> } | { ok: false; message: string } => {
  const value: Partial<CannedFields> = {}

  const has = (k: string) => body && Object.prototype.hasOwnProperty.call(body, k)

  if (!partial || has("shortcut")) {
    const shortcut = str(body?.shortcut)
    if (!shortcut) return { ok: false, message: "shortcut is required" }
    if (shortcut.length > MAX_SHORTCUT_LENGTH) {
      return {
        ok: false,
        message: `shortcut must be at most ${MAX_SHORTCUT_LENGTH} characters`,
      }
    }
    if (/\s/.test(shortcut)) {
      return { ok: false, message: "shortcut must not contain whitespace" }
    }
    value.shortcut = shortcut
  }

  if (!partial || has("title")) {
    const title = str(body?.title)
    if (!title) return { ok: false, message: "title is required" }
    if (title.length > MAX_TITLE_LENGTH) {
      return {
        ok: false,
        message: `title must be at most ${MAX_TITLE_LENGTH} characters`,
      }
    }
    value.title = title
  }

  if (!partial || has("content")) {
    const content = str(body?.content)
    if (!content) return { ok: false, message: "content is required" }
    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        message: `content must be at most ${MAX_CONTENT_LENGTH} characters`,
      }
    }
    value.content = content
  }

  if (has("category")) {
    if (body.category === null) {
      value.category = null
    } else {
      const category = str(body?.category)
      if (!category) {
        return { ok: false, message: "category must be a non-empty string or null" }
      }
      if (category.length > MAX_CATEGORY_LENGTH) {
        return {
          ok: false,
          message: `category must be at most ${MAX_CATEGORY_LENGTH} characters`,
        }
      }
      value.category = category
    }
  }

  return { ok: true, value }
}

/**
 * True when `shortcut` is already taken in this tenant by a DIFFERENT response.
 */
export const shortcutTaken = async (
  mk: any,
  tenantId: string,
  shortcut: string,
  exceptId?: string
): Promise<boolean> => {
  const rows = await mk.listMarketingCannedResponses({
    tenant_id: tenantId,
    shortcut,
  })
  return (Array.isArray(rows) ? rows : []).some((r: any) => r.id !== exceptId)
}
