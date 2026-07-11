/**
 * Segment rule schema — the typed shape of `marketing_segment.filter`. A segment
 * matches contacts whose resolved attributes satisfy the rule tree. The
 * evaluator resolves each `field` from a per-contact attribute bundle built from
 * the contact row + commerce facts (orders via the gateway) + email engagement
 * aggregates, then applies the rules.
 */

export type SegmentOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "contains"
  | "in"

export type SegmentRule = {
  field: SegmentField | string
  op: SegmentOp
  value?: unknown
}

export type SegmentFilter = {
  /** "all" = AND, "any" = OR. */
  match: "all" | "any"
  rules: SegmentRule[]
}

/** The known, resolvable attributes (RFM + engagement + profile). */
export const SEGMENT_FIELDS = [
  "score",
  "tags",
  "orders_count",
  "total_spent",
  "days_since_last_order",
  "days_since_created",
  "has_ordered",
  "has_abandoned_cart",
  "email_opens",
  "email_clicks",
  "is_subscribed",
  "country",
] as const
export type SegmentField = (typeof SEGMENT_FIELDS)[number]

/** The resolved attribute bundle the evaluator builds per contact. */
export type ContactAttributes = {
  contact_id: string
  email: string | null
  score: number
  tags: string[]
  orders_count: number
  total_spent: number
  days_since_last_order: number | null
  days_since_created: number | null
  has_ordered: boolean
  has_abandoned_cart: boolean
  email_opens: number
  email_clicks: number
  is_subscribed: boolean
  country: string | null
}

/** Field metadata for the segment-builder UI (labels + input hints). */
export const SEGMENT_FIELD_META: Record<
  string,
  { label: string; type: "number" | "string" | "boolean" | "tags" }
> = {
  score: { label: "Engagement score", type: "number" },
  tags: { label: "Tag", type: "tags" },
  orders_count: { label: "Number of orders", type: "number" },
  total_spent: { label: "Total spent", type: "number" },
  days_since_last_order: { label: "Days since last order", type: "number" },
  days_since_created: { label: "Days since first seen", type: "number" },
  has_ordered: { label: "Has ordered", type: "boolean" },
  has_abandoned_cart: { label: "Has an abandoned cart", type: "boolean" },
  email_opens: { label: "Email opens", type: "number" },
  email_clicks: { label: "Email clicks", type: "number" },
  is_subscribed: { label: "Is subscribed", type: "boolean" },
  country: { label: "Country", type: "string" },
}
