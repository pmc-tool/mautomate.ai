/**
 * Payment Gateways — merchant self-service connection page.
 *
 * The store owner connects their OWN payment gateway accounts (Stripe, bKash,
 * SSLCommerz, etc.) so shoppers can pay them directly. The platform never holds
 * or touches funds — money settles straight into the merchant's own account.
 *
 * API CONTRACT (cookie-session auth, credentials:include):
 *   GET  /admin/payments/gateways
 *     -> { store_country: string, gateways: Gateway[] }
 *   POST /admin/payments/gateways/:id  { values, enabled? }
 *     -> updated Gateway
 *
 * When saving credentials we only send the fields the merchant actually typed,
 * so a blank/masked secret is left out and the server keeps the stored one.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CreditCard } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type Credential = {
  key: string
  label: string
  secret: boolean
  optional?: boolean
  help?: string
}

type SetupGuide = {
  intro?: string
  steps: string[]
  dashboard_url?: string
  keys_url?: string
  sandbox_note?: string
  docs_url?: string
}

type Gateway = {
  id: string
  provider_id: string
  name: string
  blurb: string
  countries: string[]
  mode: "direct" | "redirect" | "offline"
  credentials: Credential[]
  logo?: string
  setup_guide?: SetupGuide
  available: boolean
  configured: boolean
  enabled: boolean
  values: Record<string, string>
}

type GatewaysResponse = {
  store_country: string
  gateways: Gateway[]
}

const MASK = "••••••••"

const postGateway = async (
  id: string,
  body: { values: Record<string, string>; enabled?: boolean }
): Promise<Gateway> => {
  const res = await fetch(`/admin/payments/gateways/${id}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b?.message || `Request failed (${res.status}).`)
  }
  return res.json()
}

const countryLabel = (g: Gateway) =>
  !g.countries || g.countries.length === 0 ? "Global" : g.countries.join(", ")

const StatusBadge = ({
  gateway,
  storeCountry,
}: {
  gateway: Gateway
  storeCountry: string
}) => {
  if (!gateway.available) {
    return (
      <Badge size="small" color="grey">
        Not in {storeCountry || "your region"}
      </Badge>
    )
  }
  if (gateway.enabled) {
    return (
      <Badge size="small" color="green">
        Enabled
      </Badge>
    )
  }
  if (gateway.configured) {
    return (
      <Badge size="small" color="blue">
        Connected
      </Badge>
    )
  }
  return (
    <Badge size="small" color="grey">
      Available
    </Badge>
  )
}

const initForm = (g: Gateway) => {
  const f: Record<string, string> = {}
  for (const c of g.credentials) {
    // Never prefill secrets — the drawer shows a masked placeholder instead.
    f[c.key] = c.secret ? "" : g.values?.[c.key] ?? ""
  }
  return f
}

const SetupGuideSection = ({ guide }: { guide?: SetupGuide }) => {
  if (!guide || !guide.steps || guide.steps.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-4">
      <Heading level="h3" className="text-ui-fg-base">
        How to get your keys
      </Heading>
      {guide.intro ? (
        <Text size="small" className="text-ui-fg-subtle">
          {guide.intro}
        </Text>
      ) : null}
      <ol className="flex flex-col gap-y-2">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-x-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ui-bg-base text-ui-fg-subtle shadow-borders-base text-xs">
              {i + 1}
            </span>
            <Text size="small" className="text-ui-fg-subtle">
              {step}
            </Text>
          </li>
        ))}
      </ol>
      {guide.sandbox_note ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          {guide.sandbox_note}
        </Text>
      ) : null}
      {guide.dashboard_url || guide.keys_url || guide.docs_url ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {guide.keys_url || guide.dashboard_url ? (
            <a
              href={guide.keys_url || guide.dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="small" variant="secondary">
                Open dashboard
              </Button>
            </a>
          ) : null}
          {guide.docs_url ? (
            <a href={guide.docs_url} target="_blank" rel="noopener noreferrer">
              <Button size="small" variant="transparent">
                Read the docs
              </Button>
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const ConfigureDrawer = ({
  gateway,
  storeCountry,
  onUpdated,
}: {
  gateway: Gateway
  storeCountry: string
  onUpdated: (g: Gateway) => void
}) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(() =>
    initForm(gateway)
  )
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Re-sync the form whenever the drawer opens or the gateway data changes.
  useEffect(() => {
    if (open) {
      setForm(initForm(gateway))
      setTouched(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gateway])

  const change = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  const save = async () => {
    const values: Record<string, string> = {}
    touched.forEach((k) => {
      values[k] = form[k]
    })
    setSaving(true)
    try {
      const updated = await postGateway(gateway.id, { values })
      onUpdated(updated)
      setTouched(new Set())
      toast.success(`${gateway.name} connected`, {
        description: "Your credentials are saved securely.",
      })
    } catch (e: any) {
      toast.error("Could not save credentials", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnable = async (next: boolean) => {
    setToggling(true)
    try {
      const updated = await postGateway(gateway.id, {
        values: {},
        enabled: next,
      })
      onUpdated(updated)
      if (next) {
        toast.success(`${gateway.name} is now live at checkout`, {
          description: "Shoppers can now pay you with it.",
        })
      } else {
        toast.success(`${gateway.name} disabled at checkout`)
      }
    } catch (e: any) {
      toast.error("Could not update checkout", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setToggling(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          Configure
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{gateway.name}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            {gateway.blurb}
          </Text>

          {!gateway.available && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
              <Text size="small" className="text-ui-fg-subtle">
                This gateway isn't available for {storeCountry || "your region"}.
                You can still enter credentials, but it may not work at checkout.
              </Text>
            </div>
          )}

          <SetupGuideSection guide={gateway.setup_guide} />

          <div className="flex flex-col gap-y-4">
            {gateway.credentials.map((c) => {
              const isSecret = c.secret
              const stored = gateway.values?.[c.key]
              const placeholder = isSecret
                ? stored
                  ? MASK
                  : "Enter value"
                : "Enter value"
              return (
                <div key={c.key} className="flex flex-col gap-y-1.5">
                  <Label size="small" weight="plus">
                    {c.label}
                    {c.optional ? (
                      <span className="text-ui-fg-muted"> (optional)</span>
                    ) : null}
                  </Label>
                  <Input
                    type={isSecret ? "password" : "text"}
                    autoComplete="off"
                    placeholder={placeholder}
                    value={form[c.key] ?? ""}
                    onChange={(e) => change(c.key, e.target.value)}
                  />
                  {c.help ? (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {c.help}
                    </Text>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="flex items-start justify-between gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-4">
            <div className="flex flex-col gap-y-0.5">
              <Label size="small" weight="plus">
                Enable at checkout
              </Label>
              <Text size="xsmall" className="text-ui-fg-muted">
                {gateway.configured
                  ? "Show this payment option to your shoppers."
                  : "Save your credentials first to enable this at checkout."}
              </Text>
            </div>
            <Switch
              checked={gateway.enabled}
              disabled={!gateway.configured || toggling}
              onCheckedChange={toggleEnable}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Close
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            variant="primary"
            isLoading={saving}
            disabled={saving || touched.size === 0}
            onClick={save}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

const GatewayCard = ({
  gateway,
  storeCountry,
  onUpdated,
}: {
  gateway: Gateway
  storeCountry: string
  onUpdated: (g: Gateway) => void
}) => {
  return (
    <div
      className={`flex flex-col gap-y-3 rounded-lg border bg-ui-bg-subtle px-4 py-4 ${
        gateway.available
          ? "border-ui-border-base"
          : "border-ui-border-base opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-x-3">
        <div className="flex items-center gap-x-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ui-bg-base text-lg shadow-borders-base">
            {gateway.logo ? (
              <span aria-hidden>{gateway.logo}</span>
            ) : (
              <CreditCard />
            )}
          </div>
          <div className="flex flex-col">
            <Text size="base" weight="plus">
              {gateway.name}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {countryLabel(gateway)}
            </Text>
          </div>
        </div>
        <StatusBadge gateway={gateway} storeCountry={storeCountry} />
      </div>

      <Text size="small" className="flex-1 text-ui-fg-subtle">
        {gateway.blurb}
      </Text>

      <div className="pt-1">
        <ConfigureDrawer
          gateway={gateway}
          storeCountry={storeCountry}
          onUpdated={onUpdated}
        />
      </div>
    </div>
  )
}

const PaymentGatewaysPage = () => {
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [storeCountry, setStoreCountry] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/admin/payments/gateways", {
        credentials: "include",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || "Could not load payment gateways.")
      }
      const body: GatewaysResponse = await res.json()
      setGateways(Array.isArray(body?.gateways) ? body.gateways : [])
      setStoreCountry(typeof body?.store_country === "string" ? body.store_country : "")
    } catch (e: any) {
      setGateways([])
      setError(e?.message ?? "Unexpected error.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUpdated = (updated: Gateway) => {
    setGateways((prev) =>
      prev.map((g) => (g.id === updated.id ? updated : g))
    )
  }

  // Available gateways first, keeping otherwise-stable order.
  const sorted = [...gateways].sort(
    (a, b) => Number(b.available) - Number(a.available)
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">Payment Gateways</Heading>
          {!loading && !error && (
            <Badge size="small">{gateways.length} gateways</Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Connect your own payment accounts so shoppers pay you directly. Money
          settles straight into your account — this platform never holds or
          touches your funds.
        </Text>
      </div>

      {loading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Loading…</Text>
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-y-3 px-6 py-8">
          <Text className="text-ui-fg-subtle">{error}</Text>
          <Button size="small" variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">
            No payment gateways are available yet.
          </Text>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((g) => (
            <GatewayCard
              key={g.id}
              gateway={g}
              storeCountry={storeCountry}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Payment Gateways",
  icon: CreditCard,
})

export default PaymentGatewaysPage
