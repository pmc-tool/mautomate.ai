"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  ArrowUpRightOnBox,
  Check,
  ExclamationCircle,
  PencilSquare,
  Plus,
  ReceiptPercent,
  SquareTwoStack,
  Trash,
  XMark,
} from "@medusajs/icons"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"
import {
  getPromotion,
  updatePromotion,
  deletePromotion,
  updatePromotionRules,
  listRuleAttributes,
  listRuleValues,
  listCampaigns,
  PromotionDetail,
  PromotionRule,
  PromotionRuleType,
  PromotionRuleOperator,
  PromotionRuleAttribute,
  PromotionRuleValue,
  UpdatePromotionInput,
  UpdatePromotionRulesOps,
  CampaignListItem,
  ApiError,
} from "../../../../lib/merchant-admin/api"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(value?: string | null): string {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

const OPERATOR_FALLBACK_LABELS: Record<string, string> = {
  in: "In",
  eq: "Equals",
  ne: "Not equals",
}

function operatorLabel(rule: PromotionRule): string {
  return (
    rule.operator_label ||
    OPERATOR_FALLBACK_LABELS[rule.operator] ||
    rule.operator
  )
}

/**
 * PromotionRule.values is an array of { value, label } for select/multiselect
 * attributes, but the RAW NUMBER (or null) for disguised number rules
 * (buy_rules_min_quantity / apply_to_quantity on buyget promotions) per
 * spec-promo-detail.json. Normalize to an array before any .map.
 */
function ruleValuesToArray(
  values: PromotionRule["values"]
): PromotionRuleValue[] {
  if (Array.isArray(values)) return values
  if (values === null || values === undefined) return []
  const v = String(values)
  return [{ value: v, label: v }]
}

/**
 * The backend stores and serializes rule attributes as their full VALUE path
 * (e.g. "items.product.id") while the attribute catalog also carries a short
 * id (e.g. "product"); disguised attributes have id === value. Resolve by
 * either so existing rules and new selections both match a catalog entry.
 */
function resolveAttribute(
  attributes: PromotionRuleAttribute[],
  key: string
): PromotionRuleAttribute | undefined {
  if (!key) return undefined
  return attributes.find((a) => a.value === key || a.id === key)
}

type BadgeTone = "grey" | "green" | "red" | "orange"

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  grey: "bg-grey-10 text-grey-70",
  green: "bg-emerald-50 text-emerald-800",
  red: "bg-rose-50 text-rose-800",
  orange: "bg-amber-50 text-amber-800",
}

/**
 * Replicates Medusa admin's getPromotionStatus: campaign schedule/budget can
 * override the promotion's own status with "Campaign scheduled" / "Campaign
 * expired" badges. Colors: draft=grey, active=green, inactive=red,
 * scheduled=orange, expired=red.
 */
function getPromotionStatusBadge(
  promotion: PromotionDetail,
  campaignDetail: CampaignListItem | null
): [BadgeTone, string] {
  const statusMap: Record<string, [BadgeTone, string]> = {
    active: ["green", "Active"],
    inactive: ["red", "Inactive"],
    draft: ["grey", "Draft"],
  }

  if (campaignDetail) {
    const now = new Date()
    if (
      campaignDetail.starts_at &&
      new Date(campaignDetail.starts_at) > now
    ) {
      return ["orange", "Campaign scheduled"]
    }
    const budget = campaignDetail.budget
    const overBudget =
      budget && budget.limit != null && (budget.used || 0) > budget.limit
    if (
      (campaignDetail.ends_at && new Date(campaignDetail.ends_at) < now) ||
      overBudget
    ) {
      return ["red", "Campaign expired"]
    }
  }

  return statusMap[promotion.status] || ["grey", promotion.status]
}

function conditionsTitle(
  ruleType: PromotionRuleType,
  targetType?: string | null
): string {
  if (ruleType === "rules") return "Who can use this code?"
  if (ruleType === "buy-rules")
    return "What needs to be in the cart to unlock the promotion?"
  if (targetType === "shipping_methods") {
    return "What shipping methods will the promotion be applied to?"
  }
  return "What items will the promotion be applied to?"
}

function conditionsDescription(
  ruleType: PromotionRuleType,
  targetType?: string | null
): string {
  if (ruleType === "rules") {
    return "Which customer is allowed to use the promotion code? Promotion code can be used by all customers if left untouched."
  }
  if (ruleType === "buy-rules") {
    return "If these conditions match, we enable the promotion on the target items."
  }
  if (targetType === "shipping_methods") {
    return "The promotion will be applied to shipping methods that match the following conditions."
  }
  return "The promotion will be applied to items that match the following conditions."
}

const RULES_MODAL_TITLES: Record<PromotionRuleType, string> = {
  rules: "Edit usage conditions",
  "target-rules": "Edit item conditions",
  "buy-rules": "Edit buy rules",
}

const RULE_TYPE_KEYS: Record<
  PromotionRuleType,
  "rules" | "target_rules" | "buy_rules"
> = {
  rules: "rules",
  "target-rules": "target_rules",
  "buy-rules": "buy_rules",
}

const INTERNAL_METADATA_KEYS = new Set(["tenant_id", "display_code"])

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-6 py-4">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-grey-90">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-6", bodyClassName)}>{children}</div>
    </div>
  )
}

function GeneralRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-4 px-6 py-4">
      <span className="text-sm font-medium text-grey-50">{label}</span>
      <div className="text-sm text-grey-90">{children}</div>
    </div>
  )
}

function RuleBlock({ rule }: { rule: PromotionRule }) {
  const labels = ruleValuesToArray(rule.values).map((v) => v.label || v.value)
  const shown = labels.slice(0, 2)
  const extra = labels.length - shown.length

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-base border border-grey-20 bg-grey-10 p-2 text-xs text-grey-70">
      <span className="shrink-0 rounded-full border border-grey-20 bg-white px-2 py-0.5 font-medium text-grey-90">
        {rule.attribute_label || rule.attribute}
      </span>
      <span className="shrink-0 px-0.5">{operatorLabel(rule)}</span>
      {shown.map((label, idx) => (
        <span
          key={`${label}-${idx}`}
          className="shrink-0 rounded-full border border-grey-20 bg-white px-2 py-0.5 font-medium text-grey-90"
        >
          {label}
        </span>
      ))}
      {extra > 0 && <span className="shrink-0 text-grey-50">+{extra} more</span>}
      {labels.length === 0 && <span className="text-grey-40">-</span>}
    </div>
  )
}

function ConditionsSection({
  title,
  description,
  rules,
  onEdit,
}: {
  title: string
  description: string
  rules: PromotionRule[]
  onEdit: () => void
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      action={
        <ActionMenu
          items={[{ label: "Edit", icon: PencilSquare, onClick: onEdit }]}
        />
      }
    >
      {rules.length === 0 ? (
        <div className="flex h-[180px] flex-col items-center justify-center rounded-base border border-dashed border-grey-20 px-4 text-center">
          <p className="text-sm font-medium text-grey-90">No records</p>
          <p className="mt-0.5 max-w-xs text-sm text-grey-50">
            Add a condition to restrict what items the promotion applies to.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-grey-90 hover:text-grey-60"
          >
            <Plus className="h-4 w-4" />
            Add condition
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <RuleBlock key={`${rule.id}-${rule.attribute}`} rule={rule} />
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function DateCard({ label, date }: { label: string; date?: string | null }) {
  const future = date ? new Date(date).getTime() > Date.now() : false
  return (
    <div className="flex items-stretch gap-3 rounded-base border border-grey-20 px-3 py-2">
      <div
        className={cn(
          "w-1 shrink-0 rounded-full",
          future ? "bg-amber-400" : "bg-grey-20"
        )}
      />
      <div className="min-w-0">
        <p className="text-xs text-grey-50">{label}</p>
        <p className="truncate text-sm font-medium text-grey-90">
          {formatDateTime(date)}
        </p>
      </div>
    </div>
  )
}

function ChoiceBox({
  checked,
  onSelect,
  title,
  description,
  disabled,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  description?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-base border p-3 text-left transition-colors",
        checked
          ? "border-grey-90 ring-1 ring-grey-90"
          : "border-grey-20 hover:bg-grey-10",
        disabled && "cursor-not-allowed opacity-50 hover:bg-white"
      )}
    >
      <span className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            checked ? "border-grey-90" : "border-grey-30"
          )}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-grey-90" />}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium text-grey-90">{title}</span>
          {description && (
            <span className="text-xs text-grey-50">{description}</span>
          )}
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Rule value picker (searchable multi/single select fed by listRuleValues)
// ---------------------------------------------------------------------------

function RuleValuePicker({
  token,
  ruleType,
  attribute,
  single,
  selected,
  labels,
  onChange,
}: {
  token: string
  ruleType: PromotionRuleType
  attribute: string
  single: boolean
  selected: string[]
  labels: Record<string, string>
  onChange: (values: string[], labels: Record<string, string>) => void
}) {
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<PromotionRuleValue[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    if (!attribute) return
    let cancelled = false
    setLoadingOptions(true)
    listRuleValues(token, ruleType, attribute, q.trim() || undefined)
      .then((res) => {
        if (!cancelled) setOptions(res.values || [])
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, ruleType, attribute, q])

  const toggle = (option: PromotionRuleValue) => {
    if (single) {
      onChange([option.value], { [option.value]: option.label })
      return
    }
    const next = new Set(selected)
    const nextLabels = { ...labels }
    if (next.has(option.value)) {
      next.delete(option.value)
      delete nextLabels[option.value]
    } else {
      next.add(option.value)
      nextLabels[option.value] = option.label
    }
    onChange(Array.from(next), nextLabels)
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-grey-20 bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-90"
            >
              {labels[value] || value}
              <button
                type="button"
                aria-label="Remove value"
                onClick={() => {
                  const next = selected.filter((v) => v !== value)
                  const nextLabels = { ...labels }
                  delete nextLabels[value]
                  onChange(next, nextLabels)
                }}
                className="text-grey-50 hover:text-grey-90"
              >
                <XMark className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        placeholder="Search values..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
        {loadingOptions ? (
          <p className="px-2 py-2 text-sm text-grey-40">Loading...</p>
        ) : options.length === 0 ? (
          <p className="px-2 py-2 text-sm text-grey-40">No matches.</p>
        ) : (
          options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-1.5 text-sm hover:bg-grey-10"
            >
              <input
                type={single ? "radio" : "checkbox"}
                checked={selected.includes(option.value)}
                onChange={() => toggle(option)}
              />
              <span className="truncate text-grey-90">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rules editor modal (shared for rules | target-rules | buy-rules)
// ---------------------------------------------------------------------------

type RuleRow = {
  key: string
  id?: string
  attribute: string
  operator: string
  values: string[]
  labels: Record<string, string>
  error?: string
}

let ruleRowSeq = 0
function nextRowKey(): string {
  ruleRowSeq += 1
  return `rule-row-${ruleRowSeq}`
}

function RulesEditorModal({
  open,
  onClose,
  token,
  promotion,
  ruleType,
  onSaved,
  onError,
}: {
  open: boolean
  onClose: () => void
  token: string
  promotion: PromotionDetail
  ruleType: PromotionRuleType
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [attributes, setAttributes] = useState<PromotionRuleAttribute[]>([])
  const [attributesLoading, setAttributesLoading] = useState(false)
  const [rows, setRows] = useState<RuleRow[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const targetType = promotion.application_method?.target_type

  useEffect(() => {
    if (!open) return

    // Seed rows from the promotion's existing rules for this rule type.
    const existing = promotion[RULE_TYPE_KEYS[ruleType]] || []
    setRows(
      existing.map((rule) => {
        // values can be the RAW NUMBER for disguised number rules — normalize
        const values = ruleValuesToArray(rule.values)
        return {
          key: nextRowKey(),
          // disguised rules have id: null — treated as creates on save, which
          // the backend maps back onto the application method
          id: rule.id ?? undefined,
          attribute: rule.attribute,
          operator: rule.operator,
          values: values.map((v) => v.value),
          labels: Object.fromEntries(
            values.map((v) => [v.value, v.label || v.value])
          ),
        }
      })
    )
    setRemovedIds([])
    setFormError(null)

    setAttributesLoading(true)
    listRuleAttributes(token, ruleType, promotion.type)
      .then((res) => setAttributes(res.attributes || []))
      .catch((err) => {
        setAttributes([])
        setFormError(
          err instanceof Error ? err.message : "Failed to load attributes"
        )
      })
      .finally(() => setAttributesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleType, promotion.id])

  // De-duplicate on the canonical attribute VALUE path: existing rules store
  // the full value path while new selections also emit it, but resolve via
  // the catalog so id/value aliases of the same attribute collide correctly.
  const usedAttributeValues = useMemo(() => {
    const used = new Set<string>()
    for (const row of rows) {
      if (!row.attribute) continue
      const def = resolveAttribute(attributes, row.attribute)
      used.add(def?.value ?? row.attribute)
    }
    return used
  }, [rows, attributes])

  function updateRow(key: string, patch: Partial<RuleRow>) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    )
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextRowKey(), attribute: "", operator: "", values: [], labels: {} },
    ])
  }

  function removeRow(row: RuleRow) {
    if (row.id) setRemovedIds((prev) => [...prev, row.id!])
    setRows((prev) => prev.filter((r) => r.key !== row.key))
  }

  function clearAll() {
    setRemovedIds((prev) => [
      ...prev,
      ...rows.filter((r) => r.id).map((r) => r.id!),
    ])
    setRows([])
  }

  async function handleSave() {
    const isIncomplete = (row: RuleRow) =>
      !row.attribute || !row.operator || row.values.length === 0
    if (rows.some(isIncomplete)) {
      setRows((prev) =>
        prev.map((row) =>
          isIncomplete(row) ? { ...row, error: "Required" } : row
        )
      )
      return
    }

    // The backend validates rule attributes against the attribute VALUE path
    // (e.g. "items.product.id"), never the short id — canonicalize on send.
    const canonicalAttribute = (attribute: string) =>
      resolveAttribute(attributes, attribute)?.value ?? attribute

    const ops: UpdatePromotionRulesOps = {}
    const creates = rows
      .filter((r) => !r.id)
      .map((r) => ({
        attribute: canonicalAttribute(r.attribute),
        operator: r.operator as PromotionRuleOperator,
        values: r.values,
      }))
    const updates = rows
      .filter((r) => r.id)
      .map((r) => ({
        id: r.id!,
        attribute: canonicalAttribute(r.attribute),
        operator: r.operator as PromotionRuleOperator,
        values: r.values,
      }))
    if (creates.length) ops.create = creates
    if (updates.length) ops.update = updates
    if (removedIds.length) ops.delete = removedIds

    if (!ops.create && !ops.update && !ops.delete) {
      onClose()
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await updatePromotionRules(token, promotion.id, ruleType, ops)
      await onSaved()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save conditions"
      setFormError(message)
      onError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={RULES_MODAL_TITLES[ruleType]}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-grey-90">
              {conditionsTitle(ruleType, targetType)}
            </p>
            <p className="mt-0.5 text-sm text-grey-50">
              {conditionsDescription(ruleType, targetType)}
            </p>
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 text-sm font-medium text-grey-60 hover:text-grey-90"
            >
              Clear all
            </button>
          )}
        </div>

        {formError && (
          <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ExclamationCircle className="h-4 w-4" />
            {formError}
          </div>
        )}

        {attributesLoading ? (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-base bg-grey-10" />
            <div className="h-16 animate-pulse rounded-base bg-grey-10" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-base border border-dashed border-grey-20 p-6 text-center">
            <p className="text-sm font-medium text-grey-80">No conditions</p>
            <p className="mt-0.5 text-sm text-grey-50">
              Add a condition to restrict what items the promotion applies to.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              // Existing rules carry the full attribute value path; resolve by
              // value OR id so both match the catalog.
              const attributeDef = resolveAttribute(attributes, row.attribute)
              const attributeValue = attributeDef?.value ?? row.attribute
              const single = row.operator !== "" && row.operator !== "in"
              return (
                <React.Fragment key={row.key}>
                  {idx > 0 && (
                    <p className="text-center text-xs font-semibold uppercase tracking-wide text-grey-40">
                      AND
                    </p>
                  )}
                  <div
                    className={cn(
                      "space-y-3 rounded-base border p-4",
                      row.error ? "border-rose-300" : "border-grey-20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <FormField label="Attribute">
                          <Select
                            value={attributeValue}
                            onChange={(e) => {
                              const attribute = e.target.value
                              const def = resolveAttribute(
                                attributes,
                                attribute
                              )
                              updateRow(row.key, {
                                attribute,
                                operator: def?.operators[0]?.id || "",
                                values: [],
                                labels: {},
                              })
                            }}
                          >
                            <option value="">Select Attribute</option>
                            {attributes.map((attr) => (
                              <option
                                key={attr.value}
                                value={attr.value}
                                disabled={
                                  attr.value !== attributeValue &&
                                  usedAttributeValues.has(attr.value)
                                }
                              >
                                {attr.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Operator">
                          <Select
                            value={row.operator}
                            onChange={(e) => {
                              const operator = e.target.value
                              updateRow(row.key, {
                                operator,
                                values:
                                  operator !== "in" && row.values.length > 1
                                    ? row.values.slice(0, 1)
                                    : row.values,
                              })
                            }}
                            disabled={!row.attribute}
                          >
                            <option value="">Select operator</option>
                            {(attributeDef?.operators || []).map((op) => (
                              <option key={op.id} value={op.id}>
                                {op.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove condition"
                        onClick={() => removeRow(row)}
                        className="mt-7 rounded-base p-1.5 text-grey-50 hover:bg-grey-10 hover:text-grey-90"
                      >
                        <XMark className="h-4 w-4" />
                      </button>
                    </div>

                    {row.attribute && row.operator && (
                      <FormField label="Values">
                        {attributeDef?.field_type === "number" ? (
                          // Number attributes (buy_rules_min_quantity /
                          // apply_to_quantity) have no option list — plain input
                          <Input
                            type="number"
                            min={1}
                            value={row.values[0] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value
                              updateRow(row.key, {
                                values: value === "" ? [] : [value],
                                labels: value === "" ? {} : { [value]: value },
                              })
                            }}
                          />
                        ) : (
                          <RuleValuePicker
                            token={token}
                            ruleType={ruleType}
                            attribute={attributeValue}
                            single={single}
                            selected={row.values}
                            labels={row.labels}
                            onChange={(values, labels) =>
                              updateRow(row.key, { values, labels })
                            }
                          />
                        )}
                      </FormField>
                    )}

                    {row.error && (
                      <p className="text-xs text-red-600">{row.error}</p>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
        >
          <Plus className="h-4 w-4" />
          Add condition
        </button>

        <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type EditForm = {
  status: "draft" | "active" | "inactive"
  is_automatic: boolean
  is_tax_inclusive: boolean
  code: string
  value_type: "fixed" | "percentage"
  value: string
  allocation: "each" | "across"
  max_quantity: string
  starts_at: string
  ends_at: string
}

export default function PromotionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [promotion, setPromotion] = useState<PromotionDetail | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showJson, setShowJson] = useState(false)

  // Edit promotion details modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    status: "draft",
    is_automatic: false,
    is_tax_inclusive: false,
    code: "",
    value_type: "percentage",
    value: "",
    allocation: "each",
    max_quantity: "",
    starts_at: "",
    ends_at: "",
  })
  const [editError, setEditError] = useState<string | null>(null)

  // Delete prompt
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Campaign modal
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaignChoice, setCampaignChoice] = useState<"none" | "existing">(
    "none"
  )
  const [campaignId, setCampaignId] = useState("")
  const [campaignSearch, setCampaignSearch] = useState("")
  const [campaignError, setCampaignError] = useState<string | null>(null)

  // Rules editor
  const [rulesModal, setRulesModal] = useState<{
    open: boolean
    ruleType: PromotionRuleType
  }>({ open: false, ruleType: "rules" })

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getPromotion(token, id)
      setPromotion(res.promotion)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load promotion")
    } finally {
      setLoading(false)
    }
  }

  async function reload() {
    if (!token || !id) return
    try {
      const res = await getPromotion(token, id)
      setPromotion(res.promotion)
    } catch {
      // keep the currently rendered data on transient refetch failures
    }
  }

  async function loadCampaigns() {
    if (!token) return
    try {
      const res = await listCampaigns(token, { limit: 100 })
      setCampaigns(res.campaigns || [])
    } catch {
      setCampaigns([])
    }
  }

  useEffect(() => {
    load()
    loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  async function run(
    key: string,
    fn: () => Promise<unknown>,
    okMsg: string
  ): Promise<boolean> {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await Promise.all([reload(), loadCampaigns()])
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  const campaignDetail = useMemo(
    () =>
      promotion?.campaign
        ? campaigns.find((c) => c.id === promotion.campaign!.id) || null
        : null,
    [promotion, campaigns]
  )

  // ---- copy code ----
  async function copyCode() {
    if (!promotion) return
    try {
      await navigator.clipboard.writeText(promotion.display_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showMessage("error", "Could not copy the code to the clipboard")
    }
  }

  // ---- edit promotion details ----
  function openEdit() {
    if (!promotion) return
    const method = promotion.application_method
    setEditForm({
      status: promotion.status,
      is_automatic: promotion.is_automatic,
      is_tax_inclusive: Boolean(promotion.is_tax_inclusive),
      code: promotion.display_code,
      value_type: method?.type === "fixed" ? "fixed" : "percentage",
      value: method?.value != null ? String(method.value) : "",
      allocation: method?.allocation === "across" ? "across" : "each",
      max_quantity:
        method?.max_quantity != null ? String(method.max_quantity) : "",
      starts_at: toDatetimeLocal(promotion.starts_at),
      ends_at: toDatetimeLocal(promotion.ends_at),
    })
    setEditError(null)
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !promotion) return
    setEditError(null)

    const code = editForm.code.trim()
    if (!code) {
      setEditError("Code is required")
      return
    }

    const payload: UpdatePromotionInput = {
      display_code: code,
      status: editForm.status,
      is_automatic: editForm.is_automatic,
      starts_at: editForm.starts_at
        ? new Date(editForm.starts_at).toISOString()
        : null,
      ends_at: editForm.ends_at
        ? new Date(editForm.ends_at).toISOString()
        : null,
    }

    const method = promotion.application_method
    if (method && method.target_type !== "shipping_methods") {
      const value = parseFloat(editForm.value)
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        (editForm.value_type === "percentage" && value > 100)
      ) {
        setEditError("Invalid promotion value")
        return
      }
      const applicationMethod: UpdatePromotionInput["application_method"] = {
        type: editForm.value_type,
        value,
      }
      if (editForm.value_type === "fixed" && method.currency_code) {
        applicationMethod.currency_code = method.currency_code
      }
      if (method.target_type === "items") {
        applicationMethod.allocation = editForm.allocation
        if (editForm.allocation === "each") {
          const maxQuantity = parseInt(editForm.max_quantity, 10)
          applicationMethod.max_quantity =
            Number.isFinite(maxQuantity) && maxQuantity >= 1
              ? maxQuantity
              : null
        } else {
          applicationMethod.max_quantity = null
        }
      }
      payload.application_method = applicationMethod
      payload.is_tax_inclusive =
        editForm.value_type === "fixed" && promotion.type === "standard"
          ? editForm.is_tax_inclusive
          : false
    }

    const ok = await run(
      "save-edit",
      () => updatePromotion(token, promotion.id, payload),
      "Promotion updated."
    )
    if (ok) setEditOpen(false)
  }

  // ---- delete ----
  function openDelete() {
    setDeleteConfirm("")
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!token || !promotion) return
    if (deleteConfirm !== promotion.display_code) return
    setBusy("delete")
    try {
      await deletePromotion(token, promotion.id)
      router.push("/dashboard/promotions")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to delete promotion"
      )
      setBusy(null)
    }
  }

  // ---- campaign ----
  function openCampaignModal() {
    if (!promotion) return
    setCampaignChoice(promotion.campaign ? "existing" : "none")
    setCampaignId(promotion.campaign?.id || "")
    setCampaignSearch("")
    setCampaignError(null)
    setCampaignOpen(true)
  }

  async function saveCampaign() {
    if (!token || !promotion) return
    if (campaignChoice === "existing" && !campaignId) {
      setCampaignError("Select a campaign")
      return
    }
    setCampaignError(null)
    const ok = await run(
      "save-campaign",
      () =>
        updatePromotion(token, promotion.id, {
          campaign_id: campaignChoice === "none" ? null : campaignId,
        }),
      "Successfully updated the campaign of the promotion."
    )
    if (ok) setCampaignOpen(false)
  }

  // ---- render ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-40 animate-pulse rounded-base bg-grey-10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-52 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-52 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-52 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !promotion) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/promotions")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to promotions
        </button>
        <EmptyState
          icon={ReceiptPercent}
          title="Promotion not found"
          description={
            error ||
            "This promotion does not exist or you do not have access to it."
          }
        />
      </div>
    )
  }

  const method = promotion.application_method
  const [statusTone, statusText] = getPromotionStatusBadge(
    promotion,
    campaignDetail
  )
  const displayValue =
    method?.value != null
      ? method.type === "fixed"
        ? method.currency_code
          ? formatMoney(method.value, method.currency_code)
          : null
        : method.type === "percentage"
        ? `${method.value}%`
        : null
      : null

  const originalAllocation = method?.allocation || null
  const acrossDisabled =
    originalAllocation === "each" || originalAllocation === "once"
  const eachDisabled = originalAllocation === "across"

  const filteredCampaigns = campaigns.filter((c) => {
    const term = campaignSearch.trim().toLowerCase()
    if (!term) return true
    return (
      c.name.toLowerCase().includes(term) ||
      (c.campaign_identifier_display || "").toLowerCase().includes(term)
    )
  })
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null

  const metadataEntries = Object.entries(promotion.metadata || {}).filter(
    ([key]) => !INTERNAL_METADATA_KEYS.has(key)
  )

  const campaignMenuItems = [
    ...(promotion.campaign
      ? [
          {
            label: "Go to campaign",
            icon: ArrowUpRightOnBox,
            onClick: () =>
              router.push(`/dashboard/campaigns/${promotion.campaign!.id}`),
          },
        ]
      : []),
    { label: "Edit", icon: PencilSquare, onClick: openCampaignModal },
  ]

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/promotions")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to promotions
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" ? (
            <ExclamationCircle className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <TwoColumnLayout
        sidebar={
          <>
            {/* Campaign */}
            <SectionCard
              title="Campaign"
              action={<ActionMenu items={campaignMenuItems} />}
            >
              {promotion.campaign ? (
                <div className="flex flex-col gap-y-3">
                  <p className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium text-grey-90">
                      {promotion.campaign.name}
                    </span>
                    {campaignDetail?.campaign_identifier_display && (
                      <>
                        <span className="text-grey-40">·</span>
                        <span className="text-grey-50">
                          {campaignDetail.campaign_identifier_display}
                        </span>
                      </>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    <DateCard
                      label="Start date"
                      date={campaignDetail?.starts_at}
                    />
                    <DateCard label="End date" date={campaignDetail?.ends_at} />
                  </div>
                </div>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center rounded-base border border-dashed border-grey-20 px-4 text-center">
                  <p className="text-sm font-medium text-grey-90">
                    Not part of a campaign
                  </p>
                  <p className="mt-0.5 text-sm text-grey-50">
                    Add this promotion to an existing campaign
                  </p>
                  <button
                    type="button"
                    onClick={openCampaignModal}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-grey-90 hover:text-grey-60"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Campaign
                  </button>
                </div>
              )}
            </SectionCard>

            {/* Dates */}
            {(promotion.starts_at || promotion.ends_at) && (
              <SectionCard
                title="Dates"
                action={
                  <button
                    type="button"
                    onClick={openEdit}
                    className="text-sm font-medium text-grey-60 hover:text-grey-90"
                  >
                    Edit
                  </button>
                }
              >
                <div className="flex flex-col gap-2">
                  <DateCard label="Start date" date={promotion.starts_at} />
                  <DateCard label="End date" date={promotion.ends_at} />
                </div>
              </SectionCard>
            )}

            {/* Metadata */}
            {metadataEntries.length > 0 && (
              <SectionCard title="Metadata">
                <dl className="divide-y divide-grey-10">
                  {metadataEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between gap-4 py-2 text-sm"
                    >
                      <dt className="text-grey-50">{key}</dt>
                      <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>
            )}

            {/* JSON */}
            <Card bodyClassName="p-0">
              <button
                type="button"
                onClick={() => setShowJson((s) => !s)}
                className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
              >
                Raw promotion data (JSON)
                <span className="text-grey-40">
                  {showJson ? "Hide" : "Show"}
                </span>
              </button>
              {showJson && (
                <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-6 py-4 text-xs text-grey-70">
                  {JSON.stringify(promotion, null, 2)}
                </pre>
              )}
            </Card>
          </>
        }
      >
        {/* General */}
        <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-grey-90">
                {promotion.display_code}
              </h1>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy promotion code"
                title="Copy promotion code"
                className="rounded-base p-1 text-grey-50 hover:bg-grey-10 hover:text-grey-90"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <SquareTwoStack className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  BADGE_TONE_CLASSES[statusTone]
                )}
              >
                {statusText}
              </span>
              <ActionMenu
                items={[
                  { label: "Edit", icon: PencilSquare, onClick: openEdit },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: openDelete,
                  },
                ]}
              />
            </div>
          </div>

          <div className="divide-y divide-grey-10 border-t border-grey-10">
            {/* NOTE: Medusa labels this row "Campaign" but renders the METHOD
                (Automatic vs Promotion code) — replicated as-is per spec. */}
            <GeneralRow label="Campaign">
              {promotion.is_automatic ? "Automatic" : "Promotion code"}
            </GeneralRow>

            <GeneralRow label="Code">
              <button
                type="button"
                onClick={copyCode}
                title="Copy promotion code"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-grey-20 bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-90 hover:bg-grey-20"
              >
                <span className="truncate">{promotion.display_code}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <SquareTwoStack className="h-3.5 w-3.5 text-grey-50" />
                )}
              </button>
            </GeneralRow>

            <GeneralRow label="Type">
              <span className="capitalize">{promotion.type}</span>
            </GeneralRow>

            <GeneralRow label="Value">
              <span className="inline-flex items-center gap-2">
                <span>{displayValue || "-"}</span>
                {method?.type === "fixed" && method.currency_code && (
                  <span className="rounded-full border border-grey-20 bg-grey-10 px-2 py-0.5 text-xs font-medium uppercase text-grey-70">
                    {method.currency_code.toUpperCase()}
                  </span>
                )}
              </span>
            </GeneralRow>

            <GeneralRow label="Allocation">
              {method?.allocation ? (
                <span className="capitalize">{method.allocation}</span>
              ) : (
                "-"
              )}
            </GeneralRow>

            {method?.type === "fixed" && (
              <GeneralRow label="Tax Inclusive">
                {promotion.is_tax_inclusive ? "True" : "False"}
              </GeneralRow>
            )}

            {typeof promotion.limit === "number" && (
              <GeneralRow label="Usage Limit">
                {`${promotion.used || 0} / ${promotion.limit}`}
              </GeneralRow>
            )}
          </div>
        </div>

        {/* Who can use this code? */}
        <ConditionsSection
          title={conditionsTitle("rules")}
          description={conditionsDescription("rules")}
          rules={promotion.rules || []}
          onEdit={() => setRulesModal({ open: true, ruleType: "rules" })}
        />

        {/* Target rules */}
        <ConditionsSection
          title={conditionsTitle("target-rules", method?.target_type)}
          description={conditionsDescription(
            "target-rules",
            method?.target_type
          )}
          rules={promotion.target_rules || []}
          onEdit={() => setRulesModal({ open: true, ruleType: "target-rules" })}
        />

        {/* Buy rules (buyget only) */}
        {promotion.type === "buyget" && (
          <ConditionsSection
            title={conditionsTitle("buy-rules")}
            description={conditionsDescription("buy-rules")}
            rules={promotion.buy_rules || []}
            onEdit={() => setRulesModal({ open: true, ruleType: "buy-rules" })}
          />
        )}
      </TwoColumnLayout>

      {/* Edit Promotion Details */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Promotion Details"
        size="md"
      >
        <form onSubmit={saveEdit} className="space-y-6">
          {editError && (
            <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <ExclamationCircle className="h-4 w-4" />
              {editError}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-grey-70">Status</p>
            <div className="space-y-2">
              <ChoiceBox
                checked={editForm.status === "draft"}
                onSelect={() =>
                  setEditForm((f) => ({ ...f, status: "draft" }))
                }
                title="Draft"
                description="Customers will not be able to use the code yet"
              />
              <ChoiceBox
                checked={editForm.status === "active"}
                onSelect={() =>
                  setEditForm((f) => ({ ...f, status: "active" }))
                }
                title="Active"
                description="Customers will be able to use the code"
              />
              <ChoiceBox
                checked={editForm.status === "inactive"}
                onSelect={() =>
                  setEditForm((f) => ({ ...f, status: "inactive" }))
                }
                title="Inactive"
                description="Customers will no longer be able to use the code"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-grey-70">Method</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceBox
                checked={!editForm.is_automatic}
                onSelect={() =>
                  setEditForm((f) => ({ ...f, is_automatic: false }))
                }
                title="Promotion code"
                description="Customers must enter this code at checkout"
              />
              <ChoiceBox
                checked={editForm.is_automatic}
                onSelect={() =>
                  setEditForm((f) => ({ ...f, is_automatic: true }))
                }
                title="Automatic"
                description="Customers will see this promotion at checkout"
              />
            </div>
          </div>

          {editForm.value_type === "fixed" &&
            promotion.type === "standard" &&
            method?.target_type !== "shipping_methods" && (
              <FormToggle
                checked={editForm.is_tax_inclusive}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, is_tax_inclusive: value }))
                }
                label="Does promotion include taxes?"
                description="Enable this field to apply the promotion after taxes"
              />
            )}

          <FormField
            label="Code"
            htmlFor="promo-code"
            hint="The code your customers will enter during checkout."
          >
            <Input
              id="promo-code"
              value={editForm.code}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, code: e.target.value }))
              }
              placeholder="SUMMER15"
              required
            />
          </FormField>

          {method && method.target_type !== "shipping_methods" && (
            <>
              <div>
                <p className="mb-1.5 text-sm font-medium text-grey-70">
                  Value Type
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceBox
                    checked={editForm.value_type === "fixed"}
                    onSelect={() =>
                      setEditForm((f) => ({ ...f, value_type: "fixed" }))
                    }
                    title="Fixed amount"
                    description="Discount by a fixed amount"
                  />
                  <ChoiceBox
                    checked={editForm.value_type === "percentage"}
                    onSelect={() =>
                      setEditForm((f) => ({ ...f, value_type: "percentage" }))
                    }
                    title="Percentage"
                    description="Discount by a percentage"
                  />
                </div>
              </div>

              <FormField
                label={
                  editForm.value_type === "fixed" ? "Amount" : "Percentage"
                }
                htmlFor="promo-value"
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="promo-value"
                    type="number"
                    min={0}
                    max={
                      editForm.value_type === "percentage" ? 100 : undefined
                    }
                    step={editForm.value_type === "fixed" ? "0.01" : "1"}
                    value={editForm.value}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, value: e.target.value }))
                    }
                    placeholder={
                      editForm.value_type === "fixed" ? "10.00" : "15"
                    }
                  />
                  <span className="shrink-0 text-sm font-medium uppercase text-grey-50">
                    {editForm.value_type === "fixed"
                      ? (method.currency_code || "usd").toUpperCase()
                      : "%"}
                  </span>
                </div>
              </FormField>

              {method.target_type === "items" && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-grey-70">
                    Allocation
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ChoiceBox
                      checked={editForm.allocation === "each"}
                      onSelect={() =>
                        setEditForm((f) => ({ ...f, allocation: "each" }))
                      }
                      title="Each"
                      description="Applies value on each item"
                      disabled={eachDisabled}
                    />
                    <ChoiceBox
                      checked={editForm.allocation === "across"}
                      onSelect={() =>
                        setEditForm((f) => ({ ...f, allocation: "across" }))
                      }
                      title="Across"
                      description="Applies value across items"
                      disabled={acrossDisabled}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-grey-50">
                    Each enforces the quantity limit per item, while Once
                    enforces the quantity limit across the entire cart
                  </p>
                </div>
              )}

              {method.target_type === "items" &&
                editForm.allocation === "each" && (
                  <FormField
                    label="Maximum Quantity"
                    htmlFor="promo-max-quantity"
                    hint="Maximum quantity of items this promotion applies to."
                  >
                    <Input
                      id="promo-max-quantity"
                      type="number"
                      min={1}
                      value={editForm.max_quantity}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          max_quantity: e.target.value,
                        }))
                      }
                      placeholder="3"
                    />
                  </FormField>
                )}
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date" htmlFor="promo-starts-at">
              <Input
                id="promo-starts-at"
                type="datetime-local"
                value={editForm.starts_at}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, starts_at: e.target.value }))
                }
              />
            </FormField>
            <FormField label="End date" htmlFor="promo-ends-at">
              <Input
                id="promo-ends-at"
                type="datetime-local"
                value={editForm.ends_at}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, ends_at: e.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-edit" || !editForm.code.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-edit" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete prompt */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Are you sure?"
        description={`You are about to delete the promotion ${promotion.display_code}. This action cannot be undone.`}
        size="sm"
      >
        <div className="space-y-4">
          <FormField
            label={`Please type ${promotion.display_code} to confirm:`}
            htmlFor="promo-delete-confirm"
          >
            <Input
              id="promo-delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={promotion.display_code}
              autoComplete="off"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={
                busy === "delete" || deleteConfirm !== promotion.display_code
              }
              className="inline-flex items-center rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Campaign (add-to-campaign) */}
      <Modal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title="Edit Campaign"
        size="md"
      >
        <div className="space-y-4">
          {campaignError && (
            <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <ExclamationCircle className="h-4 w-4" />
              {campaignError}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceBox
              checked={campaignChoice === "none"}
              onSelect={() => setCampaignChoice("none")}
              title="Without Campaign"
              description="Proceed without associating promotion with campaign"
            />
            <ChoiceBox
              checked={campaignChoice === "existing"}
              onSelect={() => {
                setCampaignChoice("existing")
                setCampaignId(promotion.campaign?.id || "")
              }}
              title="Existing Campaign"
              description="Add promotion to an existing campaign."
            />
          </div>

          {campaignChoice === "existing" && (
            <div className="space-y-2">
              <FormField
                label="Campaign"
                htmlFor="promo-campaign-search"
                hint="Disabled campaigns have budget in a different currency than the promotion."
              >
                <Input
                  id="promo-campaign-search"
                  placeholder="Search campaigns..."
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                />
              </FormField>
              <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
                {campaigns.length === 0 ? (
                  <div className="px-2 py-3 text-center">
                    <p className="text-sm font-medium text-grey-80">
                      No existing campaigns
                    </p>
                    <p className="mt-0.5 text-xs text-grey-50">
                      You can create one to track multiple promotions and set
                      budget limits.
                    </p>
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-grey-40">No matches.</p>
                ) : (
                  filteredCampaigns.map((campaign) => {
                    const disabled = Boolean(
                      campaign.budget?.currency_code &&
                        promotion.currency_code &&
                        campaign.budget.currency_code.toLowerCase() !==
                          promotion.currency_code.toLowerCase()
                    )
                    return (
                      <label
                        key={campaign.id}
                        className={cn(
                          "flex items-center gap-2 rounded-base px-2 py-1.5 text-sm",
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-grey-10"
                        )}
                      >
                        <input
                          type="radio"
                          name="promo-campaign"
                          checked={campaignId === campaign.id}
                          disabled={disabled}
                          onChange={() => setCampaignId(campaign.id)}
                        />
                        <span className="truncate font-medium uppercase text-grey-90">
                          {campaign.name}
                        </span>
                        {campaign.campaign_identifier_display && (
                          <span className="truncate text-xs text-grey-50">
                            {campaign.campaign_identifier_display}
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {campaignChoice === "existing" && selectedCampaign && (
            <div className="space-y-4 rounded-base border border-grey-20 bg-grey-10 p-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-grey-90">
                  Campaign details
                </p>
                <dl className="space-y-1.5 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Identifier</dt>
                    <dd className="text-grey-90">
                      {selectedCampaign.campaign_identifier_display || "-"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Description</dt>
                    <dd className="text-grey-90">
                      {selectedCampaign.description || "-"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Start date</dt>
                    <dd className="text-grey-90">
                      {formatDateTime(selectedCampaign.starts_at)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">End date</dt>
                    <dd className="text-grey-90">
                      {formatDateTime(selectedCampaign.ends_at)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-grey-90">
                  Campaign budget
                </p>
                <dl className="space-y-1.5 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Type</dt>
                    <dd className="text-grey-90">
                      {selectedCampaign.budget
                        ? selectedCampaign.budget.type === "spend"
                          ? "Spend"
                          : "Usage"
                        : "-"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Currency</dt>
                    <dd className="uppercase text-grey-90">
                      {selectedCampaign.budget?.currency_code
                        ? selectedCampaign.budget.currency_code.toUpperCase()
                        : "-"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Limit</dt>
                    <dd className="text-grey-90">
                      {selectedCampaign.budget?.limit != null
                        ? selectedCampaign.budget.type === "spend" &&
                          selectedCampaign.budget.currency_code
                          ? formatMoney(
                              selectedCampaign.budget.limit,
                              selectedCampaign.budget.currency_code
                            )
                          : String(selectedCampaign.budget.limit)
                        : "-"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <dt className="text-grey-50">Used</dt>
                    <dd className="text-grey-90">
                      {selectedCampaign.budget?.used != null
                        ? selectedCampaign.budget.type === "spend" &&
                          selectedCampaign.budget.currency_code
                          ? formatMoney(
                              selectedCampaign.budget.used,
                              selectedCampaign.budget.currency_code
                            )
                          : String(selectedCampaign.budget.used)
                        : "-"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              type="button"
              onClick={() => setCampaignOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCampaign}
              disabled={
                busy === "save-campaign" ||
                (campaignChoice === "existing" && !campaignId)
              }
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-campaign" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rules editor */}
      {token && (
        <RulesEditorModal
          open={rulesModal.open}
          onClose={() => setRulesModal((m) => ({ ...m, open: false }))}
          token={token}
          promotion={promotion}
          ruleType={rulesModal.ruleType}
          onSaved={async () => {
            showMessage("success", "Conditions updated.")
            await reload()
          }}
          onError={(msg) => showMessage("error", msg)}
        />
      )}
    </div>
  )
}
