/**
 * StatusBadge — colour-coded Badge for a call or task status.
 *
 * Shared across the Agent Console and its sibling subpages (calls / campaigns /
 * playbooks) so every status pill in the Call Center reads the same. Pass either
 * a call status (`kind="call"`, the default) or a task status (`kind="task"`).
 */
import { Badge } from "@medusajs/ui"
import {
  CALL_STATUS_BADGE,
  TASK_STATUS_BADGE,
  type CallStatus,
  type CallTaskStatus,
} from "./lib"

type Size = "2xsmall" | "xsmall" | "small" | "base"

type CallProps = {
  kind?: "call"
  status: CallStatus | string
  size?: Size
}

type TaskProps = {
  kind: "task"
  status: CallTaskStatus | string
  size?: Size
}

export const StatusBadge = ({
  status,
  size = "2xsmall",
  ...rest
}: CallProps | TaskProps) => {
  const kind = "kind" in rest ? rest.kind : "call"
  const map =
    kind === "task"
      ? (TASK_STATUS_BADGE as Record<string, { label: string; color: any }>)
      : (CALL_STATUS_BADGE as Record<string, { label: string; color: any }>)

  const entry = map[status] ?? {
    label: String(status ?? "unknown").replace(/_/g, " "),
    color: "grey" as const,
  }

  return (
    <Badge size={size} color={entry.color}>
      {entry.label}
    </Badge>
  )
}

export default StatusBadge
