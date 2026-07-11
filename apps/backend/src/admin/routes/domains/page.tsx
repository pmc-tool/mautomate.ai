import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Globe,
  MagnifyingGlass,
  ArrowPath,
  Plus,
  LockClosedSolid,
  LockOpenSolid,
  ShieldCheck,
  Check,
  CloudArrowDown,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Divider,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type DomainStatus =
  | "active"
  | "pending_register"
  | "pending_transfer"
  | "transferred_away"
  | "expired"
  | "failed"
  | "cancelled"

type Domain = {
  id: string
  domain_name: string
  tld: string
  status: DomainStatus
  source: string
  reseller_order_id: string | null
  registration_date: string | null
  expiry_date: string | null
  auto_renew: boolean
  privacy_enabled: boolean
  locked: boolean
  nameservers: string[] | null
  years: number
  register_price: number | null
  currency: string | null
  last_synced_at: string | null
}

type SearchResultPrice = {
  register: number
  renew: number
  transfer: number
  currency: string
}

type SearchResult = {
  domain: string
  tld: string
  available: boolean
  status: string
  isPremium?: boolean
  price?: SearchResultPrice
}

type Contact = {
  id: string
  name: string
  email: string
  is_default: boolean
  reseller_customer_id: string | null
  phone?: string | null
  company?: string | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
}

type StatusResponse = { configured: boolean; test_mode: boolean }
type ListDomainsResponse = {
  domains: Domain[]
  count: number
  limit: number
  offset: number
}
type SearchResponse = { query: string; results: SearchResult[] }
type BuyResponse = { ok: boolean; order?: unknown; domain?: Domain; message?: string }
type ValidateResponse = { valid: boolean; eligible: boolean; message: string }
type ContactsResponse = { contacts: Contact[] }
type CreateContactResponse = { contact: Contact }

/* -------------------------------------------------------------------------- */
/*  Fetch helper                                                              */
/* -------------------------------------------------------------------------- */

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`/admin${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const message =
      (data as { message?: string })?.message || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

const ALL_TLDS = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "shop",
  "store",
  "xyz",
  "dev",
  "app",
  "ai",
]
const DEFAULT_TLDS = ["com", "net", "org", "io", "co", "shop"]

type BadgeColor = "green" | "red" | "blue" | "orange" | "grey" | "purple"

const STATUS_META: Record<DomainStatus, { label: string; color: BadgeColor }> = {
  active: { label: "Active", color: "green" },
  pending_register: { label: "Pending register", color: "orange" },
  pending_transfer: { label: "Pending transfer", color: "blue" },
  transferred_away: { label: "Transferred away", color: "grey" },
  expired: { label: "Expired", color: "red" },
  failed: { label: "Failed", color: "red" },
  cancelled: { label: "Cancelled", color: "grey" },
}

const formatDate = (value: string | null): string => {
  if (!value) {
    return "—"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const daysUntil = (value: string | null): number | null => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

const money = (amount: number | null | undefined, currency?: string | null): string => {
  if (amount === null || amount === undefined) {
    return "—"
  }
  const code = (currency || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${amount} ${code}`
  }
}

/* -------------------------------------------------------------------------- */
/*  Page header                                                               */
/* -------------------------------------------------------------------------- */

const PageHeader = () => {
  return (
    <div className="flex items-center gap-x-4 px-6 py-5">
      <div className="bg-ui-bg-base shadow-borders-base flex h-11 w-11 items-center justify-center rounded-lg">
        <Globe className="text-ui-fg-subtle" />
      </div>
      <div>
        <Heading level="h1">Domains</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Search, register, transfer, and manage domain names for your store.
        </Text>
      </div>
    </div>
  )
}

const NotConfiguredNotice = () => {
  return (
    <div className="bg-ui-tag-orange-bg border-ui-tag-orange-border text-ui-tag-orange-text mx-6 mb-4 rounded-lg border p-4">
      <Text size="small" weight="plus" className="text-ui-tag-orange-text">
        ResellerClub account not connected
      </Text>
      <Text size="small" className="text-ui-tag-orange-text mt-1">
        Connect your ResellerClub reseller account (set
        {" "}
        <span className="font-mono">RESELLERCLUB_AUTH_USERID</span> +{" "}
        <span className="font-mono">RESELLERCLUB_API_KEY</span>) to buy and
        manage domains.
      </Text>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

const IndicatorPill = ({
  active,
  label,
  activeColor = "green",
}: {
  active: boolean
  label: string
  activeColor?: "green" | "grey"
}) => {
  return (
    <StatusBadge color={active ? activeColor : "grey"}>{label}</StatusBadge>
  )
}

const ExpiryHint = ({ expiry }: { expiry: string | null }) => {
  const days = daysUntil(expiry)
  if (days === null) {
    return null
  }
  if (days < 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-error">
        Expired
      </Text>
    )
  }
  if (days <= 30) {
    return (
      <Text size="xsmall" className="text-ui-tag-orange-text">
        Expiring soon — {days} day{days === 1 ? "" : "s"}
      </Text>
    )
  }
  return (
    <Text size="xsmall" className="text-ui-fg-subtle">
      Expires in {days} days
    </Text>
  )
}

/* -------------------------------------------------------------------------- */
/*  Tab: My Domains                                                           */
/* -------------------------------------------------------------------------- */

const MyDomainsTab = ({
  domains,
  loading,
  error,
  onRefresh,
  onFindClick,
}: {
  domains: Domain[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onFindClick: () => void
}) => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <Text size="small" className="text-ui-fg-subtle">
          {domains.length} domain{domains.length === 1 ? "" : "s"}
        </Text>
        <Button
          variant="secondary"
          size="small"
          onClick={onRefresh}
          isLoading={loading}
        >
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="bg-ui-tag-red-bg text-ui-tag-red-text rounded-lg p-4">
          <Text size="small" className="text-ui-tag-red-text">
            {error}
          </Text>
        </div>
      ) : null}

      {loading && domains.length === 0 ? (
        <div className="flex flex-col gap-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : domains.length === 0 && !error ? (
        <div className="border-ui-border-base flex flex-col items-center gap-y-3 rounded-lg border border-dashed py-12">
          <Globe className="text-ui-fg-muted" />
          <Text className="text-ui-fg-subtle">
            No domains yet — search below to register one.
          </Text>
          <Button variant="secondary" size="small" onClick={onFindClick}>
            <MagnifyingGlass />
            Find a domain
          </Button>
        </div>
      ) : domains.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Domain</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Expiry</Table.HeaderCell>
                <Table.HeaderCell>Flags</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {domains.map((domain) => {
                const meta = STATUS_META[domain.status] ?? {
                  label: domain.status,
                  color: "grey" as BadgeColor,
                }
                return (
                  <Table.Row key={domain.id}>
                    <Table.Cell>
                      <a
                        href={`/app/domains/${domain.domain_name}`}
                        className="text-ui-fg-interactive font-medium hover:underline"
                      >
                        {domain.domain_name}
                      </a>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={meta.color}>
                        {meta.label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <Text size="small">{formatDate(domain.expiry_date)}</Text>
                        <ExpiryHint expiry={domain.expiry_date} />
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-x-3">
                        <span
                          className="flex items-center gap-x-1"
                          title={domain.locked ? "Locked" : "Unlocked"}
                        >
                          {domain.locked ? (
                            <LockClosedSolid className="text-ui-fg-subtle" />
                          ) : (
                            <LockOpenSolid className="text-ui-fg-muted" />
                          )}
                        </span>
                        <span
                          className="flex items-center gap-x-1"
                          title={
                            domain.auto_renew
                              ? "Auto-renew on"
                              : "Auto-renew off"
                          }
                        >
                          <ArrowPath
                            className={
                              domain.auto_renew
                                ? "text-ui-tag-green-icon"
                                : "text-ui-fg-muted"
                            }
                          />
                        </span>
                        <span
                          className="flex items-center gap-x-1"
                          title={
                            domain.privacy_enabled
                              ? "Privacy enabled"
                              : "Privacy off"
                          }
                        >
                          <ShieldCheck
                            className={
                              domain.privacy_enabled
                                ? "text-ui-tag-green-icon"
                                : "text-ui-fg-muted"
                            }
                          />
                        </span>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Buy modal                                                                 */
/* -------------------------------------------------------------------------- */

const BuyModal = ({
  result,
  open,
  onOpenChange,
  configured,
  hasContact,
  onPurchased,
}: {
  result: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  configured: boolean
  hasContact: boolean
  onPurchased: () => void
}) => {
  const [years, setYears] = useState("1")
  const [privacy, setPrivacy] = useState(true)
  const [autoRenew, setAutoRenew] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setYears("1")
      setPrivacy(true)
      setAutoRenew(true)
    }
  }, [open])

  const handleBuy = async () => {
    if (!result) {
      return
    }
    setSubmitting(true)
    try {
      const res = await api<BuyResponse>("/domains/buy", {
        method: "POST",
        body: JSON.stringify({
          domain_name: result.domain,
          years: Number(years),
          privacy,
          auto_renew: autoRenew,
        }),
      })
      if (res.ok === false) {
        throw new Error(res.message || "Purchase failed")
      }
      toast.success("Domain registered", {
        description: `${result.domain} is being registered.`,
      })
      onOpenChange(false)
      onPurchased()
    } catch (err) {
      toast.error("Could not buy domain", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = submitting || !configured || !hasContact

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <Text weight="plus">Register domain</Text>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center py-10">
          <div className="flex w-full max-w-lg flex-col gap-y-6">
            <div>
              <Heading level="h2">{result?.domain}</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                {result?.price
                  ? `${money(result.price.register, result.price.currency)} for the first term · renews at ${money(
                      result.price.renew,
                      result.price.currency
                    )}/yr`
                  : "Pricing unavailable"}
              </Text>
            </div>

            {!configured ? (
              <div className="bg-ui-tag-orange-bg text-ui-tag-orange-text rounded-lg p-3">
                <Text size="small" className="text-ui-tag-orange-text">
                  Connect your ResellerClub account to enable purchases.
                </Text>
              </div>
            ) : null}
            {configured && !hasContact ? (
              <div className="bg-ui-tag-orange-bg text-ui-tag-orange-text rounded-lg p-3">
                <Text size="small" className="text-ui-tag-orange-text">
                  Create a registrant profile first (Registrant profile tab).
                </Text>
              </div>
            ) : null}

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Registration length
              </Label>
              <Select value={years} onValueChange={setYears}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {[1, 2, 3, 4, 5].map((y) => (
                    <Select.Item key={y} value={String(y)}>
                      {y} year{y === 1 ? "" : "s"}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label size="small" weight="plus">
                  WHOIS privacy
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Hide your contact details from public WHOIS.
                </Text>
              </div>
              <Switch checked={privacy} onCheckedChange={setPrivacy} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label size="small" weight="plus">
                  Auto-renew
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Renew automatically before expiry.
                </Text>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleBuy} isLoading={submitting} disabled={disabled}>
                Buy {result?.domain}
              </Button>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

/* -------------------------------------------------------------------------- */
/*  Tab: Find a domain                                                        */
/* -------------------------------------------------------------------------- */

const FindDomainTab = ({
  configured,
  hasContact,
  onPurchased,
  onCreateContact,
}: {
  configured: boolean
  hasContact: boolean
  onPurchased: () => void
  onCreateContact: () => void
}) => {
  const [query, setQuery] = useState("")
  const [selectedTlds, setSelectedTlds] = useState<string[]>(DEFAULT_TLDS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searchedQuery, setSearchedQuery] = useState("")
  const [buyTarget, setBuyTarget] = useState<SearchResult | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)

  const toggleTld = (tld: string) => {
    setSelectedTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]
    )
  }

  const runSearch = async () => {
    const trimmed = query.trim().replace(/^https?:\/\//, "").split("/")[0]
    if (!trimmed) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api<SearchResponse>("/domains/search", {
        method: "POST",
        body: JSON.stringify({ query: trimmed, tlds: selectedTlds }),
      })
      setResults(res.results ?? [])
      setSearchedQuery(res.query ?? trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  const baseName = useMemo(() => {
    const cleaned = searchedQuery.trim().toLowerCase()
    return cleaned.includes(".") ? cleaned.split(".")[0] : cleaned
  }, [searchedQuery])

  const exactMatch = useMemo(() => {
    if (!results) {
      return null
    }
    const wantedTld = searchedQuery.includes(".")
      ? searchedQuery.split(".").slice(1).join(".")
      : "com"
    return (
      results.find((r) => r.tld === wantedTld) ??
      results.find((r) => r.domain === `${baseName}.com`) ??
      results[0] ??
      null
    )
  }, [results, searchedQuery, baseName])

  const otherResults = useMemo(() => {
    if (!results || !exactMatch) {
      return []
    }
    return results.filter((r) => r.domain !== exactMatch.domain)
  }, [results, exactMatch])

  const openBuy = (result: SearchResult) => {
    setBuyTarget(result)
    setBuyOpen(true)
  }

  const renderPrice = (result: SearchResult) => {
    if (!result.price) {
      return "—"
    }
    return `${money(result.price.register, result.price.currency)}/yr`
  }

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex flex-col gap-y-3">
        <div className="flex gap-x-2">
          <Input
            placeholder="Search for a domain (e.g. mystore)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runSearch()
              }
            }}
          />
          <Button onClick={runSearch} isLoading={loading} disabled={!query.trim()}>
            <MagnifyingGlass />
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ALL_TLDS.map((tld) => {
            const active = selectedTlds.includes(tld)
            return (
              <button
                key={tld}
                type="button"
                onClick={() => toggleTld(tld)}
                className={
                  active
                    ? "bg-ui-bg-interactive text-ui-fg-on-color border-ui-bg-interactive flex items-center gap-x-1 rounded-full border px-3 py-1 text-xs"
                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base flex items-center gap-x-1 rounded-full border px-3 py-1 text-xs"
                }
              >
                {active ? <Check className="h-3 w-3" /> : null}.{tld}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="bg-ui-tag-red-bg text-ui-tag-red-text rounded-lg p-4">
          <Text size="small" className="text-ui-tag-red-text">
            {error}
          </Text>
        </div>
      ) : null}

      {configured && !hasContact ? (
        <div className="bg-ui-tag-orange-bg text-ui-tag-orange-text flex items-center justify-between rounded-lg p-3">
          <Text size="small" className="text-ui-tag-orange-text">
            Create a registrant profile first to enable purchases.
          </Text>
          <Button variant="secondary" size="small" onClick={onCreateContact}>
            Create profile
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : results && results.length === 0 ? (
        <div className="border-ui-border-base rounded-lg border border-dashed py-10 text-center">
          <Text className="text-ui-fg-subtle">
            No results for “{searchedQuery}”.
          </Text>
        </div>
      ) : results ? (
        <div className="flex flex-col gap-y-4">
          {exactMatch ? (
            <div
              className={
                exactMatch.available
                  ? "border-ui-tag-green-border bg-ui-tag-green-bg rounded-lg border p-4"
                  : "border-ui-border-base bg-ui-bg-subtle rounded-lg border p-4"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-y-1">
                  <div className="flex items-center gap-x-2">
                    <Heading level="h3">{exactMatch.domain}</Heading>
                    {exactMatch.isPremium ? (
                      <Badge size="2xsmall" color="purple">
                        Premium
                      </Badge>
                    ) : null}
                    <Badge
                      size="2xsmall"
                      color={exactMatch.available ? "green" : "red"}
                    >
                      {exactMatch.available ? "Available" : "Taken"}
                    </Badge>
                  </div>
                  {exactMatch.available ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {renderPrice(exactMatch)}
                      {exactMatch.price
                        ? ` · renews ${money(
                            exactMatch.price.renew,
                            exactMatch.price.currency
                          )}/yr`
                        : ""}
                    </Text>
                  ) : (
                    <Text size="small" className="text-ui-fg-subtle">
                      Already registered — try another TLD below.
                    </Text>
                  )}
                </div>
                {exactMatch.available ? (
                  <Button
                    onClick={() => openBuy(exactMatch)}
                    disabled={!configured || !hasContact}
                  >
                    Buy
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {otherResults.length > 0 ? (
            <div className="flex flex-col gap-y-2">
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                Other extensions
              </Text>
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Domain</Table.HeaderCell>
                      <Table.HeaderCell>Availability</Table.HeaderCell>
                      <Table.HeaderCell>Price</Table.HeaderCell>
                      <Table.HeaderCell />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {otherResults.map((result) => (
                      <Table.Row key={result.domain}>
                        <Table.Cell>
                          <span className="flex items-center gap-x-2">
                            <Text size="small">{result.domain}</Text>
                            {result.isPremium ? (
                              <Badge size="2xsmall" color="purple">
                                Premium
                              </Badge>
                            ) : null}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            size="2xsmall"
                            color={result.available ? "green" : "red"}
                          >
                            {result.available ? "Available" : "Taken"}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small">{renderPrice(result)}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          {result.available ? (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => openBuy(result)}
                              disabled={!configured || !hasContact}
                            >
                              Buy
                            </Button>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-ui-border-base rounded-lg border border-dashed py-10 text-center">
          <Text className="text-ui-fg-subtle">
            Enter a name above to check availability across TLDs.
          </Text>
        </div>
      )}

      <BuyModal
        result={buyTarget}
        open={buyOpen}
        onOpenChange={setBuyOpen}
        configured={configured}
        hasContact={hasContact}
        onPurchased={onPurchased}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Tab: Transfer in                                                          */
/* -------------------------------------------------------------------------- */

const TransferInTab = ({
  configured,
  onTransferred,
}: {
  configured: boolean
  onTransferred: () => void
}) => {
  const [domainName, setDomainName] = useState("")
  const [authCode, setAuthCode] = useState("")
  const [privacy, setPrivacy] = useState(true)
  const [autoRenew, setAutoRenew] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validation, setValidation] = useState<ValidateResponse | null>(null)

  const canVerify = configured && domainName.trim() && authCode.trim()
  const canTransfer =
    configured && !!validation?.valid && !!validation?.eligible

  const handleVerify = async () => {
    setVerifying(true)
    setValidation(null)
    try {
      const res = await api<ValidateResponse>("/domains/transfer-in/validate", {
        method: "POST",
        body: JSON.stringify({
          domain_name: domainName.trim(),
          auth_code: authCode.trim(),
        }),
      })
      setValidation(res)
      if (res.valid && res.eligible) {
        toast.success("Domain eligible for transfer", {
          description: res.message,
        })
      } else {
        toast.error("Not eligible", { description: res.message })
      }
    } catch (err) {
      toast.error("Verification failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleTransfer = async () => {
    setSubmitting(true)
    try {
      await api("/domains/transfer-in", {
        method: "POST",
        body: JSON.stringify({
          domain_name: domainName.trim(),
          auth_code: authCode.trim(),
          privacy,
          auto_renew: autoRenew,
        }),
      })
      toast.success("Transfer initiated", {
        description: `${domainName.trim()} transfer has started.`,
      })
      setDomainName("")
      setAuthCode("")
      setValidation(null)
      onTransferred()
    } catch (err) {
      toast.error("Transfer failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-5">
      <div className="bg-ui-bg-subtle border-ui-border-base rounded-lg border p-4">
        <Text size="small" weight="plus">
          Before you transfer
        </Text>
        <ul className="text-ui-fg-subtle mt-2 list-disc pl-5 text-sm">
          <li>Unlock the domain at your current registrar.</li>
          <li>Get the EPP / authorization code from your current registrar.</li>
          <li>
            The domain must not be within 60 days of registration or a previous
            transfer.
          </li>
        </ul>
      </div>

      <div className="flex max-w-xl flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Domain name
          </Label>
          <Input
            placeholder="example.com"
            value={domainName}
            onChange={(e) => {
              setDomainName(e.target.value)
              setValidation(null)
            }}
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Auth / EPP code
          </Label>
          <div className="flex gap-x-2">
            <Input
              placeholder="Authorization code"
              value={authCode}
              onChange={(e) => {
                setAuthCode(e.target.value)
                setValidation(null)
              }}
            />
            <Button
              variant="secondary"
              onClick={handleVerify}
              isLoading={verifying}
              disabled={!canVerify}
            >
              <ShieldCheck />
              Verify
            </Button>
          </div>
        </div>

        {validation ? (
          <div
            className={
              validation.valid && validation.eligible
                ? "bg-ui-tag-green-bg text-ui-tag-green-text rounded-lg p-3"
                : "bg-ui-tag-red-bg text-ui-tag-red-text rounded-lg p-3"
            }
          >
            <Text
              size="small"
              weight="plus"
              className={
                validation.valid && validation.eligible
                  ? "text-ui-tag-green-text"
                  : "text-ui-tag-red-text"
              }
            >
              {validation.valid && validation.eligible
                ? "Eligible for transfer"
                : "Not eligible"}
            </Text>
            <Text
              size="small"
              className={
                validation.valid && validation.eligible
                  ? "text-ui-tag-green-text"
                  : "text-ui-tag-red-text"
              }
            >
              {validation.message}
            </Text>
          </div>
        ) : null}

        <Divider />

        <div className="flex items-center justify-between">
          <Label size="small" weight="plus">
            WHOIS privacy
          </Label>
          <Switch checked={privacy} onCheckedChange={setPrivacy} />
        </div>
        <div className="flex items-center justify-between">
          <Label size="small" weight="plus">
            Auto-renew
          </Label>
          <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleTransfer}
            isLoading={submitting}
            disabled={!canTransfer}
          >
            <CloudArrowDown />
            Transfer domain
          </Button>
        </div>
        {!configured ? (
          <Text size="xsmall" className="text-ui-fg-subtle text-right">
            Connect your ResellerClub account to enable transfers.
          </Text>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Registrant contact form (shared)                                          */
/* -------------------------------------------------------------------------- */

type ContactForm = {
  name: string
  email: string
  phone: string
  phone_country_code: string
  company: string
  address_line1: string
  city: string
  state: string
  country: string
  postal_code: string
}

const EMPTY_CONTACT: ContactForm = {
  name: "",
  email: "",
  phone: "",
  phone_country_code: "",
  company: "",
  address_line1: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
}

const ContactFormFields = ({
  form,
  setForm,
}: {
  form: ContactForm
  setForm: (updater: (prev: ContactForm) => ContactForm) => void
}) => {
  const field = (
    key: keyof ContactForm,
    label: string,
    placeholder = "",
    type = "text"
  ) => (
    <div className="flex flex-col gap-y-1">
      <Label size="small" weight="plus">
        {label}
      </Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {field("name", "Full name", "Jane Doe")}
      {field("email", "Email", "jane@example.com", "email")}
      {field("phone_country_code", "Phone country code", "1")}
      {field("phone", "Phone", "5551234567")}
      {field("company", "Company (optional)", "Acme Inc.")}
      {field("address_line1", "Address", "123 Main St")}
      {field("city", "City", "Springfield")}
      {field("state", "State / Region", "IL")}
      {field("country", "Country code", "US")}
      {field("postal_code", "Postal code", "62704")}
    </div>
  )
}

const buildContactPayload = (form: ContactForm, isDefault: boolean) => {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    email: form.email.trim(),
    is_default: isDefault,
  }
  if (form.phone.trim()) {
    payload.phone = form.phone.trim()
  }
  if (form.phone_country_code.trim()) {
    payload.phone_country_code = form.phone_country_code.trim()
  }
  if (form.company.trim()) {
    payload.company = form.company.trim()
  }
  if (form.address_line1.trim()) {
    payload.address_line1 = form.address_line1.trim()
  }
  if (form.city.trim()) {
    payload.city = form.city.trim()
  }
  if (form.state.trim()) {
    payload.state = form.state.trim()
  }
  if (form.country.trim()) {
    payload.country = form.country.trim()
  }
  if (form.postal_code.trim()) {
    payload.postal_code = form.postal_code.trim()
  }
  return payload
}

/* -------------------------------------------------------------------------- */
/*  Tab: Registrant profile                                                   */
/* -------------------------------------------------------------------------- */

const RegistrantTab = ({
  contacts,
  loading,
  error,
  onRefresh,
  onCreated,
}: {
  contacts: Contact[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCreated: () => void
}) => {
  const [form, setForm] = useState<ContactForm>(EMPTY_CONTACT)
  const [submitting, setSubmitting] = useState(false)
  const [makeDefault, setMakeDefault] = useState(true)

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Missing details", {
        description: "Name and email are required.",
      })
      return
    }
    setSubmitting(true)
    try {
      const isDefault = makeDefault || contacts.length === 0
      await api<CreateContactResponse>("/domains/contacts", {
        method: "POST",
        body: JSON.stringify(buildContactPayload(form, isDefault)),
      })
      toast.success("Registrant profile created")
      setForm(EMPTY_CONTACT)
      onCreated()
    } catch (err) {
      toast.error("Could not create profile", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <Text size="small" weight="plus">
            Registrant profiles
          </Text>
          <Button
            variant="secondary"
            size="small"
            onClick={onRefresh}
            isLoading={loading}
          >
            <ArrowPath />
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="bg-ui-tag-red-bg text-ui-tag-red-text rounded-lg p-3">
            <Text size="small" className="text-ui-tag-red-text">
              {error}
            </Text>
          </div>
        ) : null}

        {loading && contacts.length === 0 ? (
          <Skeleton className="h-16 w-full" />
        ) : contacts.length === 0 ? (
          <div className="border-ui-border-base rounded-lg border border-dashed py-8 text-center">
            <Text className="text-ui-fg-subtle">
              No registrant profile yet — create one below. It is used as the
              WHOIS registrant for purchases.
            </Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Email</Table.HeaderCell>
                  <Table.HeaderCell>Default</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {contacts.map((contact) => (
                  <Table.Row key={contact.id}>
                    <Table.Cell>{contact.name}</Table.Cell>
                    <Table.Cell>{contact.email}</Table.Cell>
                    <Table.Cell>
                      {contact.is_default ? (
                        <Badge size="2xsmall" color="green">
                          Default
                        </Badge>
                      ) : (
                        <Badge size="2xsmall" color="grey">
                          —
                        </Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      <Divider />

      <div className="flex flex-col gap-y-4">
        <Text size="small" weight="plus">
          {contacts.length === 0 ? "Create registrant profile" : "Add profile"}
        </Text>
        <ContactFormFields form={form} setForm={setForm} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <Checkbox
              checked={makeDefault}
              onCheckedChange={(v) => setMakeDefault(v === true)}
              disabled={contacts.length === 0}
            />
            <Label size="small">Set as default registrant</Label>
          </div>
          <Button onClick={handleCreate} isLoading={submitting}>
            <Plus />
            Create profile
          </Button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const DomainsPage = () => {
  const [tab, setTab] = useState("my-domains")

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [domains, setDomains] = useState<Domain[]>([])
  const [domainsLoading, setDomainsLoading] = useState(true)
  const [domainsError, setDomainsError] = useState<string | null>(null)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsError, setContactsError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await api<StatusResponse>("/domains/status")
      setStatus(res)
    } catch {
      setStatus({ configured: false, test_mode: false })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true)
    setDomainsError(null)
    try {
      const res = await api<ListDomainsResponse>("/domains")
      setDomains(res.domains ?? [])
    } catch (err) {
      setDomainsError(err instanceof Error ? err.message : "Failed to load domains")
    } finally {
      setDomainsLoading(false)
    }
  }, [])

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    setContactsError(null)
    try {
      const res = await api<ContactsResponse>("/domains/contacts")
      setContacts(res.contacts ?? [])
    } catch (err) {
      setContactsError(
        err instanceof Error ? err.message : "Failed to load contacts"
      )
    } finally {
      setContactsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    loadDomains()
    loadContacts()
  }, [loadStatus, loadDomains, loadContacts])

  const configured = status?.configured === true
  const hasContact = contacts.length > 0

  return (
    <Container className="p-0">
      <PageHeader />

      {statusLoading ? null : !configured ? <NotConfiguredNotice /> : null}
      {!statusLoading && configured && status?.test_mode ? (
        <div className="px-6 pb-2">
          <Badge size="2xsmall" color="blue">
            Test mode
          </Badge>
        </div>
      ) : null}

      <Divider />

      <div className="px-6 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="my-domains">My Domains</Tabs.Trigger>
            <Tabs.Trigger value="find">Find a domain</Tabs.Trigger>
            <Tabs.Trigger value="transfer">Transfer in</Tabs.Trigger>
            <Tabs.Trigger value="registrant">Registrant profile</Tabs.Trigger>
          </Tabs.List>

          <div className="mt-5">
            <Tabs.Content value="my-domains">
              <MyDomainsTab
                domains={domains}
                loading={domainsLoading}
                error={domainsError}
                onRefresh={loadDomains}
                onFindClick={() => setTab("find")}
              />
            </Tabs.Content>

            <Tabs.Content value="find">
              <FindDomainTab
                configured={configured}
                hasContact={hasContact}
                onPurchased={loadDomains}
                onCreateContact={() => setTab("registrant")}
              />
            </Tabs.Content>

            <Tabs.Content value="transfer">
              <TransferInTab configured={configured} onTransferred={loadDomains} />
            </Tabs.Content>

            <Tabs.Content value="registrant">
              <RegistrantTab
                contacts={contacts}
                loading={contactsLoading}
                error={contactsError}
                onRefresh={loadContacts}
                onCreated={loadContacts}
              />
            </Tabs.Content>
          </div>
        </Tabs>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Domains",
  icon: Globe,
})

export default DomainsPage
