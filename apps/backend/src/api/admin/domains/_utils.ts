import { resolveTenantId } from "../../../lib/tenant-context"
import type { MedusaResponse } from "@medusajs/framework/http"

/**
 * Shared helpers for the /admin/domains routes.
 *
 * All routes are tenant-scoped to a single default tenant (HaaS-ready models
 * carry `tenant_id`). The domain-service functions are NO-THROW and return
 * `{ ok, data?, error? }`; `svcFail` maps a failed service result to an HTTP
 * error (default 502 = upstream/registrar error), while missing-input checks in
 * the routes return 400 (validation).
 */

export type ServiceResult<T = any> = { ok: boolean; data?: T; error?: string }

export const TENANT_ID = resolveTenantId("DOMAINS_DEFAULT_TENANT")

/** Acting admin id from the framework auth context (global /admin gate). */
export const getActorId = (req: any): string | undefined =>
  req?.auth_context?.actor_id

/** Map a failed service result to an HTTP error response. */
export const svcFail = (
  res: MedusaResponse,
  result: ServiceResult,
  status = 502
) => res.status(status).json({ message: result.error ?? "Registrar error" })
