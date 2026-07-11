"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getSettings,
  updateSettings,
  listThemes,
  updateTheme,
  getCredits,
  listPaymentGateways,
  updatePaymentGateway,
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  topUpCredits,
  ApiError,
  Settings,
  Theme,
  CreditsResponse,
  PaymentGateway,
  GatewayCredential,
  MfaSetup,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { AuthGate } from "../../../components/merchant-admin/auth-gate"
import {
  Spinner,
  CheckCircleSolid,
  ExclamationCircleSolid,
  BuildingStorefront,
  Palette,
  CreditCard,
  LockClosedSolid,
  CurrencyDollar,
  ArrowUpRightOnBox,
  GlobeEurope,
  BuildingTax,
  MapPin,
  ArrowUturnLeft,
  Key,
  ShieldCheck,
  SquareTwoStack,
} from "@medusajs/icons"

function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

function Alert({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  const isError = type === "error"
  return (
    <div
      className={classNames(
        "mb-6 rounded-base border px-4 py-3 text-sm",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-700"
      )}
    >
      {children}
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-large border border-grey-20 bg-white p-6 shadow-borders-base">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-base bg-grey-10 p-2 text-grey-60">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-grey-90">{title}</h2>
          {description && <p className="text-sm text-grey-50">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Button({
  children,
  loading = false,
  disabled = false,
  variant = "primary",
  type = "button",
  onClick,
  className,
}: {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  variant?: "primary" | "secondary" | "danger"
  type?: "button" | "submit"
  onClick?: () => void
  className?: string
}) {
  const variantClasses = {
    primary: "bg-grey-90 text-white hover:bg-grey-80",
    secondary: "border border-grey-30 bg-white text-grey-90 hover:bg-grey-10",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classNames(
        "inline-flex items-center justify-center rounded-base px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
    >
      {loading && <Spinner className="mr-1.5 h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={classNames(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-grey-90 focus:ring-offset-2",
        checked ? "bg-grey-90" : "bg-grey-30"
      )}
    >
      <span
        className={classNames(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}

const settingsLinks = [
  {
    href: "/dashboard/settings/store",
    label: "Store",
    description: "Currencies and store defaults.",
    icon: BuildingStorefront,
  },
  {
    href: "/dashboard/settings/regions",
    label: "Regions",
    description: "Shipping and tax regions.",
    icon: GlobeEurope,
  },
  {
    href: "/dashboard/settings/taxes",
    label: "Taxes",
    description: "Tax regions and default rates.",
    icon: BuildingTax,
  },
  {
    href: "/dashboard/settings/locations",
    label: "Locations",
    description: "Stock locations for inventory.",
    icon: MapPin,
  },
  {
    href: "/dashboard/settings/return-reasons",
    label: "Return reasons",
    description: "Reasons customers can pick for returns.",
    icon: ArrowUturnLeft,
  },
]

type GatewayFormState = {
  enabled: boolean
  credentials: Record<string, string>
  originalSet: Record<string, boolean>
}

function SettingsPageContent() {
  const { token, me, refreshMe } = useMerchantAuth()

  // Global alerts
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Store details
  const [settings, setSettings] = useState<Settings | null>(null)
  const [storeName, setStoreName] = useState("")
  const [savingName, setSavingName] = useState(false)

  // Theme
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeTheme, setActiveTheme] = useState("")
  const [savingTheme, setSavingTheme] = useState(false)

  // Credits
  const [credits, setCredits] = useState<CreditsResponse | null>(null)

  // Payment gateways
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [gatewayForms, setGatewayForms] = useState<Record<string, GatewayFormState>>({})
  const [savingGatewayId, setSavingGatewayId] = useState<string | null>(null)
  const [openGateway, setOpenGateway] = useState<string | null>(null)

  // MFA
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)

  // Top-up
  const [topUpAmount, setTopUpAmount] = useState("")
  const [toppingUp, setToppingUp] = useState(false)

  const [loading, setLoading] = useState(true)

  const domain = useMemo(() => {
    return settings?.domain || me?.store?.slug
      ? `${settings?.domain ?? `${me?.store?.slug}.mautomate.ai`}`
      : "—"
  }, [settings, me])

  const creditBalance = credits?.balance ?? me?.store?.credit_balance ?? 0

  const showAlert = (type: "error" | "success", message: string) => {
    if (type === "error") {
      setError(message)
      setSuccess(null)
    } else {
      setSuccess(message)
      setError(null)
    }
  }

  const clearAlerts = () => {
    setError(null)
    setSuccess(null)
  }

  const fetchAll = async () => {
    if (!token) return
    setLoading(true)
    clearAlerts()
    try {
      const [settingsData, themesData, creditsData, gatewaysData, mfaData] = await Promise.all([
        getSettings(token),
        listThemes(token),
        getCredits(token),
        listPaymentGateways(token),
        getMfaStatus(token),
      ])

      setSettings(settingsData)
      setStoreName(settingsData.name)

      setThemes(themesData.themes)
      setActiveTheme(themesData.active_theme)

      setCredits(creditsData)

      setGateways(gatewaysData.gateways)
      const forms: Record<string, GatewayFormState> = {}
      gatewaysData.gateways.forEach((g) => {
        const credentials: Record<string, string> = {}
        const originalSet: Record<string, boolean> = {}
        g.credentials.forEach((c) => {
          credentials[c.key] = c.value ?? ""
          originalSet[c.key] = !!c.is_set
        })
        forms[g.id] = { enabled: g.enabled, credentials, originalSet }
      })
      setGatewayForms(forms)

      setMfaEnabled(mfaData.mfa_enabled)
    } catch (err) {
      showAlert("error", err instanceof Error ? err.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !storeName.trim()) return
    setSavingName(true)
    clearAlerts()
    try {
      await updateSettings(token, { name: storeName.trim() })
      await refreshMe()
      showAlert("success", "Store name saved.")
    } catch (err) {
      showAlert("error", err instanceof Error ? err.message : "Failed to save store name")
    } finally {
      setSavingName(false)
    }
  }

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !activeTheme) return
    setSavingTheme(true)
    clearAlerts()
    try {
      await updateTheme(token, { active_theme: activeTheme })
      showAlert("success", "Theme updated.")
    } catch (err) {
      showAlert("error", err instanceof Error ? err.message : "Failed to update theme")
    } finally {
      setSavingTheme(false)
    }
  }

  const handleGatewayCredentialChange = (
    gatewayId: string,
    key: string,
    value: string
  ) => {
    setGatewayForms((prev) => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        credentials: { ...prev[gatewayId].credentials, [key]: value },
      },
    }))
  }

  const handleGatewayToggle = (gatewayId: string, enabled: boolean) => {
    setGatewayForms((prev) => ({
      ...prev,
      [gatewayId]: { ...prev[gatewayId], enabled },
    }))
  }

  const handleSaveGateway = async (gateway: PaymentGateway) => {
    if (!token) return
    const form = gatewayForms[gateway.id]
    if (!form) return

    setSavingGatewayId(gateway.id)
    clearAlerts()
    try {
      const credentials: Record<string, string | null> = {}
      gateway.credentials.forEach((c) => {
        const value = form.credentials[c.key]
        if (c.secret && !value.trim() && form.originalSet[c.key]) {
          // Leave existing secret intact
          return
        }
        credentials[c.key] = value.trim() || (c.secret ? null : "")
      })

      const updated = await updatePaymentGateway(token, {
        gateway_id: gateway.id,
        enabled: form.enabled,
        enabled_regions: gateway.countries,
        credentials,
      })

      setGateways((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))

      // Rebuild form state from response so secret placeholders stay correct
      const nextForms: Record<string, GatewayFormState> = { ...gatewayForms }
      const nextCredentials: Record<string, string> = {}
      const nextOriginalSet: Record<string, boolean> = {}
      updated.credentials.forEach((c) => {
        nextCredentials[c.key] = c.value ?? ""
        nextOriginalSet[c.key] = !!c.is_set
      })
      nextForms[updated.id] = { enabled: updated.enabled, credentials: nextCredentials, originalSet: nextOriginalSet }
      setGatewayForms(nextForms)

      showAlert("success", `${updated.name} settings saved.`)
    } catch (err) {
      showAlert("error", err instanceof Error ? err.message : "Failed to save gateway")
    } finally {
      setSavingGatewayId(null)
    }
  }

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const amount = Number(topUpAmount)
    if (!amount || amount <= 0) {
      showAlert("error", "Enter a valid amount.")
      return
    }
    setToppingUp(true)
    clearAlerts()
    try {
      const result = await topUpCredits(token, { credits: amount, amount_usd: amount })
      if (result.checkout_url) {
        window.location.href = result.checkout_url
        return
      }
      showAlert("error", "No checkout URL returned. Please try again.")
    } catch (err) {
      showAlert("error", err instanceof Error ? err.message : "Top-up failed")
    } finally {
      setToppingUp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-grey-50">
        <Spinner className="mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Store details, theme, payments, security, and billing."
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Store */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-grey-50">
          Store
        </h2>

      <SectionCard
        icon={BuildingStorefront}
        title="Store details"
        description="Your store name and public address."
      >
        <form onSubmit={handleSaveStoreName} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Store name" htmlFor="store-name">
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="My store"
              />
            </FormField>
            <FormField label="Domain / slug" htmlFor="store-domain">
              <Input
                id="store-domain"
                value={domain}
                disabled
                className="font-mono text-grey-60"
              />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={savingName} disabled={!storeName.trim()}>
              Save store name
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        icon={Palette}
        title="Theme"
        description="Choose the active storefront theme."
      >
        <form onSubmit={handleSaveTheme} className="space-y-4">
          <FormField label="Active theme" htmlFor="active-theme">
            <Select
              id="active-theme"
              value={activeTheme}
              onChange={(e) => setActiveTheme(e.target.value)}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>
          {activeTheme && (
            <p className="text-sm text-grey-50">
              {themes.find((t) => t.id === activeTheme)?.description}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={savingTheme}>
              Save theme
            </Button>
          </div>
        </form>
      </SectionCard>
      </section>

      {/* Payments & selling */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-grey-50">
          Payments &amp; selling
        </h2>

      <SectionCard
        icon={CreditCard}
        title="Payment providers"
        description="Connect the gateways you want to offer at checkout."
      >
        {gateways.length === 0 ? (
          <p className="text-sm text-grey-50">
            No payment providers are available for your region.
          </p>
        ) : (
          <div className="divide-y divide-grey-20 overflow-hidden rounded-large border border-grey-20">
            {gateways.map((gateway) => {
              const form = gatewayForms[gateway.id]
              if (!form) return null
              const open = openGateway === gateway.id
              return (
                <div key={gateway.id} className="bg-white">
                  {/* Compact row */}
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-2xl" aria-hidden="true">
                      {gateway.logo || "💳"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-grey-90">
                          {gateway.name}
                        </h3>
                        <StatusBadge
                          status={gateway.configured ? "configured" : "not configured"}
                        />
                      </div>
                      <p className="truncate text-sm text-grey-50">{gateway.blurb}</p>
                    </div>
                    <Toggle
                      checked={form.enabled}
                      onChange={(v) => handleGatewayToggle(gateway.id, v)}
                      label={`Toggle ${gateway.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setOpenGateway(open ? null : gateway.id)}
                      aria-expanded={open}
                      className="inline-flex shrink-0 items-center gap-1 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
                    >
                      {gateway.configured ? "Manage" : "Set up"}
                      <svg
                        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded configuration */}
                  {open && (
                    <div className="space-y-4 border-t border-grey-20 bg-grey-10/50 p-4">
                      {gateway.setup_guide && (
                        <div className="rounded-base bg-white p-3 text-sm text-grey-70 ring-1 ring-inset ring-grey-20">
                          {gateway.setup_guide.intro && (
                            <p className="mb-2">{gateway.setup_guide.intro}</p>
                          )}
                          <ol className="list-decimal space-y-1 pl-4">
                            {gateway.setup_guide.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                          {gateway.setup_guide.docs_url && (
                            <a
                              href={gateway.setup_guide.docs_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-grey-90 underline hover:text-grey-70"
                            >
                              Provider docs
                              <ArrowUpRightOnBox className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {gateway.credentials.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {gateway.credentials.map((cred) => (
                            <GatewayCredentialField
                              key={cred.key}
                              gateway={gateway}
                              credential={cred}
                              value={form.credentials[cred.key]}
                              onChange={(v) =>
                                handleGatewayCredentialChange(gateway.id, cred.key, v)
                              }
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          loading={savingGatewayId === gateway.id}
                          onClick={() => handleSaveGateway(gateway)}
                        >
                          Save {gateway.name}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
      </section>

      {/* Security */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-grey-50">
          Security
        </h2>

      <SectionCard
        icon={LockClosedSolid}
        title="Two-factor authentication"
        description="Add an extra layer of security to your merchant account."
      >
        <MfaSection
          token={token}
          enabled={mfaEnabled === true}
          onEnabledChange={setMfaEnabled}
        />
      </SectionCard>
      </section>

      {/* Billing & credits */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-grey-50">
          Billing &amp; credits
        </h2>

      <SectionCard
        icon={CurrencyDollar}
        title="Credits"
        description="Your balance and a quick top-up."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-base bg-grey-10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-grey-70">
              <span>Current balance:</span>
              <span className="font-semibold text-grey-90">{creditBalance.toLocaleString()} credits</span>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-1 text-sm font-medium text-grey-90 underline hover:text-grey-70"
            >
              Plans, usage &amp; invoices
              <ArrowUpRightOnBox className="h-3.5 w-3.5" />
            </Link>
          </div>
          <form onSubmit={handleTopUp} className="space-y-4">
            <FormField label="Credits to buy" htmlFor="top-up-amount" hint="1 credit = $1 USD">
              <Input
                id="top-up-amount"
                type="number"
                min={1}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="e.g. 50"
              />
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" loading={toppingUp} disabled={!topUpAmount || Number(topUpAmount) <= 0}>
                Top up
              </Button>
            </div>
          </form>
        </div>
      </SectionCard>
      </section>

      {/* More settings */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-grey-50">
          More settings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-large border border-grey-20 bg-white p-4 shadow-borders-base transition-colors hover:bg-grey-10"
            >
              <div className="rounded-base bg-grey-10 p-2 text-grey-60">
                <link.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-grey-90">{link.label}</h3>
                <p className="text-sm text-grey-50">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function CopyText({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const ta = document.createElement("textarea")
        ta.value = value
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied; the value stays visible for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={classNames(
        "inline-flex shrink-0 items-center gap-1.5 rounded-base border border-grey-30 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10",
        className
      )}
    >
      {copied ? (
        <CheckCircleSolid className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <SquareTwoStack className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function BackupCodesPanel({
  codes,
  onDismiss,
}: {
  codes: string[]
  onDismiss: () => void
}) {
  return (
    <div className="rounded-base border border-emerald-200 bg-emerald-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Key className="h-5 w-5 text-emerald-600" />
        <p className="text-sm font-semibold text-grey-90">Save your backup codes</p>
      </div>
      <p className="mb-3 text-xs text-grey-60">
        Each code can be used once if you lose access to your authenticator app.
        Store them somewhere safe — they will not be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {codes.map((c) => (
          <code
            key={c}
            className="rounded-base border border-emerald-200 bg-white px-2 py-1.5 text-center font-mono text-sm tracking-wider text-grey-90"
          >
            {c}
          </code>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <CopyText value={codes.join("\n")} />
        <Button variant="secondary" onClick={onDismiss}>
          I have saved them
        </Button>
      </div>
    </div>
  )
}

function MfaSection({
  token,
  enabled,
  onEnabledChange,
}: {
  token: string | null
  enabled: boolean
  onEnabledChange: (v: boolean) => void
}) {
  // Enrollment flow
  const [setup, setSetup] = useState<MfaSetup | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [savedBackupCodes, setSavedBackupCodes] = useState<string[] | null>(null)
  const [justEnabled, setJustEnabled] = useState(false)

  // Disable flow
  const [showDisable, setShowDisable] = useState(false)
  const [disableCode, setDisableCode] = useState("")

  const sanitizeDigits = (v: string) => v.replace(/\D/g, "").slice(0, 6)

  const friendlyError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 400) {
      return "That code didn't match, try again."
    }
    return err instanceof Error ? err.message : fallback
  }

  const beginSetup = async () => {
    if (!token) return
    setBusy(true)
    setLocalError(null)
    try {
      const data = await setupMfa(token)
      setSetup(data)
      setCode("")
    } catch (err) {
      setLocalError(friendlyError(err, "Could not start MFA setup"))
    } finally {
      setBusy(false)
    }
  }

  const cancelSetup = () => {
    setSetup(null)
    setCode("")
    setLocalError(null)
  }

  const confirmEnable = async () => {
    if (!token || !setup) return
    if (!/^\d{6}$/.test(code)) {
      setLocalError("Enter the 6-digit code from your authenticator app.")
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await enableMfa(token, code)
      setSavedBackupCodes(setup.backup_codes)
      setSetup(null)
      setCode("")
      setJustEnabled(true)
      onEnabledChange(true)
    } catch (err) {
      setLocalError(friendlyError(err, "Could not enable MFA"))
    } finally {
      setBusy(false)
    }
  }

  const confirmDisable = async () => {
    if (!token) return
    const c = disableCode.trim()
    if (!c) {
      setLocalError("Enter a current code or a backup code to disable MFA.")
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await disableMfa(token, c)
      onEnabledChange(false)
      setShowDisable(false)
      setDisableCode("")
      setSavedBackupCodes(null)
      setJustEnabled(false)
    } catch (err) {
      setLocalError(friendlyError(err, "Could not disable MFA"))
    } finally {
      setBusy(false)
    }
  }

  // MFA ON
  if (enabled) {
    return (
      <div className="space-y-4">
        {savedBackupCodes && justEnabled && (
          <BackupCodesPanel
            codes={savedBackupCodes}
            onDismiss={() => {
              setSavedBackupCodes(null)
              setJustEnabled(false)
            }}
          />
        )}
        <div className="flex flex-col gap-4 rounded-base border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-grey-90">
                Two-factor authentication is on
              </p>
              <p className="text-xs text-grey-60">
                You will be asked for a code from your authenticator app when you sign in.
              </p>
            </div>
          </div>
          {!showDisable && (
            <Button
              variant="danger"
              onClick={() => {
                setShowDisable(true)
                setLocalError(null)
              }}
            >
              Disable
            </Button>
          )}
        </div>

        {showDisable && (
          <div className="space-y-3 rounded-base border border-grey-20 p-4">
            <p className="text-sm text-grey-70">
              Enter a current 6-digit code (or a backup code) to turn off
              two-factor authentication.
            </p>
            <FormField label="Authenticator or backup code" htmlFor="mfa-disable-code">
              <Input
                id="mfa-disable-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
              />
            </FormField>
            {localError && <p className="text-sm text-red-600">{localError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDisable(false)
                  setDisableCode("")
                  setLocalError(null)
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={confirmDisable}
                disabled={!disableCode.trim()}
              >
                Disable MFA
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // MFA OFF, mid-enrollment
  if (setup) {
    return (
      <div className="space-y-5">
        <div className="rounded-base bg-grey-10 p-4 text-sm text-grey-70">
          <p className="mb-2 font-medium text-grey-90">
            1. Add this account to your authenticator app
          </p>
          <p className="mb-3">
            Open Google Authenticator, Authy, or 1Password, add a new account,
            and enter this setup key manually:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-base border border-grey-30 bg-white px-3 py-2 font-mono text-sm tracking-wider text-grey-90">
              {setup.secret}
            </code>
            <CopyText value={setup.secret} />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-grey-50 hover:text-grey-70">
              Prefer a setup link? Show the otpauth URI
            </summary>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-base border border-grey-30 bg-white px-3 py-2 font-mono text-xs text-grey-70">
                {setup.qr_uri}
              </code>
              <CopyText value={setup.qr_uri} />
            </div>
            <p className="mt-1 text-xs text-grey-50">
              Account type: time-based (TOTP), SHA1, 6 digits, 30-second period.
            </p>
          </details>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-grey-90">
            2. Enter the 6-digit code from the app
          </p>
          <FormField label="Verification code" htmlFor="mfa-code">
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(sanitizeDigits(e.target.value))}
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              className="font-mono tracking-[0.4em]"
            />
          </FormField>
          {localError && <p className="text-sm text-red-600">{localError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={cancelSetup} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} onClick={confirmEnable} disabled={code.length !== 6}>
              Verify &amp; enable
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // MFA OFF, idle
  return (
    <div className="space-y-4">
      {savedBackupCodes && (
        <BackupCodesPanel
          codes={savedBackupCodes}
          onDismiss={() => setSavedBackupCodes(null)}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ExclamationCircleSolid className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-grey-90">
              Two-factor authentication is off
            </p>
            <p className="text-xs text-grey-60">
              Protect your account with a time-based code from an authenticator app.
            </p>
          </div>
        </div>
        <Button onClick={beginSetup} loading={busy}>
          Enable two-factor authentication
        </Button>
      </div>
      {localError && <p className="text-sm text-red-600">{localError}</p>}
    </div>
  )
}

function GatewayCredentialField({
  gateway,
  credential,
  value,
  onChange,
}: {
  gateway: PaymentGateway
  credential: GatewayCredential
  value: string
  onChange: (v: string) => void
}) {
  const isSecret = credential.secret
  const placeholder = credential.value || (credential.is_set ? "••••••••" : "")

  return (
    <FormField
      label={credential.label}
      htmlFor={`${gateway.id}-${credential.key}`}
      hint={credential.help}
    >
      <Input
        id={`${gateway.id}-${credential.key}`}
        type={isSecret ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  )
}

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsPageContent />
    </AuthGate>
  )
}
