"use client"

import React, { useState } from "react"
import { Spinner } from "@medusajs/icons"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import {
  createDomainContact,
  DomainContact,
  DomainContactInput,
} from "@lib/merchant-admin/api"
import { Callout, btnPrimary, btnSecondary } from "./ui"

/**
 * Registrant profile form. A registrant profile (name / email / phone / address)
 * is required by the registrar before a domain can be bought or transferred in,
 * so this is shown inline the first time a merchant tries to buy without one.
 */
export function RegistrantProfileForm({
  token,
  onCreated,
  onCancel,
}: {
  token: string
  onCreated: (contact: DomainContact) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState<DomainContactInput>({
    name: "",
    email: "",
    phone: "",
    phone_country_code: "",
    company: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    is_default: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof DomainContactInput>(key: K, value: DomainContactInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone?.trim() &&
    form.address_line1?.trim() &&
    form.city?.trim() &&
    form.postal_code?.trim() &&
    form.country?.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const cc = (form.country || "").trim().toUpperCase()
      const res = await createDomainContact(token, {
        ...form,
        country: cc,
      })
      onCreated(res.contact)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Callout tone="info" title="One-time registrant profile">
        Registrars require a real name, email, phone and address for whoever owns
        the domain. We save this securely and reuse it for future purchases and
        transfers.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="rp-name">
          <Input
            id="rp-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Jane Doe"
          />
        </FormField>
        <FormField label="Email" htmlFor="rp-email">
          <Input
            id="rp-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </FormField>
        <FormField label="Company (optional)" htmlFor="rp-company">
          <Input
            id="rp-company"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Acme Inc."
          />
        </FormField>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <FormField label="Dial code" htmlFor="rp-cc" hint="e.g. +1">
            <Input
              id="rp-cc"
              value={form.phone_country_code}
              onChange={(e) => set("phone_country_code", e.target.value)}
              placeholder="+1"
            />
          </FormField>
          <FormField label="Phone" htmlFor="rp-phone">
            <Input
              id="rp-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="5551234567"
            />
          </FormField>
        </div>
      </div>

      <FormField label="Address line 1" htmlFor="rp-addr1">
        <Input
          id="rp-addr1"
          value={form.address_line1}
          onChange={(e) => set("address_line1", e.target.value)}
          placeholder="123 Market St"
        />
      </FormField>
      <FormField label="Address line 2 (optional)" htmlFor="rp-addr2">
        <Input
          id="rp-addr2"
          value={form.address_line2}
          onChange={(e) => set("address_line2", e.target.value)}
          placeholder="Suite 400"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="City" htmlFor="rp-city">
          <Input
            id="rp-city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="San Francisco"
          />
        </FormField>
        <FormField label="State / region" htmlFor="rp-state">
          <Input
            id="rp-state"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            placeholder="CA"
          />
        </FormField>
        <FormField label="Postal code" htmlFor="rp-zip">
          <Input
            id="rp-zip"
            value={form.postal_code}
            onChange={(e) => set("postal_code", e.target.value)}
            placeholder="94105"
          />
        </FormField>
        <FormField label="Country (ISO-2)" htmlFor="rp-country" hint="e.g. US, GB, BD">
          <Input
            id="rp-country"
            value={form.country}
            onChange={(e) => set("country", e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="US"
          />
        </FormField>
      </div>

      <FormToggle
        checked={!!form.is_default}
        onChange={(v) => set("is_default", v)}
        label="Use as my default registrant profile"
      />

      {error && (
        <Callout tone="warning">{error}</Callout>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={!canSubmit || saving} className={btnPrimary}>
          {saving && <Spinner className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  )
}
