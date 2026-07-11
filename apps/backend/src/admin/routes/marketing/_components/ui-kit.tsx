/**
 * Marketing — shared UI kit.
 *
 * A small, consistent visual layer used across every marketing screen so the
 * section feels like one product, not a dozen bolted-together pages. Built on
 * Medusa's `@medusajs/ui` primitives + design tokens, with a restrained accent
 * system (each area gets one hue) rendered via `color-mix` so it tracks the
 * active theme (light/dark) automatically.
 */
import { Heading, Text, clx } from "@medusajs/ui"
import type { ReactNode } from "react"

/** The marketing accent palette — one hue per functional area. */
export const ACCENTS = {
  violet: "#7C5CFC",
  blue: "#2E6BFF",
  teal: "#0EA5A4",
  amber: "#F59E0B",
  rose: "#F43F5E",
  green: "#16A34A",
  slate: "#64748B",
} as const

export type AccentKey = keyof typeof ACCENTS

/** A rounded icon tile tinted with an accent — the house style for section icons. */
export function AccentIcon({
  icon: Icon,
  accent = "violet",
  size = 36,
}: {
  icon: any
  accent?: AccentKey
  size?: number
}) {
  const c = ACCENTS[accent]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        color: c,
        background: `color-mix(in srgb, ${c} 13%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 22%, transparent)`,
        flexShrink: 0,
      }}
    >
      <Icon />
    </span>
  )
}

/** A consistent page header: accent icon + title + subtitle + right-aligned actions. */
export function PageHeader({
  icon,
  accent = "violet",
  title,
  subtitle,
  actions,
}: {
  icon?: any
  accent?: AccentKey
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-x-4 px-6 py-5">
      <div className="flex items-start gap-x-3">
        {icon && <AccentIcon icon={icon} accent={accent} size={40} />}
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">{title}</Heading>
          {subtitle && (
            <Text size="small" className="text-ui-fg-subtle">
              {subtitle}
            </Text>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-x-2">{actions}</div>}
    </div>
  )
}

/** An uppercase section label with optional count. */
export function SectionLabel({
  children,
  count,
  className,
}: {
  children: ReactNode
  count?: number
  className?: string
}) {
  return (
    <div className={clx("mb-3 flex items-center gap-x-2", className)}>
      <Text
        size="xsmall"
        weight="plus"
        className="uppercase tracking-wider text-ui-fg-muted"
      >
        {children}
      </Text>
      {typeof count === "number" && (
        <span className="rounded-full bg-ui-bg-subtle px-1.5 text-[10px] font-semibold leading-4 text-ui-fg-subtle">
          {count}
        </span>
      )}
    </div>
  )
}

/** A KPI tile with an accent bar, big value and optional sublabel. */
export function StatTile({
  label,
  value,
  sub,
  accent = "violet",
  icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: AccentKey
  icon?: any
}) {
  const c = ACCENTS[accent]
  return (
    <div
      className="relative flex flex-col gap-y-1 overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base p-4"
      style={{ boxShadow: "0 1px 2px rgba(17,24,39,0.04)" }}
    >
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0, height: 3, background: c }}
      />
      <div className="flex items-center justify-between">
        <Text size="xsmall" weight="plus" className="uppercase tracking-wide text-ui-fg-muted">
          {label}
        </Text>
        {icon && <AccentIcon icon={icon} accent={accent} size={24} />}
      </div>
      <Text className="text-[26px] font-semibold leading-tight text-ui-fg-base tabular-nums">
        {value}
      </Text>
      {sub && (
        <Text size="small" className="text-ui-fg-subtle">
          {sub}
        </Text>
      )}
    </div>
  )
}

/** A friendly empty/zero state. */
export function EmptyState({
  icon: Icon,
  accent = "slate",
  title,
  description,
  action,
}: {
  icon?: any
  accent?: AccentKey
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 px-6 py-14 text-center">
      {Icon && <AccentIcon icon={Icon} accent={accent} size={48} />}
      <div className="flex flex-col gap-y-1">
        <Text weight="plus" className="text-ui-fg-base">
          {title}
        </Text>
        {description && (
          <Text size="small" className="max-w-sm text-ui-fg-subtle">
            {description}
          </Text>
        )}
      </div>
      {action}
    </div>
  )
}

/** A soft status dot + label (open/scheduled/failed/etc.). */
export function StatusDot({
  tone = "slate",
  children,
}: {
  tone?: "green" | "amber" | "rose" | "blue" | "violet" | "slate"
  children: ReactNode
}) {
  const map = {
    green: ACCENTS.green,
    amber: ACCENTS.amber,
    rose: ACCENTS.rose,
    blue: ACCENTS.blue,
    violet: ACCENTS.violet,
    slate: ACCENTS.slate,
  }
  const c = map[tone]
  return (
    <span className="inline-flex items-center gap-x-1.5 text-xs font-medium text-ui-fg-subtle">
      <span style={{ width: 7, height: 7, borderRadius: 999, background: c }} />
      {children}
    </span>
  )
}
