/**
 * AI Call Center — Settings (Phase 4, read-only operator view).
 *
 * A documented configuration checklist for the operator: which integrations /
 * env are wired, the derived kill-switch state, and placeholders for business
 * hours, quiet hours and voice/model defaults that a dedicated settings API will
 * back later.
 *
 * There is NO settings API yet. This page:
 *   - tries GET /admin/call-center/settings and renders it when present;
 *   - otherwise falls back to a static, clearly-labelled checklist (never fails);
 *   - reads GET /admin/call-center/kill-switch (this endpoint DOES exist) to show
 *     the live outbound halt state, and links to the hub where the operator can
 *     act on the kill switch.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Adjustments,
  ArrowPath,
  BoltSolid,
  CheckCircle,
  Clock,
  ExclamationCircle,
} from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

/* ------------------------------------------------------------------ */
/* Types + fetch                                                       */
/* ------------------------------------------------------------------ */

type KillSwitch = {
  enabled: boolean
  outbound_halted: boolean
  running_campaigns: number
}

/**
 * Shape the (future) GET /admin/call-center/settings could return. Everything is
 * optional so a partial payload still renders. Until the endpoint exists the
 * page uses the static checklist below.
 */
type Settings = {
  env?: Record<string, boolean>
  business_hours?: { start?: string; end?: string; timezone?: string }
  quiet_hours?: { start?: string; end?: string }
  voice?: { provider?: string; voice_id?: string; language?: string }
  model?: { provider?: string; name?: string }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      (payload as any)?.message || `Request failed (${res.status})`
    ) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/**
 * The env keys the operator cares about. `hint` documents what each unlocks. We
 * cannot read process.env from the admin bundle, so presence is reported by the
 * (future) settings endpoint; until then each shows "unknown" with its purpose.
 */
const ENV_CHECKLIST: { key: string; hint: string }[] = [
  { key: "CALL_CENTER_ENABLED", hint: "Master flag — outbound calling on/off." },
  {
    key: "CALL_CENTER_DEFAULT_TENANT",
    hint: "Tenant every call-center row is scoped to.",
  },
  { key: "TELEPHONY_PROVIDER_API_KEY", hint: "Telephony/SIP provider credential." },
  { key: "TELEPHONY_FROM_NUMBER", hint: "Default caller id for outbound calls." },
  { key: "VOICE_TTS_API_KEY", hint: "Text-to-speech provider credential." },
  { key: "VOICE_LLM_API_KEY", hint: "LLM credential for the voice agent." },
  {
    key: "CALL_CENTER_AGENT_CONFIG_SECRET",
    hint: "Shared secret gating /telephony/agent-config.",
  },
]

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const SettingsPage = () => {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsPending, setSettingsPending] = useState(false)
  const [killSwitch, setKillSwitch] = useState<KillSwitch | null>(null)
  const [ksError, setKsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setKsError(null)
    // Settings endpoint is optional — a 404 (or anything) falls back to static.
    try {
      const s = await getJson<Settings>("/admin/call-center/settings")
      setSettings(s)
      setSettingsPending(false)
    } catch {
      setSettings(null)
      setSettingsPending(true)
    }
    // Kill-switch endpoint exists.
    try {
      const ks = await getJson<KillSwitch>("/admin/call-center/kill-switch")
      setKillSwitch(ks)
    } catch (e: any) {
      setKsError(e?.message ?? "Unexpected error.")
      setKillSwitch(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const env = settings?.env

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Settings</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Call-center configuration and integration status. Read-only — edits
            land with a dedicated settings API.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={load}
          isLoading={loading}
        >
          <ArrowPath />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-y-6 px-6 py-6">
        {/* Kill switch */}
        <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
          <div className="flex items-center gap-x-2">
            <BoltSolid className="text-ui-fg-subtle" />
            <Heading level="h3">Outbound calling</Heading>
          </div>
          {loading && !killSwitch ? (
            <Text size="small" className="text-ui-fg-subtle">
              Loading…
            </Text>
          ) : ksError ? (
            <Text size="small" className="text-ui-fg-error">
              Could not read kill-switch state: {ksError}
            </Text>
          ) : killSwitch ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatusTile
                  label="Master flag"
                  ok={killSwitch.enabled}
                  okText="Enabled"
                  offText="Disabled"
                />
                <StatusTile
                  label="Outbound"
                  ok={!killSwitch.outbound_halted}
                  okText="Active"
                  offText="Halted"
                />
                <div className="flex flex-col gap-y-0.5 rounded-lg bg-ui-bg-subtle px-3 py-2.5">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Running campaigns
                  </Text>
                  <Text size="large" weight="plus">
                    {killSwitch.running_campaigns}
                  </Text>
                </div>
              </div>
              <div className="flex items-center justify-between gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
                <Text size="small" className="text-ui-fg-subtle">
                  The emergency kill switch pauses every running campaign. Act on
                  it from the console hub.
                </Text>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => navigate("/call-center")}
                >
                  Open kill switch
                </Button>
              </div>
            </>
          ) : null}
        </div>

        {/* Environment / integrations */}
        <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
          <div className="flex items-center gap-x-2">
            <Adjustments className="text-ui-fg-subtle" />
            <Heading level="h3">Environment &amp; integrations</Heading>
          </div>
          {settingsPending && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-2.5">
              <Text size="small" className="text-ui-fg-subtle">
                No settings API yet — showing the required configuration
                checklist. Presence per key will populate once GET
                /admin/call-center/settings ships.
              </Text>
            </div>
          )}
          <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
            {ENV_CHECKLIST.map((item) => {
              const known = !!env && item.key in env
              const set = known ? !!env![item.key] : undefined
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-x-3 px-4 py-2.5"
                >
                  {set === undefined ? (
                    <ExclamationCircle className="shrink-0 text-ui-fg-muted" />
                  ) : set ? (
                    <CheckCircle className="shrink-0 text-ui-tag-green-text" />
                  ) : (
                    <ExclamationCircle className="shrink-0 text-ui-tag-orange-text" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Text size="small" weight="plus" className="font-mono">
                      {item.key}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {item.hint}
                    </Text>
                  </div>
                  <Badge
                    size="2xsmall"
                    color={
                      set === undefined ? "grey" : set ? "green" : "orange"
                    }
                  >
                    {set === undefined ? "unknown" : set ? "set" : "missing"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        {/* Hours */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HoursCard
            title="Business hours"
            icon
            hours={settings?.business_hours}
            todoNote="TODO: back with a settings API. Calls should only be placed within business hours for the tenant's timezone."
          />
          <HoursCard
            title="Quiet hours"
            hours={settings?.quiet_hours}
            todoNote="TODO: quiet hours suppress outbound dialing (e.g. nights). Placeholder until the settings API lands."
          />
        </div>

        {/* Voice / model defaults */}
        <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
          <Heading level="h3">Voice &amp; model defaults</Heading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Defn
              label="Voice provider"
              value={settings?.voice?.provider}
            />
            <Defn label="Voice id" value={settings?.voice?.voice_id} />
            <Defn label="Language" value={settings?.voice?.language} />
            <Defn label="Model provider" value={settings?.model?.provider} />
            <Defn label="Model" value={settings?.model?.name} />
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">
            TODO: defaults are compiled per-playbook today (see each playbook's
            persona). A settings API will let operators override them globally.
          </Text>
        </div>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function StatusTile({
  label,
  ok,
  okText,
  offText,
}: {
  label: string
  ok: boolean
  okText: string
  offText: string
}) {
  return (
    <div className="flex flex-col gap-y-1 rounded-lg bg-ui-bg-subtle px-3 py-2.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Badge size="small" color={ok ? "green" : "orange"}>
        {ok ? okText : offText}
      </Badge>
    </div>
  )
}

function HoursCard({
  title,
  icon,
  hours,
  todoNote,
}: {
  title: string
  icon?: boolean
  hours?: { start?: string; end?: string; timezone?: string }
  todoNote: string
}) {
  const configured = !!(hours?.start || hours?.end)
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-center gap-x-2">
        {icon && <Clock className="text-ui-fg-subtle" />}
        <Heading level="h3">{title}</Heading>
        {!configured && (
          <Badge size="2xsmall" color="grey">
            Not configured
          </Badge>
        )}
      </div>
      {configured ? (
        <div className="grid grid-cols-3 gap-3">
          <Defn label="Start" value={hours?.start} />
          <Defn label="End" value={hours?.end} />
          <Defn label="Timezone" value={hours?.timezone} />
        </div>
      ) : (
        <Text size="xsmall" className="text-ui-fg-muted">
          {todoNote}
        </Text>
      )}
    </div>
  )
}

function Defn({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-y-0.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="small" className={value ? "" : "text-ui-fg-muted"}>
        {value || "—"}
      </Text>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Settings",
  icon: Adjustments,
})

export default SettingsPage
