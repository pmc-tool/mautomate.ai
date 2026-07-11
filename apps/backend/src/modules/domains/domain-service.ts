/**
 * Domain service — orchestration between the ResellerClub provider and the local
 * domain/order/contact models. The API routes call these; the provider does the
 * registrar I/O. Every function is NO-THROW and returns a plain result object.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { DOMAINS_MODULE } from "./index"
import {
  getRegistrarProvider,
  getResellerConfig,
  DOMAINS_DEFAULT_TENANT,
} from "./provider"
import type {
  ContactInput,
  CustomerInput,
  DnsRecordInput,
  RegistrarProvider,
} from "./provider"

export type ServiceResult<T = any> = { ok: boolean; data?: T; error?: string }

type DomainStatus =
  | "active"
  | "pending_register"
  | "pending_transfer"
  | "expired"
  | "failed"

const NOT_CONFIGURED = "Domain registrar is not configured."

const err = (message: string): ServiceResult => ({ ok: false, error: message })

const tenantOf = (tenantId?: string): string => tenantId || DOMAINS_DEFAULT_TENANT

/** Resolve the registrar provider or a clean "not configured" result. */
const requireProvider = ():
  | { ok: true; provider: RegistrarProvider }
  | { ok: false; error: string } => {
  const provider = getRegistrarProvider()
  if (!provider) {
    return { ok: false, error: NOT_CONFIGURED }
  }
  return { ok: true, provider }
}

/** "example.com" | "example" → "example" (strip any tld). */
const parseSld = (query: string): string => {
  const q = (query ?? "").trim().toLowerCase()
  const dot = q.indexOf(".")
  return dot === -1 ? q : q.slice(0, dot)
}

/** "shop.example.com" → { sld: "shop", tld: "example.com" }. */
const splitDomain = (domainName: string): { sld: string; tld: string } => {
  const d = (domainName ?? "").trim().toLowerCase()
  const dot = d.indexOf(".")
  if (dot === -1) {
    return { sld: d, tld: "" }
  }
  return { sld: d.slice(0, dot), tld: d.slice(dot + 1) }
}

/** Registrar status → local DomainModel.status. */
const mapRegistrarStatus = (status?: string | null): DomainStatus => {
  const s = (status ?? "").toLowerCase()
  if (s.includes("pendingtransfer") || s.includes("transfer")) {
    return "pending_transfer"
  }
  if (s.includes("expire")) {
    return "expired"
  }
  if (s.includes("fail")) {
    return "failed"
  }
  if (s.includes("pending")) {
    return "pending_register"
  }
  if (
    s.includes("active") ||
    s.includes("success") ||
    s.includes("invoicepaid")
  ) {
    return "active"
  }
  return "active"
}

/** Async action status (register/transfer) → local active|pending_*. */
const actionStatusToLocal = (
  actionStatus: string | undefined,
  pending: DomainStatus
): DomainStatus => {
  const s = (actionStatus ?? "").toLowerCase()
  return s.includes("success") ||
    s.includes("active") ||
    s.includes("invoicepaid")
    ? "active"
    : pending
}

const toDate = (v?: string | null): Date | null =>
  v ? new Date(v) : null

/** Map a local contact row → registrar CustomerInput/ContactInput. */
const contactToCustomerInput = (contact: any): CustomerInput => ({
  name: contact.name,
  email: contact.email,
  phone: contact.phone ?? "",
  phoneCountryCode: contact.phone_country_code ?? "",
  company: contact.company ?? undefined,
  addressLine1: contact.address_line1 ?? "",
  addressLine2: contact.address_line2 ?? undefined,
  city: contact.city ?? "",
  state: contact.state ?? "",
  country: contact.country ?? "",
  postalCode: contact.postal_code ?? "",
})

/** Find the local DomainModel row for a (tenant, domain). */
const findDomainRow = async (
  domainsModule: any,
  tenantId: string,
  domainName: string
): Promise<any | null> => {
  const rows = await domainsModule.listDomainModels({
    tenant_id: tenantId,
    domain_name: domainName,
  })
  return rows?.[0] ?? null
}

/** Load contact by id or the tenant default (falling back to first). */
const resolveContact = async (
  domainsModule: any,
  tenantId: string,
  contactId?: string
): Promise<
  { ok: true; contact: any } | { ok: false; error: string }
> => {
  if (contactId) {
    const rows = await domainsModule.listDomainContacts({
      id: contactId,
      tenant_id: tenantId,
    })
    if (rows?.length) {
      return { ok: true, contact: rows[0] }
    }
    return { ok: false, error: "Registrant contact was not found." }
  }
  const defaults = await domainsModule.listDomainContacts({
    tenant_id: tenantId,
    is_default: true,
  })
  if (defaults?.length) {
    return { ok: true, contact: defaults[0] }
  }
  const any = await domainsModule.listDomainContacts({ tenant_id: tenantId })
  if (any?.length) {
    return { ok: true, contact: any[0] }
  }
  return {
    ok: false,
    error: "No registrant profile found. Create a registrant profile first.",
  }
}

/**
 * Ensure a reseller customer + contact exist for a local contact row. Reuses the
 * persisted ids when present; otherwise provisions them and persists them back.
 */
const ensureResellerContact = async (
  domainsModule: any,
  provider: RegistrarProvider,
  contact: any
): Promise<
  { ok: true; customerId: string; contactId: string } | { ok: false; error: string }
> => {
  if (!contact) {
    return {
      ok: false,
      error: "No registrant profile found. Create a registrant profile first.",
    }
  }
  if (contact.reseller_customer_id && contact.reseller_contact_id) {
    return {
      ok: true,
      customerId: contact.reseller_customer_id,
      contactId: contact.reseller_contact_id,
    }
  }

  const customerInput = contactToCustomerInput(contact)

  let customerId = contact.reseller_customer_id as string | undefined
  if (!customerId) {
    const cust = await provider.addCustomer(customerInput)
    if (!cust.ok || !cust.data?.customerId) {
      return {
        ok: false,
        error: cust.error ?? "Failed to create registrar customer.",
      }
    }
    customerId = cust.data.customerId
  }

  const contactInput: ContactInput = { ...customerInput }
  const cont = await provider.addContact(customerId, contactInput)
  if (!cont.ok || !cont.data?.contactId) {
    return {
      ok: false,
      error: cont.error ?? "Failed to create registrar contact.",
    }
  }
  const contactId = cont.data.contactId

  await domainsModule.updateDomainContacts({
    id: contact.id,
    reseller_customer_id: customerId,
    reseller_contact_id: contactId,
  } as any)

  return { ok: true, customerId, contactId }
}

/** Resolve the registrar order id (local row first, then provider lookup). */
const resolveOrderId = async (
  domainsModule: any,
  provider: RegistrarProvider,
  tenantId: string,
  domainName: string,
  row?: any
): Promise<
  { ok: true; orderId: string; row: any | null } | { ok: false; error: string }
> => {
  const r = row ?? (await findDomainRow(domainsModule, tenantId, domainName))
  if (r?.reseller_order_id) {
    return { ok: true, orderId: r.reseller_order_id, row: r }
  }
  const res = await provider.getOrderId(domainName)
  if (!res.ok || !res.data) {
    return {
      ok: false,
      error: res.error ?? "Could not resolve the registrar order id.",
    }
  }
  return { ok: true, orderId: res.data, row: r }
}

/** Search availability + pricing for a query across tlds. */
export const searchDomains = async (
  container: MedusaContainer,
  i: { tenantId: string; query: string; tlds?: string[] }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider

    const sld = parseSld(i.query)
    if (!sld) {
      return err("A domain query is required.")
    }
    const tlds = i.tlds ?? ["com", "net", "org", "io", "co", "shop"]

    const avail = await provider.checkAvailability([sld], tlds)
    if (!avail.ok) {
      return err(avail.error ?? "Availability lookup failed.")
    }

    const pricingRes = await provider.getPricing()
    const pricing = pricingRes.ok ? pricingRes.data ?? {} : {}

    const results = (avail.data ?? []).map((r) => ({
      ...r,
      price: r.price ?? pricing[r.tld] ?? null,
    }))

    return { ok: true, data: { query: i.query, results } }
  } catch (e: any) {
    return err(e?.message ?? "Domain search failed.")
  }
}

/** Register a new domain (ensures reseller customer+contact, then registers). */
export const buyDomain = async (
  container: MedusaContainer,
  i: {
    tenantId: string
    domainName: string
    years: number
    nameservers?: string[]
    contactId?: string
    privacy?: boolean
    autoRenew?: boolean
    userId?: string
  }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)
    const config = getResellerConfig()
    const { tld } = splitDomain(i.domainName)

    // When no registrar is configured, record the request as a manual purchase
    // so an operator can complete it via the console and then activate it.
    if (!p.ok) {
      const [order] = await domainsModule.createDomainOrders([
        {
          tenant_id: tenantId,
          domain_name: i.domainName,
          tld,
          action: "register",
          years: i.years,
          status: "pending_manual",
          created_by_user_id: i.userId ?? null,
        },
      ] as any)

      const [domain] = await domainsModule.createDomainModels([
        {
          tenant_id: tenantId,
          domain_name: i.domainName,
          tld,
          status: "pending_register",
          source: "registered",
          years: i.years,
          auto_renew: !!i.autoRenew,
          privacy_enabled: !!i.privacy,
          nameservers: i.nameservers ?? config.defaultNameservers,
        },
      ] as any)

      return {
        ok: true,
        data: {
          order,
          domain,
          manual_approval: true,
          message:
            "Domain registrar is not configured. The purchase is recorded as pending manual approval; set RESELLERCLUB_AUTH_USERID and RESELLERCLUB_API_KEY to enable automatic registration.",
        },
      }
    }

    const provider = p.provider

    const contactRes = await resolveContact(
      domainsModule,
      tenantId,
      i.contactId
    )
    if (!contactRes.ok) {
      return err(contactRes.error)
    }
    const reseller = await ensureResellerContact(
      domainsModule,
      provider,
      contactRes.contact
    )
    if (!reseller.ok) {
      return err(reseller.error)
    }

    const nameservers = i.nameservers ?? config.defaultNameservers

    const [order] = await domainsModule.createDomainOrders([
      {
        tenant_id: tenantId,
        domain_name: i.domainName,
        tld,
        action: "register",
        years: i.years,
        status: "processing",
        created_by_user_id: i.userId ?? null,
      },
    ] as any)

    const reg = await provider.registerDomain({
      domainName: i.domainName,
      years: i.years,
      nameservers,
      customerId: reseller.customerId,
      contactId: reseller.contactId,
      protectPrivacy: i.privacy,
      autoRenew: i.autoRenew,
    })

    if (!reg.ok) {
      const [failed] = await domainsModule.updateDomainOrders([
        {
          id: order.id,
          status: "failed",
          error: reg.error ?? "Registration failed.",
        },
      ] as any)
      return { ok: false, error: reg.error ?? "Registration failed.", data: { order: failed } }
    }

    const action = reg.data
    const [updatedOrder] = await domainsModule.updateDomainOrders([
      {
        id: order.id,
        status: "success",
        reseller_order_id: action?.orderId ?? null,
        reseller_action_id: action?.actionId ?? null,
        reseller_status: action?.status ?? null,
      },
    ] as any)

    const localStatus = actionStatusToLocal(action?.status, "pending_register")

    const existing = await findDomainRow(domainsModule, tenantId, i.domainName)
    const domainPayload = {
      tenant_id: tenantId,
      domain_name: i.domainName,
      tld,
      status: localStatus,
      source: "registered",
      reseller_order_id: action?.orderId ?? null,
      reseller_customer_id: reseller.customerId,
      reseller_contact_id: reseller.contactId,
      years: i.years,
      auto_renew: !!i.autoRenew,
      privacy_enabled: !!i.privacy,
      nameservers,
    }

    let domain: any
    if (existing) {
      const [d] = await domainsModule.updateDomainModels([
        { id: existing.id, ...domainPayload },
      ] as any)
      domain = d
    } else {
      const [d] = await domainsModule.createDomainModels([domainPayload] as any)
      domain = d
    }

    // Best-effort sync to fill registration/expiry dates + live nameservers.
    try {
      const synced = await syncDomain(container, {
        tenantId,
        domainName: i.domainName,
      })
      if (synced.ok && synced.data?.domain) {
        domain = synced.data.domain
      }
    } catch {
      // ignore best-effort sync failures
    }

    return { ok: true, data: { order: updatedOrder, domain } }
  } catch (e: any) {
    return err(e?.message ?? "Domain registration failed.")
  }
}

/** Validate a transfer-in (auth code + eligibility) without committing. */
export const validateTransferIn = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string; authCode: string }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const res = await p.provider.validateTransfer(i.domainName)
    if (!res.ok) {
      return err(res.error ?? "Transfer validation failed.")
    }
    return {
      ok: true,
      data: {
        valid: res.data?.valid ?? false,
        eligible: res.data?.eligible ?? false,
        message: res.data?.message,
      },
    }
  } catch (e: any) {
    return err(e?.message ?? "Transfer validation failed.")
  }
}

/** Transfer a domain IN (validate auth code, then transfer). */
export const transferInDomain = async (
  container: MedusaContainer,
  i: {
    tenantId: string
    domainName: string
    authCode: string
    years?: number
    nameservers?: string[]
    contactId?: string
    privacy?: boolean
    autoRenew?: boolean
    userId?: string
  }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)
    const config = getResellerConfig()
    const { tld } = splitDomain(i.domainName)

    const contactRes = await resolveContact(
      domainsModule,
      tenantId,
      i.contactId
    )
    if (!contactRes.ok) {
      return err(contactRes.error)
    }
    const reseller = await ensureResellerContact(
      domainsModule,
      provider,
      contactRes.contact
    )
    if (!reseller.ok) {
      return err(reseller.error)
    }

    const validation = await provider.validateTransfer(i.domainName)
    if (!validation.ok) {
      return err(validation.error ?? "Transfer validation failed.")
    }
    if (!validation.data?.valid || !validation.data?.eligible) {
      return err(
        validation.data?.message ?? "Domain is not eligible for transfer."
      )
    }

    const nameservers = i.nameservers ?? config.defaultNameservers

    const [order] = await domainsModule.createDomainOrders([
      {
        tenant_id: tenantId,
        domain_name: i.domainName,
        tld,
        action: "transfer",
        years: i.years ?? null,
        status: "processing",
        created_by_user_id: i.userId ?? null,
      },
    ] as any)

    const transfer = await provider.transferDomain({
      domainName: i.domainName,
      authCode: i.authCode,
      years: i.years,
      nameservers,
      customerId: reseller.customerId,
      contactId: reseller.contactId,
      protectPrivacy: i.privacy,
      autoRenew: i.autoRenew,
    })

    if (!transfer.ok) {
      const [failed] = await domainsModule.updateDomainOrders([
        {
          id: order.id,
          status: "failed",
          error: transfer.error ?? "Transfer failed.",
        },
      ] as any)
      return {
        ok: false,
        error: transfer.error ?? "Transfer failed.",
        data: { order: failed },
      }
    }

    const action = transfer.data
    const [updatedOrder] = await domainsModule.updateDomainOrders([
      {
        id: order.id,
        status: "success",
        reseller_order_id: action?.orderId ?? null,
        reseller_action_id: action?.actionId ?? null,
        reseller_status: action?.status ?? null,
      },
    ] as any)

    const domainPayload = {
      tenant_id: tenantId,
      domain_name: i.domainName,
      tld,
      status: "pending_transfer",
      source: "transferred",
      reseller_order_id: action?.orderId ?? null,
      reseller_customer_id: reseller.customerId,
      reseller_contact_id: reseller.contactId,
      years: i.years ?? null,
      auto_renew: !!i.autoRenew,
      privacy_enabled: !!i.privacy,
      nameservers,
    }

    const existing = await findDomainRow(domainsModule, tenantId, i.domainName)
    let domain: any
    if (existing) {
      const [d] = await domainsModule.updateDomainModels([
        { id: existing.id, ...domainPayload },
      ] as any)
      domain = d
    } else {
      const [d] = await domainsModule.createDomainModels([domainPayload] as any)
      domain = d
    }

    return { ok: true, data: { order: updatedOrder, domain } }
  } catch (e: any) {
    return err(e?.message ?? "Domain transfer failed.")
  }
}

/** Transfer OUT helper: unlock if needed + return the EPP/auth code. */
export const getTransferOut = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string }
): Promise<ServiceResult<{ locked: boolean; authCode: string | null }>> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)

    const resolved = await resolveOrderId(
      domainsModule,
      provider,
      tenantId,
      i.domainName
    )
    if (!resolved.ok) {
      return err(resolved.error)
    }
    const orderId = resolved.orderId

    const details = await provider.getDomainDetails(i.domainName)
    if (!details.ok) {
      return err(details.error ?? "Could not read domain details.")
    }

    if (details.data?.locked) {
      const unlock = await provider.setLock(orderId, false)
      if (!unlock.ok) {
        return err(unlock.error ?? "Could not unlock the domain for transfer.")
      }
    }

    const auth = await provider.getAuthCode(orderId)
    if (!auth.ok) {
      return err(auth.error ?? "Could not retrieve the auth code.")
    }

    if (resolved.row) {
      await domainsModule.updateDomainModels([
        { id: resolved.row.id, locked: false },
      ] as any)
    }

    return { ok: true, data: { locked: false, authCode: auth.data ?? null } }
  } catch (e: any) {
    return err(e?.message ?? "Transfer-out preparation failed.")
  }
}

/** Renew (or restore) a domain. */
export const renewDomain = async (
  container: MedusaContainer,
  i: {
    tenantId: string
    domainName: string
    years: number
    isRestore?: boolean
    userId?: string
  }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)
    const { tld } = splitDomain(i.domainName)

    const resolved = await resolveOrderId(
      domainsModule,
      provider,
      tenantId,
      i.domainName
    )
    if (!resolved.ok) {
      return err(resolved.error)
    }
    const orderId = resolved.orderId

    const [order] = await domainsModule.createDomainOrders([
      {
        tenant_id: tenantId,
        domain_name: i.domainName,
        tld,
        action: i.isRestore ? "restore" : "renew",
        years: i.years,
        status: "processing",
        created_by_user_id: i.userId ?? null,
      },
    ] as any)

    const renew = await provider.renewDomain({
      orderId,
      years: i.years,
      isRestore: i.isRestore,
    })

    if (!renew.ok) {
      const [failed] = await domainsModule.updateDomainOrders([
        {
          id: order.id,
          status: "failed",
          error: renew.error ?? "Renewal failed.",
        },
      ] as any)
      return {
        ok: false,
        error: renew.error ?? "Renewal failed.",
        data: { order: failed },
      }
    }

    const action = renew.data
    const [updatedOrder] = await domainsModule.updateDomainOrders([
      {
        id: order.id,
        status: "success",
        reseller_order_id: action?.orderId ?? orderId,
        reseller_action_id: action?.actionId ?? null,
        reseller_status: action?.status ?? null,
      },
    ] as any)

    let domain: any = resolved.row ?? null
    const synced = await syncDomain(container, {
      tenantId,
      domainName: i.domainName,
    })
    if (synced.ok && synced.data?.domain) {
      domain = synced.data.domain
    }

    return { ok: true, data: { order: updatedOrder, domain } }
  } catch (e: any) {
    return err(e?.message ?? "Domain renewal failed.")
  }
}

/** Toggle transfer-lock / privacy / auto-renew on a domain. */
export const setDomainToggle = async (
  container: MedusaContainer,
  i: {
    tenantId: string
    domainName: string
    field: "locked" | "privacy" | "auto_renew"
    enabled: boolean
  }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)

    const resolved = await resolveOrderId(
      domainsModule,
      provider,
      tenantId,
      i.domainName
    )
    if (!resolved.ok) {
      return err(resolved.error)
    }
    const orderId = resolved.orderId

    let note: string | undefined

    if (i.field === "locked") {
      const res = await provider.setLock(orderId, i.enabled)
      if (!res.ok) {
        return err(res.error ?? "Could not update the transfer lock.")
      }
    } else if (i.field === "privacy") {
      const res = await provider.setPrivacy(orderId, i.enabled)
      if (!res.ok) {
        return err(res.error ?? "Could not update privacy protection.")
      }
    } else {
      // auto_renew — best-effort; local flag still updated on provider failure.
      const res = await provider.setAutoRenew(orderId, i.enabled)
      if (!res.ok) {
        note =
          res.error ??
          "Auto-renew could not be updated at the registrar; local flag updated."
      }
    }

    const localField = i.field === "privacy" ? "privacy_enabled" : i.field

    const row =
      resolved.row ?? (await findDomainRow(domainsModule, tenantId, i.domainName))
    if (row) {
      await domainsModule.updateDomainModels([
        { id: row.id, [localField]: i.enabled },
      ] as any)
    }

    return { ok: true, data: { field: i.field, enabled: i.enabled, note } }
  } catch (e: any) {
    return err(e?.message ?? "Could not update the domain setting.")
  }
}

/** Re-sync a local domain row from the registrar. */
export const syncDomain = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)
    const { tld } = splitDomain(i.domainName)

    const details = await provider.getDomainDetails(i.domainName)
    if (!details.ok || !details.data) {
      return err(details.error ?? "Could not read domain details.")
    }
    const d = details.data

    const payload = {
      status: mapRegistrarStatus(d.status),
      registration_date: toDate(d.registrationDate),
      expiry_date: toDate(d.expiryDate),
      auto_renew: !!d.autoRenew,
      privacy_enabled: !!d.privacyEnabled,
      locked: !!d.locked,
      nameservers: d.nameservers ?? [],
      reseller_order_id: d.orderId ?? null,
      last_synced_at: new Date(),
    }

    const existing = await findDomainRow(domainsModule, tenantId, i.domainName)
    let domain: any
    if (existing) {
      const [row] = await domainsModule.updateDomainModels([
        { id: existing.id, ...payload },
      ] as any)
      domain = row
    } else {
      const [row] = await domainsModule.createDomainModels([
        {
          tenant_id: tenantId,
          domain_name: i.domainName,
          tld,
          source: "added_existing",
          ...payload,
        },
      ] as any)
      domain = row
    }

    return { ok: true, data: { domain } }
  } catch (e: any) {
    return err(e?.message ?? "Domain sync failed.")
  }
}

/** Get the current nameservers for a domain. */
export const getNameservers = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string }
): Promise<ServiceResult<{ nameservers: string[] }>> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const details = await p.provider.getDomainDetails(i.domainName)
    if (!details.ok || !details.data) {
      return err(details.error ?? "Could not read nameservers.")
    }
    return { ok: true, data: { nameservers: details.data.nameservers ?? [] } }
  } catch (e: any) {
    return err(e?.message ?? "Could not read nameservers.")
  }
}

/** Replace the nameservers for a domain. */
export const setNameservers = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string; nameservers: string[] }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const domainsModule: any = container.resolve(DOMAINS_MODULE)
    const tenantId = tenantOf(i.tenantId)

    const resolved = await resolveOrderId(
      domainsModule,
      provider,
      tenantId,
      i.domainName
    )
    if (!resolved.ok) {
      return err(resolved.error)
    }

    const res = await provider.modifyNameServers(
      resolved.orderId,
      i.nameservers
    )
    if (!res.ok) {
      return err(res.error ?? "Could not update nameservers.")
    }

    const row =
      resolved.row ?? (await findDomainRow(domainsModule, tenantId, i.domainName))
    if (row) {
      await domainsModule.updateDomainModels([
        { id: row.id, nameservers: i.nameservers },
      ] as any)
    }

    return { ok: true, data: { nameservers: i.nameservers } }
  } catch (e: any) {
    return err(e?.message ?? "Could not update nameservers.")
  }
}

/** List DNS records for a domain. */
export const getDnsRecords = async (
  container: MedusaContainer,
  i: { tenantId: string; domainName: string }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const res = await p.provider.dnsGetRecords(i.domainName)
    if (!res.ok) {
      return err(res.error ?? "Could not read DNS records.")
    }
    return { ok: true, data: { records: res.data ?? [] } }
  } catch (e: any) {
    return err(e?.message ?? "Could not read DNS records.")
  }
}

/** Add / update / delete a single DNS record. */
export const mutateDnsRecord = async (
  container: MedusaContainer,
  i: {
    tenantId: string
    domainName: string
    op: "add" | "update" | "delete"
    record: {
      type: "A" | "AAAA" | "MX" | "CNAME" | "TXT" | "NS"
      host: string
      value: string
      newValue?: string
      ttl?: number
      priority?: number
    }
  }
): Promise<ServiceResult> => {
  try {
    const p = requireProvider()
    if (!p.ok) {
      return err(p.error)
    }
    const provider = p.provider
    const input: DnsRecordInput = { domain: i.domainName, ...i.record }

    let res
    if (i.op === "add") {
      res = await provider.dnsAddRecord(input)
    } else if (i.op === "update") {
      res = await provider.dnsUpdateRecord(input)
    } else {
      res = await provider.dnsDeleteRecord(input)
    }

    if (!res.ok) {
      return err(res.error ?? "Could not update the DNS record.")
    }
    return { ok: true, data: { op: i.op, record: i.record } }
  } catch (e: any) {
    return err(e?.message ?? "Could not update the DNS record.")
  }
}
