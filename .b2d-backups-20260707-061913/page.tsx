"use client"

import React, { useEffect, useMemo, useState } from "react"
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
  topUpCredits,
  Settings,
  Theme,
  CreditsResponse,
  PaymentGateway,
  GatewayCredential,
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

  // MFA
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [enablingMfa, setEnablingMfa] = useState(false)

  // Top-up
  const [topUpAmount, setTopUpAmount] = useState("")
  const [toppingUp, setToppingUp] = useState(false)

  const [loading, setLoading] = useState(true)

  const domain = useMemo(() => {
    return settings?.domain || me?.store?.slug
      ? `${settings?.domain ?? `${me?.store?.slug}.brandtodoor.com`}`
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

  const handleEnableMfa = async () => {
    if (!token) return
    setEnablingMfa(true)
    clearAlerts()
    try {
      // Phase 5 only exposes status; a setup endpoint may be added later.
      showAlert(
        "error",
        "MFA setup is not available in this phase. Please contact support to enable two-factor authentication."
      )
    } finally {
      setEnablingMfa(false)
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
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage store details, theme, payment providers, MFA, and credits."
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-grey-70">
              <span>Credit balance:</span>
              <span className="font-semibold text-grey-90">{creditBalance.toLocaleString()} credits</span>
            </div>
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

      <SectionCard
        icon={CreditCard}
        title="Payment providers"
        description="Connect the gateways you want to offer at checkout."
      >
        <div className="space-y-6">
          {gateways.length === 0 ? (
            <p className="text-sm text-grey-50">No payment providers are available for your region.</p>
          ) : (
            gateways.map((gateway) => {
              const form = gatewayForms[gateway.id]
              if (!form) return null
              return (
                <div
                  key={gateway.id}
                  className="rounded-base border border-grey-20 p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {gateway.logo || "💳"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-grey-90">{gateway.name}</h3>
                          {gateway.configured ? (
                            <StatusBadge status="configured" />
                          ) : (
                            <StatusBadge status="not configured" />
                          )}
                        </div>
                        <p className="text-sm text-grey-50">{gateway.blurb}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-grey-70">
                        {form.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Toggle
                        checked={form.enabled}
                        onChange={(v) => handleGatewayToggle(gateway.id, v)}
                        label={`Toggle ${gateway.name}`}
                      />
                    </div>
                  </div>

                  {gateway.setup_guide && (
                    <div className="mb-4 rounded-base bg-grey-10 p-3 text-sm text-grey-70">
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
                          onChange={(v) => handleGatewayCredentialChange(gateway.id, cred.key, v)}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      loading={savingGatewayId === gateway.id}
                      onClick={() => handleSaveGateway(gateway)}
                    >
                      Save {gateway.name}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={LockClosedSolid}
        title="Two-factor authentication"
        description="Add an extra layer of security to your merchant account."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {mfaEnabled ? (
              <>
                <CheckCircleSolid className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-grey-90">MFA is enabled</span>
              </>
            ) : (
              <>
                <ExclamationCircleSolid className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-grey-90">MFA is not enabled</span>
              </>
            )}
          </div>
          {!mfaEnabled && (
            <Button onClick={handleEnableMfa} loading={enablingMfa}>
              Enable MFA
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={CurrencyDollar}
        title="Credits top-up"
        description="Buy credits to keep your store running."
      >
        <form onSubmit={handleTopUp} className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-grey-70">
            <span>Current balance:</span>
            <span className="font-semibold text-grey-90">{creditBalance.toLocaleString()} credits</span>
          </div>
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
      </SectionCard>
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
