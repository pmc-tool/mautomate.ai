import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Select,
  FocusModal,
  Label,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Call Center widget on the ORDER details page (zone "order.details.after").
 *
 * Surfaces the AI call-center context for a single order: the COD confirmation
 * status stored in order metadata, a one-click "Call customer" action (opens a
 * playbook picker then POSTs an outbound trigger), and the call history for this
 * order pulled from GET /admin/call-center/calls?order_id=...
 *
 * Every network read/write handles its own loading / empty / error state so the
 * widget degrades gracefully when the call-center endpoints aren't reachable.
 */

// Registered playbooks (see modules/call-center/playbooks). Kept as a small
// static list so the picker works without an extra admin endpoint.
const PLAYBOOKS = [
  { id: "cod-confirmation", label: "COD confirmation" },
  { id: "wismo", label: "Where is my order (WISMO)" },
]

type Call = {
  id: string
  status?: string
  direction?: string
  disposition?: string | null
  created_at?: string
}

type OrderData = {
  id: string
  metadata?: Record<string, any> | null
}

const statusColor = (
  status?: string
): "green" | "orange" | "red" | "grey" | "blue" => {
  switch (status) {
    case "completed":
      return "green"
    case "in_progress":
    case "dialing":
      return "blue"
    case "queued":
      return "orange"
    case "failed":
    case "no_answer":
    case "canceled":
      return "red"
    default:
      return "grey"
  }
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—")

const CallOnOrderWidget = ({ data }: { data: OrderData }) => {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [playbook, setPlaybook] = useState(PLAYBOOKS[0].id)
  const [submitting, setSubmitting] = useState(false)

  const meta = data?.metadata ?? {}
  const codStatus = meta.cc_cod_confirmation_status as string | undefined
  const fulfillmentHold = meta.cc_fulfillment_hold as boolean | undefined
  const tags = meta.cc_tags as string[] | undefined

  const loadCalls = () => {
    setLoading(true)
    setError(false)
    fetch("/admin/call-center/calls?order_id=" + data.id, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error("bad status")
        }
        return r.json()
      })
      .then((d) => setCalls(d.calls ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!data?.id) {
      return
    }
    loadCalls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id])

  const triggerCall = () => {
    setSubmitting(true)
    fetch("/admin/call-center/calls/outbound", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: data.id, playbook_id: playbook }),
    })
      .then((r) => {
        if (r.status === 404) {
          toast.info("Outbound trigger pending")
          return null
        }
        if (!r.ok) {
          throw new Error("bad status")
        }
        return r.json()
      })
      .then((res) => {
        if (res) {
          toast.success("Call queued")
          loadCalls()
        }
      })
      .catch(() => toast.error("Failed to queue call"))
      .finally(() => {
        setSubmitting(false)
        setModalOpen(false)
      })
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Call Center</Heading>
        <Button
          size="small"
          variant="secondary"
          onClick={() => setModalOpen(true)}
        >
          Call customer
        </Button>
      </div>

      {/* COD confirmation / fulfillment status */}
      <div className="flex flex-col gap-y-3 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Label size="xsmall" className="text-ui-fg-muted uppercase">
            COD confirmation
          </Label>
          <Badge size="small" color={statusColor(codStatus)}>
            {codStatus ?? "not set"}
          </Badge>
          {fulfillmentHold ? (
            <Badge size="small" color="orange">
              Fulfillment hold
            </Badge>
          ) : null}
        </div>
        {tags && tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <Badge key={t} size="2xsmall">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {/* Call history for this order */}
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Label size="xsmall" className="text-ui-fg-muted uppercase">
          Call history
        </Label>
        {loading ? (
          <Text className="text-ui-fg-subtle" size="small">
            Loading…
          </Text>
        ) : error ? (
          <Text className="text-ui-fg-subtle" size="small">
            Could not load calls.
          </Text>
        ) : calls.length === 0 ? (
          <Text className="text-ui-fg-subtle" size="small">
            No calls for this order yet.
          </Text>
        ) : (
          <div className="flex flex-col divide-y">
            {calls.map((c) => (
              <a
                key={c.id}
                href={`/app/call-center/calls/${c.id}`}
                className="flex items-center justify-between py-2 hover:bg-ui-bg-subtle-hover"
              >
                <div className="flex items-center gap-x-2">
                  <Badge size="2xsmall" color={statusColor(c.status)}>
                    {c.status ?? "—"}
                  </Badge>
                  <Text size="small" className="text-ui-fg-subtle">
                    {c.disposition ?? "no disposition"}
                  </Text>
                </div>
                <Text size="small" className="text-ui-fg-muted">
                  {fmt(c.created_at)}
                </Text>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Playbook picker + outbound trigger */}
      <FocusModal open={modalOpen} onOpenChange={setModalOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <Heading level="h3">Call customer</Heading>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small">Playbook</Label>
              <Select value={playbook} onValueChange={setPlaybook}>
                <Select.Trigger>
                  <Select.Value placeholder="Select a playbook" />
                </Select.Trigger>
                <Select.Content>
                  {PLAYBOOKS.map((p) => (
                    <Select.Item key={p.id} value={p.id}>
                      {p.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={triggerCall} isLoading={submitting}>
                Start call
              </Button>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default CallOnOrderWidget
