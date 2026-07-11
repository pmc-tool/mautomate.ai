import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import type CmsModuleService from "../../../../modules/cms/service"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import {
  BLOCK_TYPES,
  isLocale,
  type BlockType,
  type Locale,
} from "../../../../modules/cms/types"
import { getActor } from "../settings/_helpers"

/**
 * Shared helpers for the admin Pages / Sections routes. Non-`route.ts` /
 * `middlewares.ts` files are ignored by Medusa's file-based router, so this is
 * an import-only module (the leading underscore makes that explicit).
 */

/** Page draft relations loaded for the full editor tree. */
export const PAGE_TREE_RELATIONS = [
  "translations",
  "sections",
  "sections.translations",
] as const

export type PageAuditAction =
  | "page.create"
  | "page.update"
  | "page.delete"
  | "section.create"
  | "section.update"
  | "section.delete"
  | "section.reorder"

/**
 * Write a cms_audit_log row for a page/section action. Best-effort &
 * non-blocking — an audit failure must never roll back the business operation
 * (phase-0-architecture.md §8.3).
 */
export async function recordPageAudit(
  req: MedusaRequest,
  service: CmsModuleService,
  action: PageAuditAction,
  entityType: "page" | "section",
  entityKey: string,
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
      entity_type: entityType,
      entity_key: entityKey,
      before: (diff.before ?? null) as any,
      after: (diff.after ?? null) as any,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] page audit log write failed (non-blocking):", e)
  }
}

/** Validate a block type against the BLOCK_TYPES const union. */
export function assertBlockType(type: unknown): BlockType {
  if (
    typeof type !== "string" ||
    !(BLOCK_TYPES as readonly string[]).includes(type)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown block type "${String(type)}". Valid types: ${BLOCK_TYPES.join(
        ", "
      )}.`
    )
  }
  return type as BlockType
}

/** Validate a locale against the LOCALES const union. */
export function assertLocale(locale: unknown): Locale {
  if (!isLocale(locale)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown locale "${String(locale)}". Valid locales: en, bn.`
    )
  }
  return locale
}

/** Normalize a possibly-array MedusaService write result into a single row. */
export function one<T>(result: T | T[]): T {
  return Array.isArray(result) ? result[0] : result
}

/**
 * Build a URL-safe slug from a raw string (lowercase, alnum + dashes).
 * Used when a page is created without an explicit slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
}

/** Sort a section list by rank ascending (stable). */
export function sortByRank<T extends { rank?: number }>(sections: T[]): T[] {
  return [...sections].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
}
