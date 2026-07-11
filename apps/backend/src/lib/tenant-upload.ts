import crypto from "crypto"
import path from "path"

/**
 * Shared, provider-aware storage-key builder for pooled multi-tenant uploads.
 *
 * In the pooled (shared-process) model many stores upload through one File
 * Module provider. If two stores both upload "image.png" and we hand the raw
 * original filename to the provider, the resulting object keys collide (one
 * store overwrites the other) and are trivially guessable across stores. Every
 * upload site MUST therefore namespace its storage KEY by tenant with a random
 * component — this helper is the single source of truth for that shape.
 *
 * It only builds the storage KEY. The human-readable original filename must be
 * preserved separately on the DB row (e.g. `original_filename`) for
 * display/search; it never appears in the object key.
 *
 * The File Module provider turns the returned filename into the final key:
 *  - file-local KEEPS path.parse(filename).dir (and mkdir's it) and prefixes the
 *    base with a timestamp  ->  key "<tenant_id>/<ts>-<uuid><ext>", served at
 *    "<backend_url>/static/<tenant_id>/<ts>-<uuid><ext>".
 *  - file-s3 DROPS the dir (it uses path.parse(filename).name) and appends a
 *    ulid, so we fold the tenant into the basename instead  ->  key
 *    "<S3_PREFIX><tenant_id>__<uuid>-<ulid><ext>".
 *
 * Either way the object key is namespaced by tenant_id, carries a random
 * component, and never embeds the raw original filename.
 */

/**
 * Whether the active File Module provider is S3. Mirrors the EXACT switch in
 * medusa-config.ts (same env source of truth) so the storage key we build here
 * matches the provider that will consume it. Prod here runs LOCAL
 * (FILE_PROVIDER=local); S3 is the production-scale option.
 */
const FILE_PROVIDER_IS_S3 =
  (process.env.FILE_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "s3" : "local")) === "s3"

/**
 * Build a per-tenant, collision-free, non-guessable storage filename to hand to
 * uploadFilesWorkflow. Pooled multi-tenant: two stores uploading "logo.png"
 * must NOT collide or be enumerable across stores.
 */
export function tenantScopedUploadFilename(
  tenantId: string,
  originalName: string
): string {
  // Sanitize so the tenant segment can never traverse paths or inject slashes.
  const safeTenant =
    String(tenantId).replace(/[^a-zA-Z0-9_-]/g, "") || "t"
  // Keep only a simple, safe extension (".png", ".mp4", ...); drop anything odd.
  const ext = (
    path.extname(originalName || "").match(/^\.[a-zA-Z0-9]{1,10}$/)?.[0] ?? ""
  ).toLowerCase()
  const rand = crypto.randomUUID()
  if (FILE_PROVIDER_IS_S3) {
    // The S3 provider drops any directory -> fold the tenant into the name.
    return `${safeTenant}__${rand}${ext}`
  }
  // Local provider: a real per-tenant subfolder under the static dir.
  return `${safeTenant}/${rand}${ext}`
}
