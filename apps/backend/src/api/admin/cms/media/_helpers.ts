import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import crypto from "crypto"
import type CmsModuleService from "../../../../modules/cms/service"
import { getActor } from "../settings/_helpers"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"

/**
 * Shared helpers for the admin Media Library routes. Non-`route.ts` /
 * `middlewares.ts` files are ignored by Medusa's file-based router, so this is
 * an import-only module (leading underscore makes that explicit).
 */

/** Upload limits & mime allowlist (phase-0-architecture.md §7.2). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
] as const

export function assertAllowedMime(mime: string): void {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported file type "${mime}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}.`
    )
  }
}

/** A locale-map of strings, e.g. { en: "Hero banner", bn: "..." }. */
export type LocaleText = { en?: string; bn?: string }

/**
 * Normalize an incoming alt/title field into a per-locale map. Accepts:
 *   - undefined / null            -> null (no value)
 *   - a plain string              -> { en: <string> }
 *   - a JSON string of an object  -> parsed object
 *   - an object                   -> used as-is
 */
export function normalizeLocaleText(
  raw: unknown
): LocaleText | null {
  if (raw === undefined || raw === null || raw === "") {
    return null
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") {
          return parsed as LocaleText
        }
      } catch {
        // fall through to treat as plain en string
      }
    }
    return { en: raw }
  }
  if (typeof raw === "object") {
    return raw as LocaleText
  }
  return null
}

/** sha256 hex of a buffer (dedupe / integrity). */
export function checksumOf(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

/**
 * Best-effort image dimension extraction via sharp. Returns {null,null} for
 * svg / video / extraction failure — never throws (so upload never blocks on it).
 */
export async function extractDimensions(
  buffer: Buffer,
  mime: string
): Promise<{ width: number | null; height: number | null }> {
  if (!mime.startsWith("image/") || mime === "image/svg+xml") {
    return { width: null, height: null }
  }
  try {
    // sharp is hoisted to the monorepo root and resolvable from the backend.
    const sharpMod = await import("sharp")
    const sharp = (sharpMod as any).default ?? sharpMod
    const meta = await sharp(buffer).metadata()
    return {
      width: typeof meta.width === "number" ? meta.width : null,
      height: typeof meta.height === "number" ? meta.height : null,
    }
  } catch {
    return { width: null, height: null }
  }
}

/**
 * Write a cms_audit_log row for a media action. Best-effort & non-blocking —
 * an audit failure must never roll back the business operation (§8.3).
 */
export async function recordMediaAudit(
  req: MedusaRequest,
  service: CmsModuleService,
  action: "media.upload" | "media.delete" | "media.update",
  mediaId: string,
  diff: { before?: unknown; after?: unknown }
): Promise<void> {
  try {
    const actor = await getActor(req)
    const tenantId = await cmsTenantId(req)
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: actor.user_id,
      actor_email: actor.email,
      action,
      entity_type: "media",
      entity_key: mediaId,
      before: (diff.before ?? null) as any,
      after: (diff.after ?? null) as any,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] media audit log write failed (non-blocking):", e)
  }
}

/**
 * Per-tenant, collision-free, non-guessable storage-key builder. Re-exported
 * from the shared lib so every upload site (CMS media + merchant product images
 * + marketing media + AI studio) shares ONE implementation and can never drift
 * apart — see src/lib/tenant-upload.ts. The raw original filename is preserved
 * separately in cms_media.original_filename for display/search.
 */
export { tenantScopedUploadFilename } from "../../../../lib/tenant-upload"

/** A multer in-memory file (subset we rely on). */
export type UploadedFile = {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}
