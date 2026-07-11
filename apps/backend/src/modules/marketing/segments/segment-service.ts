import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * segment-service — the SEGMENT evaluator for the marketing brain.
 *
 * A dynamic segment stores a rule tree (`filter`) that is re-evaluated on a
 * schedule. Evaluation resolves a per-contact attribute bundle
 * (`ContactAttributes`) from the contact row + commerce facts (orders via the
 * gateway) + engagement aggregates (cart recoveries, email sends), applies the
 * rule predicate, and MATERIALIZES the matching set into
 * `marketing_segment_member` rows so journeys + audience counts can read a fast
 * membership table.
 *
 * NO-THROW: every entrypoint is best-effort and tenant-scoped. A resolution
 * failure degrades an attribute to its sensible default rather than throwing,
 * so a single bad contact never sinks a whole re-evaluation. The contact scan
 * is CAPPED (see SCAN_CAP) and the cap is LOGGED — silent truncation is not
 * allowed.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import type { CommerceOrder } from "../gateway"
import type {
  ContactAttributes,
  SegmentFilter,
  SegmentRule,
} from "./types"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Hard cap on how many contacts a single evaluation/preview scan reads. */
const SCAN_CAP = 2000
/** Page size for the paginated contact scan. */
const SCAN_PAGE = 200

/** Best-effort logger resolve — never throws. */
const getLogger = (container: MedusaContainer): any => {
  try {
    return container.resolve("logger")
  } catch {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  }
}

/** Whole days between `date` and now, or null when unparseable/absent. */
const daysSince = (date: unknown): number | null => {
  if (!date) {
    return null
  }
  const t = new Date(date as any).getTime()
  if (Number.isNaN(t)) {
    return null
  }
  return Math.floor((Date.now() - t) / 86_400_000)
}

/** Coerce to a finite number, or null when not numeric. */
const numeric = (v: unknown): number | null => {
  if (typeof v === "boolean") {
    return v ? 1 : 0
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Newest-first epoch-ms sort key for an order (missing dates sort last). */
const orderTime = (o: CommerceOrder): number => {
  const t = o.created_at ? Date.parse(o.created_at) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** Normalize a contact's `tags` json into a string array. */
const tagsOf = (contact: any): string[] => {
  const raw = contact?.tags
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t))
  }
  return []
}

/**
 * Prefetched, tenant-wide facts shared across a scan so `buildContactAttributes`
 * does not issue N queries per contact. When omitted (a standalone single-contact
 * call), each fact is resolved live instead.
 */
export type ScanDeps = {
  orders: CommerceOrder[]
  recoveriesByEmail: Map<string, any[]>
  sendsByContact: Map<string, any[]>
}

/**
 * Resolve the full `ContactAttributes` bundle for a single contact. Best-effort:
 * every field falls back to a sensible default and the function never throws.
 *
 * When `deps` is supplied (the scan path) commerce + engagement facts are read
 * from the prefetched, tenant-wide caches; otherwise each is queried live.
 */
export const buildContactAttributes = async (
  container: MedusaContainer,
  tenantId: string,
  contact: any,
  deps?: ScanDeps
): Promise<ContactAttributes> => {
  const contactId = String(contact?.id ?? "")
  const email: string | null = contact?.email ?? null

  const attrs: ContactAttributes = {
    contact_id: contactId,
    email,
    score: typeof contact?.score === "number" ? contact.score : 0,
    tags: tagsOf(contact),
    orders_count: 0,
    total_spent: 0,
    days_since_last_order: null,
    days_since_created: daysSince(contact?.created_at),
    has_ordered: false,
    has_abandoned_cart: false,
    email_opens: 0,
    email_clicks: 0,
    is_subscribed: !contact?.unsubscribed_at,
    country: null,
  }

  // --- Orders: resolve this contact's orders, then aggregate ----------------
  try {
    let all: CommerceOrder[] = []
    if (deps) {
      all = deps.orders
    } else {
      const gateway = getCommerceGateway(container)
      all = await gateway.queryOrders(tenantId, { limit: 200 })
    }
    const mine = (Array.isArray(all) ? all : []).filter((o) =>
      contact?.customer_id
        ? o.customer_id === contact.customer_id
        : email
        ? o.email === email
        : false
    )
    attrs.orders_count = mine.length
    attrs.has_ordered = mine.length > 0
    attrs.total_spent = mine.reduce(
      (sum, o) => sum + (typeof o.total === "number" ? o.total : 0),
      0
    )
    if (mine.length) {
      const newest = [...mine].sort((a, b) => orderTime(b) - orderTime(a))[0]
      attrs.days_since_last_order = daysSince(newest?.created_at)
    }
  } catch {
    // No-throw: leave order attributes at their zero defaults.
  }

  // --- Abandoned cart: an active/processing recovery row exists -------------
  try {
    let rows: any[] = []
    if (deps) {
      rows = email ? deps.recoveriesByEmail.get(email) ?? [] : []
    } else if (email) {
      const mk: any = container.resolve(MARKETING_MODULE)
      rows = await mk.listMarketingCartRecoveries({
        tenant_id: tenantId,
        email,
      })
    }
    attrs.has_abandoned_cart = (Array.isArray(rows) ? rows : []).some((r) => {
      const s = String(r?.status ?? "")
      return s === "active" || s === "processing"
    })
  } catch {
    // No-throw: assume no abandoned cart.
  }

  // --- Email engagement: sum open/click counters over this contact's sends --
  try {
    let sends: any[] = []
    if (deps) {
      sends = contactId ? deps.sendsByContact.get(contactId) ?? [] : []
    } else if (contactId) {
      const mk: any = container.resolve(MARKETING_MODULE)
      sends = await mk.listMarketingEmailSends({
        tenant_id: tenantId,
        contact_id: contactId,
      })
    }
    for (const s of Array.isArray(sends) ? sends : []) {
      attrs.email_opens += Number(s?.open_count ?? 0)
      attrs.email_clicks += Number(s?.click_count ?? 0)
    }
  } catch {
    // No-throw: leave engagement counters at zero.
  }

  // --- Country: contact.meta first, then the customer's default address -----
  try {
    const metaCountry =
      contact?.meta && typeof contact.meta === "object"
        ? (contact.meta.country ?? contact.meta.country_code)
        : undefined
    if (metaCountry) {
      attrs.country = String(metaCountry)
    } else if (!deps && contact?.customer_id) {
      // Only in the single-contact path — a per-contact getCustomer would be
      // N queries in a scan, so the scan relies on meta only.
      const gateway = getCommerceGateway(container)
      const customer = await gateway.getCustomer(tenantId, contact.customer_id)
      const addr = customer?.addresses?.find((a) => a?.country_code)
      attrs.country = addr?.country_code ?? null
    }
  } catch {
    // No-throw: leave country null.
  }

  return attrs
}

/** Apply a single rule's operator against a resolved attribute value. */
const applyRule = (actual: unknown, rule: SegmentRule): boolean => {
  const { op, value } = rule

  const looseEquals = (a: unknown, b: unknown): boolean => {
    if (a === b) {
      return true
    }
    const na = numeric(a)
    const nb = numeric(b)
    if (na !== null && nb !== null) {
      return na === nb
    }
    return String(a) === String(b)
  }

  switch (op) {
    case "exists":
      return actual !== null && actual !== undefined
    case "not_exists":
      return actual === null || actual === undefined
    case "eq":
      return looseEquals(actual, value)
    case "neq":
      return !looseEquals(actual, value)
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const na = numeric(actual)
      const nb = numeric(value)
      if (na === null || nb === null) {
        return false
      }
      if (op === "gt") return na > nb
      if (op === "gte") return na >= nb
      if (op === "lt") return na < nb
      return na <= nb
    }
    case "contains": {
      if (Array.isArray(actual)) {
        return actual.some((a) => looseEquals(a, value))
      }
      if (typeof actual === "string") {
        return actual.includes(String(value))
      }
      return false
    }
    case "in": {
      if (!Array.isArray(value)) {
        return false
      }
      if (Array.isArray(actual)) {
        return actual.some((a) => value.some((v) => looseEquals(a, v)))
      }
      return value.some((v) => looseEquals(actual, v))
    }
    default:
      return false
  }
}

/**
 * Pure predicate: does this attribute bundle satisfy the filter? `match:"all"`
 * ANDs the rules, `match:"any"` ORs them. A filter with no rules matches nobody
 * (callers guard against materializing an empty rule set).
 */
export const evaluateFilter = (
  attrs: ContactAttributes,
  filter: SegmentFilter | null | undefined
): boolean => {
  const rules = filter?.rules
  if (!filter || !Array.isArray(rules) || rules.length === 0) {
    return false
  }
  const test = (rule: SegmentRule): boolean =>
    applyRule((attrs as any)[rule.field], rule)

  return filter.match === "any" ? rules.some(test) : rules.every(test)
}

/**
 * Build the tenant-wide fact caches for a scan in a bounded number of queries
 * (rather than N per contact). Best-effort: any failure yields an empty cache.
 */
const loadScanDeps = async (
  container: MedusaContainer,
  tenantId: string
): Promise<ScanDeps> => {
  const deps: ScanDeps = {
    orders: [],
    recoveriesByEmail: new Map(),
    sendsByContact: new Map(),
  }

  try {
    const gateway = getCommerceGateway(container)
    deps.orders = await gateway.queryOrders(tenantId, { limit: SCAN_CAP })
  } catch {
    deps.orders = []
  }

  const mk: any = (() => {
    try {
      return container.resolve(MARKETING_MODULE)
    } catch {
      return null
    }
  })()

  if (mk) {
    try {
      const recoveries = await mk.listMarketingCartRecoveries(
        { tenant_id: tenantId },
        { take: SCAN_CAP }
      )
      for (const r of Array.isArray(recoveries) ? recoveries : []) {
        const key = r?.email
        if (!key) {
          continue
        }
        const bucket = deps.recoveriesByEmail.get(key) ?? []
        bucket.push(r)
        deps.recoveriesByEmail.set(key, bucket)
      }
    } catch {
      // No-throw: no recovery facts.
    }

    try {
      const sends = await mk.listMarketingEmailSends(
        { tenant_id: tenantId },
        { take: SCAN_CAP }
      )
      for (const s of Array.isArray(sends) ? sends : []) {
        const key = s?.contact_id
        if (!key) {
          continue
        }
        const bucket = deps.sendsByContact.get(key) ?? []
        bucket.push(s)
        deps.sendsByContact.set(key, bucket)
      }
    } catch {
      // No-throw: no engagement facts.
    }
  }

  return deps
}

/**
 * Scan (paginated, capped) the tenant's contacts, build each attribute bundle,
 * and return the ones matching `filter` alongside their computed attributes.
 * Logs when the scan is truncated at SCAN_CAP.
 */
const scanMatches = async (
  container: MedusaContainer,
  tenantId: string,
  filter: SegmentFilter
): Promise<Array<{ contact: any; attrs: ContactAttributes }>> => {
  const logger = getLogger(container)
  const mk: any = container.resolve(MARKETING_MODULE)
  const deps = await loadScanDeps(container, tenantId)

  const matches: Array<{ contact: any; attrs: ContactAttributes }> = []
  let scanned = 0
  let total = 0

  for (let skip = 0; skip < SCAN_CAP; skip += SCAN_PAGE) {
    let page: any[] = []
    try {
      const result = await mk.listAndCountMarketingContacts(
        { tenant_id: tenantId },
        { take: SCAN_PAGE, skip }
      )
      page = Array.isArray(result) ? result[0] ?? [] : []
      total = Array.isArray(result) ? Number(result[1] ?? 0) : 0
    } catch {
      break
    }

    if (!page.length) {
      break
    }

    for (const contact of page) {
      const attrs = await buildContactAttributes(
        container,
        tenantId,
        contact,
        deps
      )
      if (evaluateFilter(attrs, filter)) {
        matches.push({ contact, attrs })
      }
    }

    scanned += page.length
    if (page.length < SCAN_PAGE) {
      break
    }
  }

  if (total > SCAN_CAP || scanned >= SCAN_CAP) {
    logger.warn(
      `[marketing] segment scan capped at ${SCAN_CAP} contacts (scanned=${scanned}, total=${total}); some matches may be omitted.`
    )
  }

  return matches
}

/**
 * Preview a filter without persisting anything: returns the match count and a
 * small sample of matched contacts (with a few resolved attributes). No writes.
 */
export const previewSegment = async (
  container: MedusaContainer,
  input: { tenantId: string; filter: SegmentFilter; limit?: number }
): Promise<{
  count: number
  sample: Array<{
    contact_id: string
    email: string | null
    score: number
    orders_count: number
    total_spent: number
    has_ordered: boolean
  }>
}> => {
  const limit = input.limit ?? 20
  try {
    const matches = await scanMatches(
      container,
      input.tenantId,
      input.filter
    )
    const sample = matches.slice(0, limit).map(({ attrs }) => ({
      contact_id: attrs.contact_id,
      email: attrs.email,
      score: attrs.score,
      orders_count: attrs.orders_count,
      total_spent: attrs.total_spent,
      has_ordered: attrs.has_ordered,
    }))
    return { count: matches.length, sample }
  } catch (e) {
    getLogger(container).error("[marketing] previewSegment failed:", e as any)
    return { count: 0, sample: [] }
  }
}

/**
 * Evaluate a dynamic segment end-to-end: compute the matching contact set, then
 * MATERIALIZE it — replace the segment's existing dynamic members with fresh
 * rows and update `member_count` + `last_evaluated_at`. Static segments are left
 * untouched (their membership is managed by hand). No-throw.
 */
export const evaluateSegment = async (
  container: MedusaContainer,
  input: { tenantId: string; segmentId: string }
): Promise<{ count: number }> => {
  const logger = getLogger(container)

  try {
    const mk: any = container.resolve(MARKETING_MODULE)

    const segment = await mk.retrieveMarketingSegment(input.segmentId)
    if (!segment || segment.tenant_id !== input.tenantId) {
      return { count: 0 }
    }

    // Static segments have hand-managed membership — never touch them here.
    if (segment.kind !== "dynamic") {
      return { count: Number(segment.member_count ?? 0) }
    }

    const filter = segment.filter as SegmentFilter | null | undefined
    if (
      !filter ||
      !Array.isArray(filter.rules) ||
      filter.rules.length === 0
    ) {
      // No rules → nothing to materialize; leave the segment as-is.
      return { count: Number(segment.member_count ?? 0) }
    }

    const matches = await scanMatches(container, input.tenantId, filter)
    const matchedIds = Array.from(
      new Set(
        matches
          .map((m) => String(m.contact.id ?? ""))
          .filter((id) => id.length > 0)
      )
    )

    // Replace existing dynamic members: delete the old set, insert the new.
    try {
      const existing = await mk.listMarketingSegmentMembers({
        tenant_id: input.tenantId,
        segment_id: input.segmentId,
        source: "dynamic",
      })
      const existingIds = (Array.isArray(existing) ? existing : [])
        .map((m: any) => m?.id)
        .filter((id: any) => Boolean(id))
      if (existingIds.length) {
        await mk.deleteMarketingSegmentMembers(existingIds)
      }
    } catch (e) {
      logger.error(
        "[marketing] evaluateSegment: clearing old members failed:",
        e as any
      )
    }

    if (matchedIds.length) {
      const now = new Date()
      try {
        await mk.createMarketingSegmentMembers(
          matchedIds.map((contactId) => ({
            tenant_id: input.tenantId,
            segment_id: input.segmentId,
            contact_id: contactId,
            source: "dynamic",
            added_at: now,
          })) as any
        )
      } catch (e) {
        logger.error(
          "[marketing] evaluateSegment: inserting members failed:",
          e as any
        )
      }
    }

    try {
      await mk.updateMarketingSegments({
        id: input.segmentId,
        member_count: matchedIds.length,
        last_evaluated_at: new Date(),
      } as any)
    } catch (e) {
      logger.error(
        "[marketing] evaluateSegment: updating segment counters failed:",
        e as any
      )
    }

    return { count: matchedIds.length }
  } catch (e) {
    logger.error("[marketing] evaluateSegment failed:", e as any)
    return { count: 0 }
  }
}

/**
 * Return the materialized member contact ids for a segment — the read journeys
 * use to enroll an audience by segment. No-throw; returns [] on any failure.
 */
export const getSegmentContactIds = async (
  container: MedusaContainer,
  input: { tenantId: string; segmentId: string }
): Promise<string[]> => {
  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const members = await mk.listMarketingSegmentMembers({
      tenant_id: input.tenantId,
      segment_id: input.segmentId,
    })
    return (Array.isArray(members) ? members : [])
      .map((m: any) => String(m?.contact_id ?? ""))
      .filter((id) => id.length > 0)
  } catch {
    return []
  }
}

/**
 * Re-evaluate every dynamic segment for the default tenant. Gated on the master
 * `MARKETING_ENABLED` kill switch — inert (returns zeros) until explicitly
 * enabled. No-throw: a single segment failure is logged and the sweep continues.
 */
export const runSegmentReeval = async (
  container: MedusaContainer
): Promise<{ evaluated: number; members: number }> => {
  if (process.env.MARKETING_ENABLED !== "1") {
    return { evaluated: 0, members: 0 }
  }

  const logger = getLogger(container)
  const tenantId = currentTenantId()

  let evaluated = 0
  let members = 0

  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const segments = await mk.listMarketingSegments({
      tenant_id: tenantId,
      kind: "dynamic",
    })

    for (const segment of Array.isArray(segments) ? segments : []) {
      if (!segment?.id) {
        continue
      }
      const { count } = await evaluateSegment(container, {
        tenantId,
        segmentId: segment.id,
      })
      evaluated += 1
      members += count
    }
  } catch (e) {
    logger.error("[marketing] runSegmentReeval failed:", e as any)
  }

  return { evaluated, members }
}
