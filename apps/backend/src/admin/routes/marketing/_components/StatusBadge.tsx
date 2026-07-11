/**
 * Marketing — status badge.
 *
 * Renders a post status (draft / needs approval / scheduled / published /
 * failed) or a per-target publishing status with a consistent colour. Unknown
 * values fall back to a humanised grey badge.
 */
import { Badge } from "@medusajs/ui"
import { statusMeta, targetStatusMeta } from "./lib"

export function StatusBadge({
  status,
  variant = "post",
  size = "2xsmall",
}: {
  status?: string | null
  variant?: "post" | "target"
  size?: "2xsmall" | "xsmall" | "small" | "base"
}) {
  const meta = variant === "target" ? targetStatusMeta(status) : statusMeta(status)
  return (
    <Badge size={size} color={meta.color}>
      {meta.label}
    </Badge>
  )
}

export default StatusBadge
