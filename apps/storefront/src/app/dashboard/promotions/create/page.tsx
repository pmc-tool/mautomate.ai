"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDownMini,
  ExclamationCircle,
  MagnifyingGlassMini,
  Plus,
  XMarkMini,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"
import {
  createPromotion,
  listCampaigns,
  listRuleAttributes,
  listRuleValues,
  listStoreCurrencies,
  ApiError,
  CampaignListItem,
  CreatePromotionPayload,
  PromotionRuleAttribute,
  PromotionRuleInput,
  PromotionRuleValueOption,
} from "../../../../lib/merchant-admin/api"

type StepId = "type" | "details" | "conditions" | "campaign"
type RuleGroupKey = "rules" | "target-rules" | "buy-rules"
type PromotionType = "standard" | "buyget"
type ValueType = "fixed" | "percentage"
type TargetType = "order" | "items" | "shipping_methods"
type Allocation = "each" | "across"

const STEP_ORDER: StepId[] = ["type", "details", "conditions", "campaign"]

const STEPS: { id: StepId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "details", label: "Details" },
  { id: "conditions", label: "Conditions" },
  { id: "campaign", label: "Campaign" },
]

type RuleRow = {
  key: string
  // Backend attribute identifier — the catalog `value` field (e.g.
  // "items.product.id"), NOT the display `id` ("product"): the create route's
  // whitelist (invalidRuleAttribute) only accepts attribute values.
  attribute: string
  operator: string
  values: string[]
  required?: boolean
}

type TemplateDef = {
  id: string
  title: string
  description: string
  hiddenFields: string[]
  defaults: {
    type: PromotionType
    valueType: ValueType
    targetType: TargetType
    allocation: Allocation
    value: string
    maxQuantity: string
    applyToQuantity: string
    buyRulesMinQuantity: string
  }
}

// Mirrors Medusa admin promotion-create templates (allocation "once" and the
// tax-inclusive switch are omitted: they are not part of the merchant API
// contract). Each template resets the form and fixes hidden fields.
const TEMPLATES: TemplateDef[] = [
  {
    id: "amount_off_products",
    title: "Amount off products",
    description: "Discount specific products or collection of products",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.allocation.across",
    ],
    defaults: {
      type: "standard",
      valueType: "fixed",
      targetType: "items",
      allocation: "each",
      value: "",
      maxQuantity: "1",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
  {
    id: "amount_off_order",
    title: "Amount off order",
    description: "Discounts the total order amount",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.allocation",
    ],
    defaults: {
      type: "standard",
      valueType: "fixed",
      targetType: "order",
      allocation: "across",
      value: "",
      maxQuantity: "",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
  {
    id: "percentage_off_product",
    title: "Percentage off product",
    description: "Discounts a percentage off selected products",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.allocation.across",
    ],
    defaults: {
      type: "standard",
      valueType: "percentage",
      targetType: "items",
      allocation: "each",
      value: "",
      maxQuantity: "1",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
  {
    id: "percentage_off_order",
    title: "Percentage off order",
    description: "Discounts a percentage of the total order amount",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.allocation",
    ],
    defaults: {
      type: "standard",
      valueType: "percentage",
      targetType: "order",
      allocation: "across",
      value: "",
      maxQuantity: "",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
  {
    id: "buy_get",
    title: "Buy X Get Y",
    description: "Buy X product(s), get Y product(s)",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.value",
      "application_method.allocation",
    ],
    defaults: {
      type: "buyget",
      valueType: "percentage",
      targetType: "items",
      allocation: "each",
      value: "100",
      maxQuantity: "1",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
  {
    id: "shipping_discount",
    title: "Free shipping",
    description: "Applies a 100% discount to shipping fees",
    hiddenFields: [
      "type",
      "application_method.type",
      "application_method.value",
      "application_method.allocation",
    ],
    defaults: {
      type: "standard",
      valueType: "percentage",
      targetType: "shipping_methods",
      allocation: "across",
      value: "100",
      maxQuantity: "",
      applyToQuantity: "1",
      buyRulesMinQuantity: "1",
    },
  },
]

// Medusa admin's requiredProductRule constant (rules-form-field/constants.ts):
// buyget promotions seed a required Product rule with this attribute+operator.
const REQUIRED_PRODUCT_ATTRIBUTE = "items.product.id"
const REQUIRED_PRODUCT_OPERATOR = "eq"

function makeRowKey(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function currencySymbol(code: string): string {
  if (!code) return "$"
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code.toUpperCase(),
    }).formatToParts(0)
    return parts.find((p) => p.type === "currency")?.symbol || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function ChoiceBox({
  checked,
  onSelect,
  label,
  description,
  className,
}: {
  checked: boolean
  onSelect: () => void
  label: string
  description: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-large border p-4 text-left transition-colors",
        checked
          ? "border-grey-90 bg-grey-5 shadow-borders-base"
          : "border-grey-20 bg-white hover:border-grey-40",
        className
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-grey-90" : "border-grey-30"
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-grey-90" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-grey-90">{label}</span>
        <span className="text-xs text-grey-50">{description}</span>
      </span>
    </button>
  )
}

function Divider() {
  return <div className="border-t border-grey-10" />
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-grey-50">{label}</span>
      <span className="text-right text-sm text-grey-90">{value}</span>
    </div>
  )
}

function RuleValueSelect({
  token,
  ruleType,
  attribute,
  operator,
  values,
  onChange,
  disabled,
  error,
}: {
  token: string
  ruleType: RuleGroupKey
  attribute: string
  operator: string
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
  error?: string
}) {
  const single = operator === "eq"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<PromotionRuleValueOption[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    if (!open || !attribute || !token) return
    let active = true
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await listRuleValues(
          token,
          ruleType,
          attribute,
          query.trim() || undefined
        )
        if (!active) return
        const opts = res.values || []
        opts.forEach((o) => labelsRef.current.set(o.value, o.label))
        setOptions(opts)
      } catch {
        if (active) setOptions([])
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query, token, ruleType, attribute])

  const toggleValue = (v: string) => {
    if (single) {
      onChange([v])
      setOpen(false)
      return
    }
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v]
    )
  }

  const labelFor = (v: string) => labelsRef.current.get(v) || v

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        className={cn(
          "flex min-h-[38px] w-full flex-wrap items-center gap-1 rounded-base border bg-white px-2 py-1.5 text-sm transition-colors",
          error ? "border-red-300" : "border-grey-30",
          disabled
            ? "cursor-not-allowed bg-grey-10 text-grey-40"
            : "cursor-pointer hover:border-grey-50"
        )}
      >
        {values.length === 0 && (
          <span className="px-1 text-grey-40">
            {single ? "Select value" : "Select values"}
          </span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-1.5 py-0.5 text-xs font-medium text-grey-70"
          >
            <span className="max-w-[160px] truncate">{labelFor(v)}</span>
            {!disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${labelFor(v)}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(values.filter((x) => x !== v))
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(values.filter((x) => x !== v))
                  }
                }}
                className="rounded p-0.5 hover:bg-grey-20"
              >
                <XMarkMini className="h-3 w-3" />
              </span>
            )}
          </span>
        ))}
        <ChevronDownMini className="ml-auto h-4 w-4 shrink-0 text-grey-50" />
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded-base border border-grey-20 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-grey-10 px-3 py-2">
            <MagnifyingGlassMini className="h-4 w-4 shrink-0 text-grey-40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border-none bg-transparent text-sm text-grey-90 placeholder:text-grey-40 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading && (
              <p className="px-3 py-2 text-sm text-grey-50">Loading...</p>
            )}
            {!loading && options.length === 0 && (
              <p className="px-3 py-2 text-sm text-grey-50">No results found</p>
            )}
            {!loading &&
              options.map((o) => {
                const selected = values.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleValue(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-grey-5",
                      selected ? "text-grey-90" : "text-grey-70"
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-grey-90" />
                    )}
                  </button>
                )
              })}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function RuleGroupSection({
  token,
  title,
  description,
  ruleType,
  rows,
  onRowsChange,
  attributes,
  attributesLoading,
  errors,
  errorPrefix,
}: {
  token: string
  title: string
  description: string
  ruleType: RuleGroupKey
  rows: RuleRow[]
  onRowsChange: (rows: RuleRow[]) => void
  attributes: PromotionRuleAttribute[]
  attributesLoading: boolean
  errors: Record<string, string>
  errorPrefix: string
}) {
  // Rows carry the backend attribute `value` (whitelist key), so the used-set
  // and all lookups key off attribute.value, not the display id.
  const usedAttributes = rows.map((r) => r.attribute).filter(Boolean)

  const updateRow = (key: string, patch: Partial<RuleRow>) => {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const handleAttributeChange = (row: RuleRow, attributeValue: string) => {
    const nextAttr = attributes.find((a) => a.value === attributeValue)
    const operator =
      nextAttr && nextAttr.operators.length === 1 ? nextAttr.operators[0].id : ""
    updateRow(row.key, { attribute: attributeValue, operator, values: [] })
  }

  const addRow = () => {
    onRowsChange([
      ...rows,
      { key: makeRowKey(), attribute: "", operator: "", values: [] },
    ])
  }

  const clearAll = () => {
    onRowsChange(rows.filter((r) => r.required))
  }

  const removeRow = (key: string) => {
    onRowsChange(rows.filter((r) => r.key !== key))
  }

  return (
    <SectionCard title={title} description={description}>
      {attributesLoading && attributes.length === 0 ? (
        <div className="h-16 animate-pulse rounded-base border border-grey-20 bg-grey-10" />
      ) : (
        <div>
          {rows.map((row, index) => {
            const attr = attributes.find((a) => a.value === row.attribute)
            const operatorOptions = attr?.operators || []
            const operatorLocked = !!row.attribute && operatorOptions.length <= 1
            const attributeOptions = attributes.filter(
              (a) =>
                a.value === row.attribute || !usedAttributes.includes(a.value)
            )
            const attrError = errors[`${errorPrefix}.${row.key}.attribute`]
            const operatorError = errors[`${errorPrefix}.${row.key}.operator`]
            const valuesError = errors[`${errorPrefix}.${row.key}.values`]

            return (
              <React.Fragment key={row.key}>
                <div className="flex gap-2 rounded-xl border border-grey-20 bg-grey-5 p-2">
                  <div className="min-w-0 grow space-y-2">
                    {row.required && (
                      <p className="px-1 text-xs text-grey-50">Required</p>
                    )}
                    {row.required ? (
                      <div className="rounded-base border border-grey-20 bg-grey-10 px-3 py-2 text-sm text-grey-70">
                        {attr?.label || "Product"}
                      </div>
                    ) : (
                      <Select
                        value={row.attribute}
                        onChange={(e) =>
                          handleAttributeChange(row, e.target.value)
                        }
                        aria-label="Select Attribute"
                      >
                        <option value="">Select Attribute</option>
                        {attributeOptions.map((a) => (
                          <option key={a.id} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    )}
                    {attrError && (
                      <p className="text-xs text-red-600">{attrError}</p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="min-w-0 sm:basis-1/2">
                        {operatorLocked ? (
                          <div className="rounded-base border border-grey-20 bg-grey-10 px-3 py-2 text-sm text-grey-70">
                            {operatorOptions.find((o) => o.id === row.operator)
                              ?.label ||
                              operatorOptions[0]?.label ||
                              ""}
                          </div>
                        ) : (
                          <Select
                            value={row.operator}
                            disabled={!row.attribute}
                            onChange={(e) =>
                              updateRow(row.key, {
                                operator: e.target.value,
                                values: [],
                              })
                            }
                            aria-label="Select Operator"
                          >
                            <option value="">Select Operator</option>
                            {operatorOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        )}
                        {operatorError && (
                          <p className="mt-1 text-xs text-red-600">
                            {operatorError}
                          </p>
                        )}
                      </div>

                      <RuleValueSelect
                        token={token}
                        ruleType={ruleType}
                        attribute={row.attribute}
                        operator={row.operator}
                        values={row.values}
                        onChange={(values) => updateRow(row.key, { values })}
                        disabled={!row.operator}
                        error={valuesError}
                      />
                    </div>
                  </div>

                  <div className="w-7 shrink-0 self-center">
                    {!row.required && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="rounded-base p-1.5 text-grey-50 hover:bg-grey-10 hover:text-grey-90"
                        aria-label="Remove condition"
                      >
                        <XMarkMini className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {index < rows.length - 1 && (
                  <div className="relative py-2 pl-8">
                    <span
                      className="absolute bottom-0 left-[26px] top-0 w-px border-l border-dotted border-grey-30"
                      aria-hidden="true"
                    />
                    <span className="relative inline-flex rounded-full border border-grey-20 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-grey-60">
                      AND
                    </span>
                  </div>
                )}
              </React.Fragment>
            )
          })}

          <div className={cn("flex items-center gap-2", rows.length && "mt-4")}>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              <Plus className="h-4 w-4" />
              Add condition
            </button>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-base px-3 py-2 text-sm font-medium text-grey-50 hover:text-grey-90"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default function PromotionCreatePage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [step, setStep] = useState<StepId>("type")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Form state (defaults = amount_off_products template, like Medusa)
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [isAutomatic, setIsAutomatic] = useState<"false" | "true">("false")
  const [status, setStatus] = useState<"draft" | "active">("draft")
  const [code, setCode] = useState("")
  const [type, setType] = useState<PromotionType>(TEMPLATES[0].defaults.type)
  const [valueType, setValueType] = useState<ValueType>(
    TEMPLATES[0].defaults.valueType
  )
  const [targetType, setTargetType] = useState<TargetType>(
    TEMPLATES[0].defaults.targetType
  )
  const [allocation, setAllocation] = useState<Allocation>(
    TEMPLATES[0].defaults.allocation
  )
  const [value, setValue] = useState(TEMPLATES[0].defaults.value)
  const [maxQuantity, setMaxQuantity] = useState(
    TEMPLATES[0].defaults.maxQuantity
  )
  const [applyToQuantity, setApplyToQuantity] = useState(
    TEMPLATES[0].defaults.applyToQuantity
  )
  const [buyRulesMinQuantity, setBuyRulesMinQuantity] = useState(
    TEMPLATES[0].defaults.buyRulesMinQuantity
  )
  const [limit, setLimit] = useState("")

  const [rules, setRules] = useState<RuleRow[]>([])
  const [targetRules, setTargetRules] = useState<RuleRow[]>([])
  const [buyRules, setBuyRules] = useState<RuleRow[]>([])

  const [campaignChoice, setCampaignChoice] = useState<"none" | "existing">(
    "none"
  )
  const [campaignId, setCampaignId] = useState("")
  const [campaignError, setCampaignError] = useState<string | null>(null)

  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const [conditionErrors, setConditionErrors] = useState<
    Record<string, string>
  >({})

  // Reference data
  const [defaultCurrency, setDefaultCurrency] = useState("")
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [ruleAttrs, setRuleAttrs] = useState<PromotionRuleAttribute[]>([])
  const [targetAttrs, setTargetAttrs] = useState<PromotionRuleAttribute[]>([])
  const [buyAttrs, setBuyAttrs] = useState<PromotionRuleAttribute[]>([])
  const [attrsLoading, setAttrsLoading] = useState(false)

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0],
    [templateId]
  )
  const hidden = (field: string) => template.hiddenFields.includes(field)

  const isBuyGet = type === "buyget"
  const isStandard = type === "standard"
  const showTypeRadio = !hidden("type")
  const showValueTypeRadio = !hidden("application_method.type")
  const showValue = !hidden("application_method.value")
  const showAllocation = isStandard && !hidden("application_method.allocation")
  const allocationOptions = useMemo(
    () =>
      (
        [
          {
            id: "each" as Allocation,
            label: "Each",
            description: "Applies value on each item",
          },
          {
            id: "across" as Allocation,
            label: "Across",
            description: "Applies value across items",
          },
        ] as const
      ).filter((o) => !hidden(`application_method.allocation.${o.id}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template]
  )
  const showMaxQuantity = (isStandard && allocation === "each") || isBuyGet
  const targetRulesApplicable = targetType !== "order"
  // Hide the target-rules group entirely when the server catalog for this
  // target type is empty (shipping_methods targets have no offerable
  // attributes here - tenancy adaptation): any row the user could build
  // would be rejected by the create route.
  const showTargetRules =
    targetRulesApplicable && (attrsLoading || targetAttrs.length > 0)

  const isFixed = valueType === "fixed"
  const promotionCurrency = isFixed ? defaultCurrency : ""

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // ---- reference data loading ----
  useEffect(() => {
    if (!token) return
    listStoreCurrencies(token)
      .then((res) =>
        setDefaultCurrency(res.default_currency || res.currencies?.[0] || "")
      )
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
      })
  }, [token, logout])

  useEffect(() => {
    if (!token) return
    let active = true
    setCampaignsLoading(true)
    listCampaigns(token, { limit: 100 })
      .then((res) => {
        if (active) setCampaigns(res.campaigns || [])
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
      })
      .finally(() => {
        if (active) setCampaignsLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, logout])

  useEffect(() => {
    if (!token) return
    let active = true
    setAttrsLoading(true)
    const load = async () => {
      try {
        const [r, t2, b] = await Promise.all([
          listRuleAttributes(token, "rules", type),
          // application_method_target_type MUST be sent for target-rules: the
          // backend catalog differs per target (empty for shipping_methods),
          // and the create route validates against that per-target catalog.
          targetRulesApplicable
            ? listRuleAttributes(token, "target-rules", type, targetType)
            : Promise.resolve({ attributes: [] as PromotionRuleAttribute[] }),
          isBuyGet
            ? listRuleAttributes(token, "buy-rules", type)
            : Promise.resolve({ attributes: [] as PromotionRuleAttribute[] }),
        ])
        if (!active) return
        setRuleAttrs(r.attributes || [])
        setTargetAttrs(t2.attributes || [])
        setBuyAttrs(b.attributes || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout()
      } finally {
        if (active) setAttrsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [token, type, targetType, isBuyGet, targetRulesApplicable, logout])

  // Buy X Get Y promotions auto-seed a required, non-removable Product rule in
  // both the buy-rules and target-rules groups (Medusa parity: admin's
  // requiredProductRule = attribute "items.product.id", operator "eq").
  useEffect(() => {
    if (!isBuyGet || attrsLoading) return
    const productAttrValue = (list: PromotionRuleAttribute[]) => {
      const found =
        list.find((a) => a.value === REQUIRED_PRODUCT_ATTRIBUTE) ||
        list.find((a) => a.label === "Product")
      return found?.value || REQUIRED_PRODUCT_ATTRIBUTE
    }
    setBuyRules((prev) =>
      prev.length
        ? prev
        : [
            {
              key: makeRowKey(),
              attribute: productAttrValue(buyAttrs),
              operator: REQUIRED_PRODUCT_OPERATOR,
              values: [],
              required: true,
            },
          ]
    )
    setTargetRules((prev) =>
      prev.length
        ? prev
        : [
            {
              key: makeRowKey(),
              attribute: productAttrValue(targetAttrs),
              operator: REQUIRED_PRODUCT_OPERATOR,
              values: [],
              required: true,
            },
          ]
    )
  }, [isBuyGet, attrsLoading, buyAttrs, targetAttrs])

  // ---- template switching: full reset + apply presets (Medusa parity) ----
  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0]
    setTemplateId(t.id)
    setIsAutomatic("false")
    setStatus("draft")
    setCode("")
    setType(t.defaults.type)
    setValueType(t.defaults.valueType)
    setTargetType(t.defaults.targetType)
    setAllocation(t.defaults.allocation)
    setValue(t.defaults.value)
    setMaxQuantity(t.defaults.maxQuantity)
    setApplyToQuantity(t.defaults.applyToQuantity)
    setBuyRulesMinQuantity(t.defaults.buyRulesMinQuantity)
    setLimit("")
    setRules([])
    setTargetRules([])
    setBuyRules([])
    setCampaignChoice("none")
    setCampaignId("")
    setCampaignError(null)
    setDetailErrors({})
    setConditionErrors({})
  }

  const handleAllocationChange = (a: Allocation) => {
    setAllocation(a)
    if (a === "across") {
      setMaxQuantity("")
    } else if (!maxQuantity) {
      setMaxQuantity("1")
    }
  }

  // ---- validation ----
  const validateDetails = (): boolean => {
    const errs: Record<string, string> = {}
    if (!code.trim()) {
      errs.code = "Required field"
    }
    if (showValue) {
      const n = parseFloat(value)
      if (value === "" || !Number.isFinite(n) || n < 0) {
        errs.value = "Invalid promotion value"
      } else if (valueType === "percentage" && n > 100) {
        errs.value = "Percentage cannot exceed 100"
      }
    }
    if (isFixed && !defaultCurrency) {
      errs.value = "Store currency is not available yet. Please try again."
    }
    if (showMaxQuantity) {
      const n = parseInt(maxQuantity, 10)
      if (!Number.isFinite(n) || n < 1) {
        errs.maxQuantity = "Required field"
      }
    }
    if (isBuyGet) {
      const minQty = parseInt(buyRulesMinQuantity, 10)
      if (!Number.isFinite(minQty) || minQty < 1) {
        errs.buyRulesMinQuantity = "Required field"
      }
      const applyQty = parseInt(applyToQuantity, 10)
      if (!Number.isFinite(applyQty) || applyQty < 1) {
        errs.applyToQuantity = "Required field"
      }
    }
    if (limit.trim() !== "") {
      const l = parseInt(limit, 10)
      if (!Number.isFinite(l) || l < 1) {
        errs.limit = "Usage limit must be at least 1"
      }
    }
    setDetailErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateConditions = (): boolean => {
    const errs: Record<string, string> = {}
    const checkGroup = (rows: RuleRow[], prefix: string) => {
      rows.forEach((r) => {
        if (!r.attribute) errs[`${prefix}.${r.key}.attribute`] = "Required field"
        if (!r.operator) errs[`${prefix}.${r.key}.operator`] = "Required field"
        if (!r.values.length) errs[`${prefix}.${r.key}.values`] = "Required field"
      })
    }
    checkGroup(rules, "rules")
    if (isBuyGet) checkGroup(buyRules, "buy-rules")
    if (showTargetRules) checkGroup(targetRules, "target-rules")
    setConditionErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ---- step navigation ----
  const currentStepIndex = STEP_ORDER.indexOf(step)

  const goToStep = (target: StepId) => {
    const to = STEP_ORDER.indexOf(target)
    if (to <= currentStepIndex) {
      setStep(target)
      return
    }
    if (to >= 2 && !validateDetails()) {
      setStep("details")
      showMessage("error", "Fix errors in Promotion Tab before proceeding")
      return
    }
    if (to >= 3 && !validateConditions()) {
      setStep("conditions")
      showMessage("error", "Complete the condition rows before proceeding")
      return
    }
    setStep(target)
  }

  const handleContinue = () => {
    const next = STEP_ORDER[currentStepIndex + 1]
    if (next) goToStep(next)
  }

  const handleBack = () => {
    const prev = STEP_ORDER[currentStepIndex - 1]
    if (prev) setStep(prev)
  }

  const stepStatus = (
    index: number
  ): "completed" | "in-progress" | "not-started" => {
    if (index < currentStepIndex) return "completed"
    if (index === currentStepIndex) return "in-progress"
    return "not-started"
  }

  // ---- save ----
  const handleSave = async () => {
    if (!token || saving) return
    if (!validateDetails()) {
      setStep("details")
      showMessage("error", "Fix errors in Promotion Tab before proceeding")
      return
    }
    if (!validateConditions()) {
      setStep("conditions")
      showMessage("error", "Complete the condition rows before proceeding")
      return
    }
    if (campaignChoice === "existing" && !campaignId) {
      setCampaignError("Required field")
      setStep("campaign")
      return
    }
    setCampaignError(null)
    setSaving(true)
    try {
      const toRuleInputs = (rows: RuleRow[]): PromotionRuleInput[] =>
        rows
          .filter((r) => r.attribute && r.operator && r.values.length > 0)
          .map((r) => ({
            attribute: r.attribute,
            operator: r.operator as PromotionRuleInput["operator"],
            values: r.values,
          }))

      const payload: CreatePromotionPayload = {
        display_code: code.trim(),
        is_automatic: isAutomatic === "true",
        type,
        status,
        application_method: {
          type: valueType,
          target_type: targetType,
          value: parseFloat(value) || 0,
          currency_code: isFixed ? defaultCurrency || undefined : undefined,
          // Buyget always allocates per item ("each", Medusa's buy_get
          // default). Omitting allocation makes the backend default non-order
          // targets to "across", which force-nulls max_quantity and silently
          // drops the Maximum Quantity the merchant entered.
          allocation: isBuyGet ? "each" : allocation,
          max_quantity: showMaxQuantity
            ? parseInt(maxQuantity, 10)
            : undefined,
          apply_to_quantity: isBuyGet
            ? parseInt(applyToQuantity, 10)
            : undefined,
          buy_rules_min_quantity: isBuyGet
            ? parseInt(buyRulesMinQuantity, 10)
            : undefined,
        },
        rules: toRuleInputs(rules),
        target_rules: showTargetRules ? toRuleInputs(targetRules) : undefined,
        buy_rules: isBuyGet ? toRuleInputs(buyRules) : undefined,
        campaign_id:
          campaignChoice === "existing" && campaignId ? campaignId : undefined,
        limit: limit.trim() ? parseInt(limit, 10) : undefined,
      }

      const res = await createPromotion(token, payload)
      showMessage(
        "success",
        `Promotion (${res.promotion?.display_code || code.trim()}) was successfully created.`
      )
      router.push(`/dashboard/promotions/${res.promotion.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to create promotion"
      )
      setSaving(false)
    }
  }

  // Cmd/Ctrl+Enter submits (Medusa KeyboundForm parity)
  const saveRef = useRef<() => void>(() => {})
  saveRef.current = handleSave
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null

  const isCampaignDisabled = (c: CampaignListItem): boolean => {
    if (!c.budget?.currency_code) return false
    return (
      c.budget.currency_code.toLowerCase() !==
      (promotionCurrency || "").toLowerCase()
    )
  }
  const someCampaignsDisabled = campaigns.some(isCampaignDisabled)

  const targetRulesTitle =
    targetType === "shipping_methods"
      ? "What shipping methods will the promotion be applied to?"
      : "What items will the promotion be applied to?"
  const targetRulesDescription =
    targetType === "shipping_methods"
      ? "The promotion will be applied to shipping methods that match the following conditions."
      : "The promotion will be applied to items that match the following conditions."

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/promotions")}
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
          aria-label="Back to promotions"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          title="Create promotion"
          description="Set up a discount your customers can use at checkout."
        />
      </div>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && (
            <ExclamationCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <nav
        aria-label="Promotion steps"
        className="rounded-large border border-grey-20 bg-white p-2 shadow-borders-base"
      >
        <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const st = stepStatus(i)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goToStep(s.id)}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-base px-3 py-2.5 text-sm font-medium transition-colors",
                    st === "in-progress"
                      ? "bg-grey-10 text-grey-90"
                      : "text-grey-50 hover:text-grey-90"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      st === "completed" &&
                        "border-grey-90 bg-grey-90 text-white",
                      st === "in-progress" && "border-grey-90 text-grey-90",
                      st === "not-started" && "border-grey-30 text-grey-50"
                    )}
                  >
                    {st === "completed" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="mx-auto w-full max-w-[720px]">
        {step === "type" && (
          <SectionCard
            title="Type"
            description="Choose the type of promotion to create. Switching type resets the form."
          >
            <div role="radiogroup" className="flex flex-col gap-3">
              {TEMPLATES.map((t) => (
                <ChoiceBox
                  key={t.id}
                  checked={templateId === t.id}
                  onSelect={() => applyTemplate(t.id)}
                  label={t.title}
                  description={t.description}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {step === "details" && (
          <div className="space-y-6 rounded-large border border-grey-20 bg-white p-6 shadow-borders-base">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-grey-90">
                Promotion Details
              </h2>
              <span className="rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-60">
                {template.title}
              </span>
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium text-grey-70">
                Method
              </p>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                <ChoiceBox
                  checked={isAutomatic === "false"}
                  onSelect={() => setIsAutomatic("false")}
                  label="Promotion code"
                  description="Customers must enter this code at checkout"
                />
                <ChoiceBox
                  checked={isAutomatic === "true"}
                  onSelect={() => setIsAutomatic("true")}
                  label="Automatic"
                  description="Customers will see this promotion at checkout"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium text-grey-70">
                Status
              </p>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                <ChoiceBox
                  checked={status === "draft"}
                  onSelect={() => setStatus("draft")}
                  label="Draft"
                  description="Customers will not be able to use the code yet"
                />
                <ChoiceBox
                  checked={status === "active"}
                  onSelect={() => setStatus("active")}
                  label="Active"
                  description="Customers will be able to use the code"
                />
              </div>
            </div>

            <div className="sm:max-w-[50%]">
              <FormField
                label="Code"
                htmlFor="promo-code"
                hint="The code your customers will enter during checkout."
                error={detailErrors.code}
              >
                <Input
                  id="promo-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="SUMMER15"
                />
              </FormField>
            </div>

            {showTypeRadio && (
              <>
                <Divider />
                <div>
                  <p className="mb-2 block text-sm font-medium text-grey-70">
                    Type
                  </p>
                  <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                    <ChoiceBox
                      checked={type === "standard"}
                      onSelect={() => setType("standard")}
                      label="Standard"
                      description="A standard promotion"
                    />
                    <ChoiceBox
                      checked={type === "buyget"}
                      onSelect={() => setType("buyget")}
                      label="Buy Get"
                      description="Buy X get Y promotion"
                    />
                  </div>
                </div>
              </>
            )}

            {showValueTypeRadio && (
              <>
                <Divider />
                <div>
                  <p className="mb-2 block text-sm font-medium text-grey-70">
                    Value Type
                  </p>
                  <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                    <ChoiceBox
                      checked={valueType === "fixed"}
                      onSelect={() => setValueType("fixed")}
                      label="Fixed amount"
                      description="The amount to be discounted. eg. 100"
                    />
                    <ChoiceBox
                      checked={valueType === "percentage"}
                      onSelect={() => setValueType("percentage")}
                      label="Percentage"
                      description="The percentage to discount off the amount. eg. 8%"
                    />
                  </div>
                </div>
              </>
            )}

            {showValue && (
              <>
                <Divider />
                <div className="sm:max-w-[50%]">
                  <FormField
                    label="Promotion Value"
                    htmlFor="promo-value"
                    hint={
                      isFixed
                        ? defaultCurrency
                          ? "The amount to be discounted. eg. 100"
                          : "Select the currency code to enable setting the amount"
                        : "The percentage to discount off the amount. eg. 8%"
                    }
                    error={detailErrors.value}
                  >
                    {isFixed ? (
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-grey-50">
                          {currencySymbol(defaultCurrency)}
                        </span>
                        <Input
                          id="promo-value"
                          type="number"
                          min={0}
                          step="0.01"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="100"
                          disabled={!defaultCurrency}
                          className="pl-10 pr-14"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs uppercase text-grey-40">
                          {defaultCurrency}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          id="promo-value"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="8"
                          className="pr-8 text-right"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-grey-50">
                          %
                        </span>
                      </div>
                    )}
                  </FormField>
                </div>
              </>
            )}

            {showMaxQuantity && (
              <div className="sm:max-w-[50%]">
                <FormField
                  label="Maximum Quantity"
                  htmlFor="promo-max-quantity"
                  hint="Maximum quantity of items this promotion applies to."
                  error={detailErrors.maxQuantity}
                >
                  <Input
                    id="promo-max-quantity"
                    type="number"
                    min={1}
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    placeholder="3"
                  />
                </FormField>
              </div>
            )}

            {showAllocation && allocationOptions.length > 0 && (
              <div>
                <p className="mb-2 block text-sm font-medium text-grey-70">
                  Allocation
                </p>
                <div
                  role="radiogroup"
                  className={cn(
                    "grid gap-3",
                    allocationOptions.length > 1
                      ? "sm:grid-cols-2"
                      : "sm:grid-cols-1"
                  )}
                >
                  {allocationOptions.map((o) => (
                    <ChoiceBox
                      key={o.id}
                      checked={allocation === o.id}
                      onSelect={() => handleAllocationChange(o.id)}
                      label={o.label}
                      description={o.description}
                    />
                  ))}
                </div>
              </div>
            )}

            {isBuyGet && (
              <>
                <Divider />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Minimum quantity of items"
                    htmlFor="promo-buy-min-qty"
                    hint="The minimum quantity of matching items that need to be in the cart to unlock the promotion."
                    error={detailErrors.buyRulesMinQuantity}
                  >
                    <Input
                      id="promo-buy-min-qty"
                      type="number"
                      min={1}
                      value={buyRulesMinQuantity}
                      onChange={(e) => setBuyRulesMinQuantity(e.target.value)}
                      placeholder="1"
                    />
                  </FormField>
                  <FormField
                    label="Quantity of items promotion will apply to"
                    htmlFor="promo-apply-to-qty"
                    hint="The quantity of matching target items the promotion will be applied to."
                    error={detailErrors.applyToQuantity}
                  >
                    <Input
                      id="promo-apply-to-qty"
                      type="number"
                      min={1}
                      value={applyToQuantity}
                      onChange={(e) => setApplyToQuantity(e.target.value)}
                      placeholder="1"
                    />
                  </FormField>
                </div>
              </>
            )}

            <Divider />
            <div className="sm:max-w-[50%]">
              <FormField
                label="Usage Limit"
                htmlFor="promo-limit"
                hint="Maximum number of times this promotion can be used across all orders. Leave empty for unlimited usage."
                error={detailErrors.limit}
              >
                <Input
                  id="promo-limit"
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="100"
                />
              </FormField>
            </div>
          </div>
        )}

        {step === "conditions" && (
          <div className="space-y-6">
            <RuleGroupSection
              token={token ?? ""}
              title="Who can use this code?"
              description="Which customer is allowed to use the promotion code? Promotion code can be used by all customers if left untouched."
              ruleType="rules"
              rows={rules}
              onRowsChange={setRules}
              attributes={ruleAttrs}
              attributesLoading={attrsLoading}
              errors={conditionErrors}
              errorPrefix="rules"
            />

            {isBuyGet && (
              <RuleGroupSection
                token={token ?? ""}
                title="What needs to be in the cart to unlock the promotion?"
                description="If these conditions match, we enable the promotion on the target items."
                ruleType="buy-rules"
                rows={buyRules}
                onRowsChange={setBuyRules}
                attributes={buyAttrs}
                attributesLoading={attrsLoading}
                errors={conditionErrors}
                errorPrefix="buy-rules"
              />
            )}

            {showTargetRules && (
              <RuleGroupSection
                token={token ?? ""}
                title={targetRulesTitle}
                description={targetRulesDescription}
                ruleType="target-rules"
                rows={targetRules}
                onRowsChange={setTargetRules}
                attributes={targetAttrs}
                attributesLoading={attrsLoading}
                errors={conditionErrors}
                errorPrefix="target-rules"
              />
            )}
          </div>
        )}

        {step === "campaign" && (
          <SectionCard
            title="Campaign"
            description="Optionally associate this promotion with a campaign to track usage and budgets."
          >
            <div className="space-y-4">
              <div role="radiogroup" className="grid grid-cols-1 gap-3">
                <ChoiceBox
                  checked={campaignChoice === "none"}
                  onSelect={() => {
                    setCampaignChoice("none")
                    setCampaignId("")
                    setCampaignError(null)
                  }}
                  label="Without Campaign"
                  description="Proceed without associating promotion with campaign"
                />
                <ChoiceBox
                  checked={campaignChoice === "existing"}
                  onSelect={() => setCampaignChoice("existing")}
                  label="Existing Campaign"
                  description="Add promotion to an existing campaign."
                />
              </div>

              {campaignChoice === "existing" && (
                <div className="space-y-4">
                  {campaignsLoading ? (
                    <div className="h-10 animate-pulse rounded-base border border-grey-20 bg-grey-10" />
                  ) : campaigns.length === 0 ? (
                    <div className="rounded-base border border-dashed border-grey-20 bg-grey-5 px-4 py-6 text-center">
                      <p className="text-sm font-medium text-grey-70">
                        No existing campaigns
                      </p>
                      <p className="mt-1 text-xs text-grey-50">
                        You can create one to track multiple promotions and set
                        budget limits.
                      </p>
                    </div>
                  ) : (
                    <>
                      <FormField
                        label="Campaign"
                        htmlFor="promo-campaign"
                        error={campaignError || undefined}
                      >
                        <Select
                          id="promo-campaign"
                          value={campaignId}
                          onChange={(e) => {
                            setCampaignId(e.target.value)
                            setCampaignError(null)
                          }}
                        >
                          <option value="">Select campaign</option>
                          {campaigns.map((c) => {
                            const disabled = isCampaignDisabled(c)
                            return (
                              <option
                                key={c.id}
                                value={c.id}
                                disabled={disabled}
                              >
                                {c.name.toUpperCase()}
                              </option>
                            )
                          })}
                        </Select>
                      </FormField>
                      {someCampaignsDisabled && (
                        <p className="text-xs text-grey-50">
                          Disabled campaigns have budget in a different currency
                          than the promotion.
                        </p>
                      )}

                      {selectedCampaign && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-base border border-grey-20 p-4">
                            <h4 className="mb-2 text-sm font-semibold text-grey-90">
                              Campaign details
                            </h4>
                            <DetailRow
                              label="Identifier"
                              value={
                                selectedCampaign.campaign_identifier_display ||
                                "-"
                              }
                            />
                            <DetailRow
                              label="Description"
                              value={selectedCampaign.description || "-"}
                            />
                            <DetailRow
                              label="Start date"
                              value={
                                selectedCampaign.starts_at
                                  ? formatDate(selectedCampaign.starts_at)
                                  : "-"
                              }
                            />
                            <DetailRow
                              label="End date"
                              value={
                                selectedCampaign.ends_at
                                  ? formatDate(selectedCampaign.ends_at)
                                  : "-"
                              }
                            />
                          </div>
                          <div className="rounded-base border border-grey-20 p-4">
                            <h4 className="mb-2 text-sm font-semibold text-grey-90">
                              Campaign budget
                            </h4>
                            {selectedCampaign.budget ? (
                              <>
                                <DetailRow
                                  label="Type"
                                  value={
                                    selectedCampaign.budget.type === "spend"
                                      ? "Spend"
                                      : "Usage"
                                  }
                                />
                                <DetailRow
                                  label="Currency"
                                  value={
                                    selectedCampaign.budget.currency_code
                                      ? selectedCampaign.budget.currency_code.toUpperCase()
                                      : "-"
                                  }
                                />
                                <DetailRow
                                  label="Limit"
                                  value={
                                    selectedCampaign.budget.limit == null
                                      ? "Unlimited"
                                      : selectedCampaign.budget.type ===
                                            "spend" &&
                                          selectedCampaign.budget.currency_code
                                        ? formatMoney(
                                            selectedCampaign.budget.limit,
                                            selectedCampaign.budget
                                              .currency_code
                                          )
                                        : selectedCampaign.budget.limit
                                  }
                                />
                                <DetailRow
                                  label="Used"
                                  value={
                                    selectedCampaign.budget.type === "spend" &&
                                    selectedCampaign.budget.currency_code
                                      ? formatMoney(
                                          selectedCampaign.budget.used || 0,
                                          selectedCampaign.budget.currency_code
                                        )
                                      : (selectedCampaign.budget.used ?? 0)
                                  }
                                />
                              </>
                            ) : (
                              <p className="py-1.5 text-sm text-grey-50">
                                No budget set
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <p className="text-xs text-grey-50">
                You can also add this promotion to a campaign later from the
                promotion detail page.
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-grey-10 pt-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/promotions")}
          className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {currentStepIndex > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Back
            </button>
          )}
          {step === "campaign" ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
