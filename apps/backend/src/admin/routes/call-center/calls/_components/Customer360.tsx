/**
 * AI Call Center — Customer-360 panel.
 *
 * Composes a single-glance customer view for the call from two standard Medusa
 * admin endpoints:
 *   - the linked order  (GET /admin/orders/:id)     → what the call is about
 *   - the linked customer (GET /admin/customers/:id) → identity, history, address
 *
 * Either id may be absent (guest / cold inbound), so every section degrades
 * gracefully and, when nothing is linked, we fall back to the raw phone numbers.
 */
import {
  BuildingsSolid,
  MapPin,
  Receipt,
  ShoppingBag,
  Tag,
  User,
} from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  type AdminAddress,
  type AdminCustomer,
  type AdminOrder,
  fullName,
  formatDate,
  formatMoney,
  getCustomer,
  getOrder,
  humanize,
} from "./lib"

function AddressBlock({ address }: { address?: AdminAddress | null }) {
  if (!address) return null
  const line = [
    address.address_1,
    address.address_2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.province,
    address.country_code?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ")
  const name = fullName(address.first_name, address.last_name)
  if (!line && name === "—" && !address.phone) return null
  return (
    <div className="flex items-start gap-x-2">
      <MapPin className="mt-0.5 shrink-0 text-ui-fg-muted" />
      <div className="flex flex-col">
        {name !== "—" && (
          <Text size="small" weight="plus">
            {name}
          </Text>
        )}
        {address.company && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {address.company}
          </Text>
        )}
        {line && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {line}
          </Text>
        )}
        {address.phone && (
          <Text size="xsmall" className="font-mono text-ui-fg-subtle">
            {address.phone}
          </Text>
        )}
      </div>
    </div>
  )
}

function OrderSummary({ order }: { order: AdminOrder }) {
  const items = order.items ?? []
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Receipt className="text-ui-fg-subtle" />
          <Text size="small" weight="plus">
            Order #{order.display_id ?? "—"}
          </Text>
          {order.status && (
            <Badge size="2xsmall" color="grey">
              {humanize(order.status)}
            </Badge>
          )}
        </div>
        <a
          href={`/app/orders/${order.id}`}
          className="text-ui-fg-interactive text-xs hover:underline"
        >
          Open order
        </a>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-x-3 bg-ui-bg-base px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <Text size="xsmall" weight="plus" className="truncate">
                  {item.title ?? item.product_title ?? "Item"}
                </Text>
                {item.variant_title && (
                  <Text size="xsmall" className="truncate text-ui-fg-subtle">
                    {item.variant_title}
                  </Text>
                )}
              </div>
              <Text size="xsmall" className="shrink-0 text-ui-fg-subtle">
                × {item.quantity ?? 1}
              </Text>
            </div>
          ))}
          {items.length > 6 && (
            <div className="bg-ui-bg-base px-3 py-2">
              <Text size="xsmall" className="text-ui-fg-muted">
                +{items.length - 6} more item(s)
              </Text>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-ui-border-base pt-2">
        <Text size="small" className="text-ui-fg-subtle">
          Order total
        </Text>
        <Text size="small" weight="plus">
          {formatMoney(order.total, order.currency_code)}
        </Text>
      </div>
    </div>
  )
}

function CustomerSummary({ customer }: { customer: AdminCustomer }) {
  const name = fullName(customer.first_name, customer.last_name)
  const recentOrders = (customer.orders ?? [])
    .slice()
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    )
    .slice(0, 5)
  const primaryAddress = customer.addresses?.[0]
  const flags: string[] = []
  if (customer.has_account) flags.push("Registered")
  else flags.push("Guest")
  if ((customer.orders?.length ?? 0) > 1) flags.push("Returning")

  return (
    <div className="flex flex-col gap-y-4">
      {/* Identity */}
      <div className="flex items-start gap-x-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
          <User />
        </div>
        <div className="flex min-w-0 flex-col gap-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Text size="small" weight="plus" className="truncate">
              {name !== "—" ? name : customer.email ?? "Customer"}
            </Text>
            {flags.map((f) => (
              <Badge key={f} size="2xsmall" color="blue">
                {f}
              </Badge>
            ))}
          </div>
          {customer.email && (
            <Text size="xsmall" className="truncate text-ui-fg-subtle">
              {customer.email}
            </Text>
          )}
          {customer.phone && (
            <Text size="xsmall" className="font-mono text-ui-fg-subtle">
              {customer.phone}
            </Text>
          )}
          {customer.company_name && (
            <div className="flex items-center gap-x-1 text-ui-fg-subtle">
              <BuildingsSolid className="text-ui-fg-muted" />
              <Text size="xsmall">{customer.company_name}</Text>
            </div>
          )}
          {customer.created_at && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Customer since {formatDate(customer.created_at)}
            </Text>
          )}
        </div>
        <a
          href={`/app/customers/${customer.id}`}
          className="shrink-0 text-ui-fg-interactive text-xs hover:underline"
        >
          Open
        </a>
      </div>

      {/* Groups / tags */}
      {(customer.groups?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="text-ui-fg-muted" />
          {customer.groups!.map((g) => (
            <Badge key={g.id} size="2xsmall" color="grey">
              {g.name ?? g.id}
            </Badge>
          ))}
        </div>
      )}

      {/* Recent orders */}
      <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
        <div className="flex items-center gap-x-2">
          <ShoppingBag className="text-ui-fg-subtle" />
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
            Recent orders ({customer.orders?.length ?? 0})
          </Text>
        </div>
        {recentOrders.length === 0 ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            No prior orders on record.
          </Text>
        ) : (
          <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
            {recentOrders.map((o) => (
              <a
                key={o.id}
                href={`/app/orders/${o.id}`}
                className="flex items-center justify-between gap-x-3 bg-ui-bg-base px-3 py-2 transition-colors hover:bg-ui-bg-base-hover"
              >
                <div className="flex min-w-0 items-center gap-x-2">
                  <Text size="xsmall" weight="plus">
                    #{o.display_id ?? "—"}
                  </Text>
                  {o.status && (
                    <Badge size="2xsmall" color="grey">
                      {humanize(o.status)}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-x-3">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatDate(o.created_at)}
                  </Text>
                  <Text size="xsmall" weight="plus">
                    {formatMoney(o.total, o.currency_code)}
                  </Text>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Address */}
      {primaryAddress && (
        <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
            Address
          </Text>
          <AddressBlock address={primaryAddress} />
        </div>
      )}
    </div>
  )
}

export function Customer360({
  orderId,
  customerId,
  fromNumber,
  toNumber,
  direction,
}: {
  orderId?: string | null
  customerId?: string | null
  fromNumber?: string | null
  toNumber?: string | null
  direction?: string | null
}) {
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [customer, setCustomer] = useState<AdminCustomer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orderId && !customerId) return
    setLoading(true)
    setError(null)
    try {
      const [orderRes, customerRes] = await Promise.allSettled([
        orderId ? getOrder(orderId) : Promise.resolve(null),
        customerId ? getCustomer(customerId) : Promise.resolve(null),
      ])

      let resolvedOrder: AdminOrder | null = null
      if (orderRes.status === "fulfilled" && orderRes.value) {
        resolvedOrder = orderRes.value.order
        setOrder(resolvedOrder)
      }
      if (customerRes.status === "fulfilled" && customerRes.value) {
        setCustomer(customerRes.value.customer)
      } else if (
        !customerId &&
        resolvedOrder?.customer_id &&
        customerRes.status !== "rejected"
      ) {
        // Order carries a customer_id even when the call did not — hydrate it.
        try {
          const c = await getCustomer(resolvedOrder.customer_id)
          setCustomer(c.customer)
        } catch {
          /* non-fatal */
        }
      }

      if (
        orderRes.status === "rejected" &&
        customerRes.status === "rejected"
      ) {
        setError("Could not load the linked order or customer.")
      }
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error loading customer context.")
    } finally {
      setLoading(false)
    }
  }, [orderId, customerId])

  useEffect(() => {
    load()
  }, [load])

  const hasLink = !!orderId || !!customerId
  // The "other party" number, i.e. the customer's line for this call.
  const contactNumber =
    direction === "inbound" ? fromNumber : toNumber ?? fromNumber

  return (
    <Container className="flex flex-col gap-y-4 p-4">
      <div className="flex items-center gap-x-2">
        <User className="text-ui-fg-subtle" />
        <Heading level="h3">Customer 360</Heading>
      </div>

      {!hasLink ? (
        // Guest / cold inbound — nothing linked, show the raw contact.
        <div className="flex flex-col gap-y-2 rounded-lg border border-dashed border-ui-border-strong bg-ui-bg-subtle px-4 py-6">
          <Badge size="2xsmall" color="orange" className="w-fit">
            Unlinked contact
          </Badge>
          <Text size="small" className="text-ui-fg-subtle">
            This call is not linked to a customer or order (guest / inbound).
          </Text>
          {contactNumber && (
            <div className="flex items-center gap-x-2">
              <Text size="xsmall" className="text-ui-fg-muted">
                Contact number
              </Text>
              <Text size="small" weight="plus" className="font-mono">
                {contactNumber}
              </Text>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-ui-bg-subtle"
            />
          ))}
        </div>
      ) : error && !order && !customer ? (
        <div className="flex flex-col items-start gap-y-2 rounded-lg border border-ui-border-error bg-ui-bg-subtle px-4 py-4">
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
          <Button size="small" variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-y-5">
          {customer ? (
            <CustomerSummary customer={customer} />
          ) : (
            <Text size="small" className="text-ui-fg-subtle">
              No customer is linked to this call.
            </Text>
          )}

          {order && (
            <div className="border-t border-ui-border-base pt-4">
              <OrderSummary order={order} />
            </div>
          )}
        </div>
      )}
    </Container>
  )
}

export default Customer360
