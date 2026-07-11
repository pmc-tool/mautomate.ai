import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import {
  Container,
  Heading,
  Table,
  Text,
  Badge,
  Drawer,
  Label,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type ContactMessage = {
  id: string
  name: string
  email: string
  message: string
  created_at: string
}

const ContactMessagesPage = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  useEffect(() => {
    fetch("/admin/contact?limit=200", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.contact_messages ?? [])
        setCount(d.count ?? 0)
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (d: string) => (d ? new Date(d).toLocaleString() : "—")

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Contact Messages</Heading>
        <Badge size="small">{count} total</Badge>
      </div>

      {loading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Loading…</Text>
        </div>
      ) : messages.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">No messages yet.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Message</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {messages.map((m) => (
              <Table.Row
                key={m.id}
                className="cursor-pointer"
                onClick={() => setSelected(m)}
              >
                <Table.Cell>{fmt(m.created_at)}</Table.Cell>
                <Table.Cell>{m.name}</Table.Cell>
                <Table.Cell>{m.email}</Table.Cell>
                <Table.Cell>
                  <span className="line-clamp-1 max-w-[420px] inline-block text-ui-fg-subtle">
                    {m.message}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Message detail drawer */}
      <Drawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Message details</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-6">
            {selected && (
              <>
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" className="text-ui-fg-muted uppercase">
                    Name
                  </Label>
                  <Text>{selected.name}</Text>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" className="text-ui-fg-muted uppercase">
                    Email
                  </Label>
                  <a
                    href={`mailto:${selected.email}`}
                    className="text-ui-fg-interactive"
                  >
                    {selected.email}
                  </a>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" className="text-ui-fg-muted uppercase">
                    Received
                  </Label>
                  <Text>{fmt(selected.created_at)}</Text>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" className="text-ui-fg-muted uppercase">
                    Message
                  </Label>
                  <Text className="whitespace-pre-wrap">
                    {selected.message}
                  </Text>
                </div>
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Contact Messages",
  icon: ChatBubbleLeftRight,
})

export default ContactMessagesPage
