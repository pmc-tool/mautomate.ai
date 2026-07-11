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
import { useEffect, useMemo, useState } from "react"

/**
 * Call Center widget on the CUSTOMER details page (zone "customer.details.after").
 *
 * Shows the customer's lifetime AI call history (GET
 * /admin/call-center/calls?customer_id=...), a small aggregate (total calls +
 * last disposition), and a "Call customer" action that opens a playbook picker
 * and POSTs an outbound trigger. All states (loading / empty / error) are
 * handled so the widget stays quiet when the endpoints are unreachable.
 */

// Registered playbooks (see modules/call-center/playbooks). Static list so the
// picker works without an extra admin endpoint.
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

type CustomerData = {
  id: string
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

const CallOnCustomerWidget = ({ data }: { data: CustomerData }) => {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [playbook, setPlaybook] = useState(PLAYBOOKS[0].id)
  const [submitting, setSubmitting] = useState(false)

  const loadCalls = () => {
    setLoading(true)
    setError(false)
    fetch("/admin/call-center/calls?customer_id=" + data.id, {
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

  // Aggregate: the calls come back ordered created_at DESC, so the first with a
  // disposition is the most recent outcome.
  const lastDisposition = useMemo(() => {
    const withDisp = calls.find((c) => c.disposition)
    return withDisp?.disposition ?? null
  }, [calls])

  const triggerCall = () => {
    setSubmitting(true)
    fetch("/admin/call-center/calls/outbound", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: data.id, playbook_id: playbook }),
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

      {/* Aggregate */}
      <div className="flex items-center gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" className="text-ui-fg-muted uppercase">
            Total calls
          </Label>
          <Text size="small">{loading ? "…" : calls.length}</Text>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" className="text-ui-fg-muted uppercase">
            Last disposition
          </Label>
          <Text size="small" className="text-ui-fg-subtle">
            {loading ? "…" : lastDisposition ?? "—"}
          </Text>
        </div>
      </div>

      {/* Lifetime call history */}
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
            No calls for this customer yet.
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
  zone: "customer.details.after",
})

export default CallOnCustomerWidget
