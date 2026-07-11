/**
 * ResellerClub HTTP API adapter — implements RegistrarProvider against
 * httpapi.com. Every method performs a real HTTP call via the private `req`
 * helper and is NO-THROW: any failure (network, non-2xx, ERROR payload) is
 * caught and mapped to `{ ok:false, error }`. The api-key is only ever placed
 * in the outgoing query string and is never surfaced in errors or logs.
 */
import type {
  AvailabilityResult,
  ContactInput,
  CustomerInput,
  DnsRecord,
  DnsRecordInput,
  NameSuggestion,
  RegisterInput,
  RegistrarAction,
  RegistrarDomainDetails,
  RegistrarProvider,
  RegistrarResult,
  RenewInput,
  TldPrice,
  TransferInput,
  TransferValidation,
} from "./types"
import { getResellerConfig, isResellerConfigured } from "./config"

/** Query param value(s); arrays become repeated keys. */
type ParamValue = string | number | boolean | undefined | null
type Params = Record<string, ParamValue | ParamValue[]>

/**
 * TLD → ResellerClub product-key map, used to read reseller-price entries.
 * NOTE: TLDs not present here return no price (undefined) from getPricing().
 */
const TLD_PRODUCT_KEY: Record<string, string> = {
  com: "domcno",
  net: "dotnet",
  org: "domorg",
  info: "dominfo",
  biz: "dombiz",
  co: "dotco",
  io: "dotio",
  me: "dotme",
  shop: "dotshop",
  store: "dotstore",
  online: "dotonline",
  xyz: "dotxyz",
  dev: "dotdev",
  app: "dotapp",
  ai: "dotai",
}

/** Split a full domain into sld + tld (tld = everything after the first dot). */
const splitDomain = (domain: string): { sld: string; tld: string } => {
  const idx = domain.indexOf(".")
  if (idx === -1) {
    return { sld: domain, tld: "" }
  }
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) }
}

/** Convert a unix timestamp (seconds, as string or number) to an ISO string. */
const unixToIso = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null
  }
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    return null
  }
  return new Date(num * 1000).toISOString()
}

/** Coerce ResellerClub's stringy booleans ("true"/"false"/1/0) to a boolean. */
const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    return value !== 0
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    return v === "true" || v === "1" || v === "yes"
  }
  return false
}

/** Generate a random password satisfying ResellerClub complexity rules. */
const randomPassword = (): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnpqrstuvwxyz"
  const digits = "23456789"
  const specials = "!@#$*"
  const all = upper + lower + digits + specials
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
  let out = pick(upper) + pick(lower) + pick(digits) + pick(specials)
  while (out.length < 10) {
    out += pick(all)
  }
  return out
}

/** Keep only digits (phone country code / phone number sanitisation). */
const digitsOnly = (value: string): string => value.replace(/[^0-9]/g, "")

const DNS_TYPES = ["A", "AAAA", "MX", "CNAME", "TXT", "NS"] as const

export class ResellerClubProvider implements RegistrarProvider {
  readonly name = "resellerclub"

  isConfigured(): boolean {
    return isResellerConfigured()
  }

  /**
   * Core HTTP helper. Assembles `<baseUrl><path>?<params>&auth-userid&api-key`,
   * fetches with the given method (params always live in the query string for
   * both GET and POST), parses JSON, and maps the outcome to a RegistrarResult.
   * NEVER throws — network/parse/ERROR failures become `{ ok:false, error }`.
   * The api-key is only ever written to the URL, never to an error message.
   */
  private async req<T = unknown>(
    method: "GET" | "POST",
    path: string,
    params: Params = {}
  ): Promise<RegistrarResult<T>> {
    if (!isResellerConfigured()) {
      return { ok: false, error: "ResellerClub is not configured" }
    }

    const cfg = getResellerConfig()
    const qs = new URLSearchParams()

    const append = (key: string, value: ParamValue) => {
      if (value === undefined || value === null) {
        return
      }
      qs.append(key, String(value))
    }

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          append(key, item)
        }
      } else {
        append(key, value)
      }
    }

    qs.append("auth-userid", cfg.authUserId)
    qs.append("api-key", cfg.apiKey)

    const url = `${cfg.baseUrl}${path}?${qs.toString()}`

    try {
      const res = await fetch(url, {
        method,
        headers: { Accept: "application/json" },
      })

      const text = await res.text()
      let data: unknown = text
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        // Non-JSON body: keep as raw text.
      }

      // ResellerClub signals errors either via non-2xx or an ERROR payload.
      const errMessage = this.extractError(data, res.status, res.ok)
      if (errMessage) {
        return { ok: false, error: errMessage, raw: data }
      }

      return { ok: true, data: data as T, raw: data }
    } catch (e) {
      // Sanitise: never allow the URL (with api-key) into the message.
      const message = e instanceof Error ? e.message : "request failed"
      return { ok: false, error: this.sanitize(message) }
    }
  }

  /** Extract an error message from a ResellerClub response, if any. */
  private extractError(
    data: unknown,
    httpStatus: number,
    httpOk: boolean
  ): string | null {
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>
      const status = typeof obj.status === "string" ? obj.status : undefined
      if (status && status.toUpperCase() === "ERROR") {
        return this.sanitize(String(obj.message ?? "ResellerClub error"))
      }
      if (!httpOk && typeof obj.message === "string") {
        return this.sanitize(obj.message)
      }
    }
    if (!httpOk) {
      if (typeof data === "string" && data.trim()) {
        return this.sanitize(data.trim())
      }
      return `ResellerClub HTTP ${httpStatus}`
    }
    return null
  }

  /** Strip anything resembling the api-key/auth from a message. */
  private sanitize(message: string): string {
    return message
      .replace(/api-key=[^&\s]*/gi, "api-key=***")
      .replace(/auth-userid=[^&\s]*/gi, "auth-userid=***")
  }

  async checkAvailability(
    domains: string[],
    tlds: string[]
  ): Promise<RegistrarResult<AvailabilityResult[]>> {
    try {
      const res = await this.req<Record<string, unknown>>(
        "GET",
        "/domains/available.json",
        {
          "domain-name": domains,
          tlds: tlds,
        }
      )
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? "availability check failed", raw: res.raw }
      }

      // Pricing is best-effort; absence must not fail availability.
      let pricing: Record<string, TldPrice> = {}
      const priceRes = await this.getPricing()
      if (priceRes.ok && priceRes.data) {
        pricing = priceRes.data
      }

      const results: AvailabilityResult[] = []
      for (const [key, value] of Object.entries(res.data)) {
        if (!value || typeof value !== "object") {
          continue
        }
        const entry = value as Record<string, unknown>
        const status = String(entry.status ?? "")
        const { sld, tld } = splitDomain(key)
        const available = status === "available"
        const classkey = entry.classkey
        const isPremium =
          (typeof classkey === "string" &&
            classkey.length > 0 &&
            classkey !== "domcno") ||
          toBool(entry.premium)
        results.push({
          domain: sld,
          tld,
          available,
          status,
          isPremium,
          price: pricing[tld],
        })
      }

      return { ok: true, data: results, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async suggestNames(
    keyword: string,
    tlds?: string[]
  ): Promise<RegistrarResult<NameSuggestion[]>> {
    try {
      const params: Params = {
        keyword,
        "no-of-results": 20,
        "add-related": true,
      }
      if (tlds && tlds.length) {
        params["tld-only"] = tlds.join(",")
      }
      const res = await this.req<Record<string, unknown>>(
        "GET",
        "/domains/v5/suggest-names.json",
        params
      )
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? "suggest-names failed", raw: res.raw }
      }

      // Response shape: { keyword: { "sld.tld": "available"|..., ... }, ... }
      const suggestions: NameSuggestion[] = []
      const seen = new Set<string>()
      const collect = (node: unknown) => {
        if (!node || typeof node !== "object") {
          return
        }
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (k.includes(".") && (typeof v === "string" || v === null)) {
            if (seen.has(k)) {
              continue
            }
            seen.add(k)
            const { sld, tld } = splitDomain(k)
            suggestions.push({
              domain: sld,
              tld,
              available:
                typeof v === "string" ? v === "available" : undefined,
            })
          } else if (v && typeof v === "object") {
            collect(v)
          }
        }
      }
      collect(res.data)

      return { ok: true, data: suggestions, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async getPricing(): Promise<RegistrarResult<Record<string, TldPrice>>> {
    try {
      const res = await this.req<Record<string, unknown>>(
        "GET",
        "/products/reseller-price.json"
      )
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? "pricing fetch failed", raw: res.raw }
      }

      const pickYearOne = (bucket: unknown): number | null => {
        if (!bucket || typeof bucket !== "object") {
          return null
        }
        const raw = (bucket as Record<string, unknown>)["1"]
        if (raw === undefined || raw === null || raw === "") {
          return null
        }
        const num = Number(raw)
        return Number.isFinite(num) ? num : null
      }

      const out: Record<string, TldPrice> = {}
      for (const [tld, productKey] of Object.entries(TLD_PRODUCT_KEY)) {
        const product = res.data[productKey]
        if (!product || typeof product !== "object") {
          continue
        }
        const p = product as Record<string, unknown>
        out[tld] = {
          tld,
          register: pickYearOne(p.addnewdomain),
          renew: pickYearOne(p.renewdomain),
          transfer: pickYearOne(p.addtransferdomain),
          currency: "USD",
        }
      }

      return { ok: true, data: out, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async addCustomer(
    input: CustomerInput
  ): Promise<RegistrarResult<{ customerId: string }>> {
    try {
      const res = await this.req<unknown>("POST", "/customers/v2/signup.json", {
        username: input.email,
        passwd: randomPassword(),
        name: input.name,
        company: input.company || "N/A",
        "address-line-1": input.addressLine1,
        city: input.city,
        state: input.state,
        country: input.country,
        zipcode: input.postalCode,
        "phone-cc": digitsOnly(input.phoneCountryCode),
        phone: digitsOnly(input.phone),
        "lang-pref": "en",
      })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "addCustomer failed", raw: res.raw }
      }
      const customerId = this.scalarId(res.data)
      if (!customerId) {
        return { ok: false, error: "addCustomer: no customer id returned", raw: res.raw }
      }
      return { ok: true, data: { customerId }, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async addContact(
    customerId: string,
    input: ContactInput
  ): Promise<RegistrarResult<{ contactId: string }>> {
    try {
      const res = await this.req<unknown>("POST", "/contacts/add.json", {
        name: input.name,
        company: input.company || "N/A",
        email: input.email,
        "address-line-1": input.addressLine1,
        city: input.city,
        state: input.state,
        country: input.country,
        zipcode: input.postalCode,
        "phone-cc": digitsOnly(input.phoneCountryCode),
        phone: digitsOnly(input.phone),
        "customer-id": customerId,
        type: input.type || "Contact",
      })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "addContact failed", raw: res.raw }
      }
      const contactId = this.scalarId(res.data)
      if (!contactId) {
        return { ok: false, error: "addContact: no contact id returned", raw: res.raw }
      }
      return { ok: true, data: { contactId }, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async registerDomain(
    input: RegisterInput
  ): Promise<RegistrarResult<RegistrarAction>> {
    try {
      const ns = input.nameservers.length
        ? input.nameservers
        : getResellerConfig().defaultNameservers
      const res = await this.req<Record<string, unknown>>(
        "POST",
        "/domains/register.json",
        {
          "domain-name": input.domainName,
          years: input.years,
          ns,
          "customer-id": input.customerId,
          "reg-contact-id": input.contactId,
          "admin-contact-id": input.contactId,
          "tech-contact-id": input.contactId,
          "billing-contact-id": input.contactId,
          "invoice-option": input.invoiceOption ?? "NoInvoice",
          "protect-privacy": input.protectPrivacy ? "true" : "false",
          "auto-renew": input.autoRenew ? "true" : "false",
        }
      )
      return this.toAction(res, "registerDomain")
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async validateTransfer(
    domain: string
  ): Promise<RegistrarResult<TransferValidation>> {
    try {
      const res = await this.req<unknown>(
        "GET",
        "/domains/validate-transfer.json",
        { "domain-name": domain }
      )
      if (!res.ok) {
        return { ok: false, error: res.error ?? "validateTransfer failed", raw: res.raw }
      }

      let valid = false
      let message: string | undefined
      const data = res.data
      if (typeof data === "boolean") {
        valid = data
      } else if (typeof data === "string") {
        valid = data.trim().toLowerCase() === "true"
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>
        if ("result" in obj) {
          valid = toBool(obj.result)
        } else if ("status" in obj) {
          valid = String(obj.status).toLowerCase() === "true"
        }
        if (typeof obj.message === "string") {
          message = obj.message
        }
      }

      return {
        ok: true,
        data: { valid, eligible: valid, message },
        raw: res.raw,
      }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async transferDomain(
    input: TransferInput
  ): Promise<RegistrarResult<RegistrarAction>> {
    try {
      const ns = input.nameservers?.length
        ? input.nameservers
        : getResellerConfig().defaultNameservers
      const res = await this.req<Record<string, unknown>>(
        "POST",
        "/domains/transfer.json",
        {
          "domain-name": input.domainName,
          "auth-code": input.authCode,
          "customer-id": input.customerId,
          "reg-contact-id": input.contactId,
          "admin-contact-id": input.contactId,
          "tech-contact-id": input.contactId,
          "billing-contact-id": input.contactId,
          ns,
          "invoice-option": input.invoiceOption ?? "NoInvoice",
          "protect-privacy": input.protectPrivacy ? "true" : "false",
          "auto-renew": input.autoRenew ? "true" : "false",
        }
      )
      return this.toAction(res, "transferDomain")
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async renewDomain(
    input: RenewInput
  ): Promise<RegistrarResult<RegistrarAction>> {
    try {
      if (input.isRestore) {
        const res = await this.req<Record<string, unknown>>(
          "POST",
          "/domains/restore.json",
          {
            "order-id": input.orderId,
            "invoice-option": input.invoiceOption ?? "NoInvoice",
          }
        )
        return this.toAction(res, "renewDomain")
      }

      // exp-date (current expiry unix ts) is required for renewal; if the
      // caller did not supply it, look it up from the domain details.
      let expDate = input.expDate
      if (expDate === undefined || expDate === null) {
        const details = await this.req<Record<string, unknown>>(
          "GET",
          "/domains/details.json",
          { "order-id": input.orderId, options: "All" }
        )
        if (details.ok && details.data) {
          const endtime = Number(details.data.endtime)
          if (Number.isFinite(endtime) && endtime > 0) {
            expDate = endtime
          }
        }
      }
      if (expDate === undefined || expDate === null) {
        return {
          ok: false,
          error: "renewDomain: could not determine current expiry (exp-date)",
        }
      }

      const res = await this.req<Record<string, unknown>>(
        "POST",
        "/domains/renew.json",
        {
          "order-id": input.orderId,
          years: input.years,
          "exp-date": expDate,
          "invoice-option": input.invoiceOption ?? "NoInvoice",
          "purchase-privacy": "false",
        }
      )
      return this.toAction(res, "renewDomain")
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async getOrderId(domain: string): Promise<RegistrarResult<string>> {
    try {
      const res = await this.req<unknown>("GET", "/domains/orderid.json", {
        "domain-name": domain,
      })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "getOrderId failed", raw: res.raw }
      }
      const orderId = this.scalarId(res.data)
      if (!orderId) {
        return { ok: false, error: "getOrderId: no order id returned", raw: res.raw }
      }
      return { ok: true, data: orderId, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async getDomainDetails(
    domain: string
  ): Promise<RegistrarResult<RegistrarDomainDetails>> {
    try {
      const orderRes = await this.getOrderId(domain)
      if (!orderRes.ok || !orderRes.data) {
        return { ok: false, error: orderRes.error ?? "getDomainDetails: order id lookup failed", raw: orderRes.raw }
      }
      const orderId = orderRes.data

      const res = await this.req<Record<string, unknown>>(
        "GET",
        "/domains/details.json",
        { "order-id": orderId, options: "All" }
      )
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? "getDomainDetails failed", raw: res.raw }
      }
      const d = res.data

      const nameservers: string[] = []
      for (const key of ["ns1", "ns2", "ns3", "ns4"]) {
        const v = d[key]
        if (typeof v === "string" && v.trim()) {
          nameservers.push(v.trim())
        }
      }

      // orderstatus is an array of status flags (e.g. transferlock, customerlock)
      const orderStatus = Array.isArray(d.orderstatus)
        ? (d.orderstatus as unknown[]).map((s) => String(s).toLowerCase())
        : []
      const locked =
        orderStatus.includes("transferlock") ||
        orderStatus.includes("customerlock")

      const details: RegistrarDomainDetails = {
        domainName: String(d.domainname ?? domain),
        orderId: d.orderid ? String(d.orderid) : orderId,
        status: d.currentstatus ? String(d.currentstatus) : null,
        registrationDate: unixToIso(d.creationtime),
        expiryDate: unixToIso(d.endtime),
        autoRenew: toBool(d.recurring),
        privacyEnabled: toBool(d.isprivacyprotected),
        locked,
        nameservers,
        authCode: d.domsecret ? String(d.domsecret) : null,
      }

      return { ok: true, data: details, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async getAuthCode(orderId: string): Promise<RegistrarResult<string>> {
    try {
      const res = await this.req<Record<string, unknown>>(
        "GET",
        "/domains/details.json",
        { "order-id": orderId, options: "All" }
      )
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? "getAuthCode failed", raw: res.raw }
      }
      const code = res.data.domsecret
      if (code === undefined || code === null || code === "") {
        return { ok: false, error: "getAuthCode: no auth code returned", raw: res.raw }
      }
      return { ok: true, data: String(code), raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async setLock(orderId: string, locked: boolean): Promise<RegistrarResult> {
    try {
      const path = locked
        ? "/domains/enable-theft-protection.json"
        : "/domains/disable-theft-protection.json"
      const res = await this.req("POST", path, { "order-id": orderId })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "setLock failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async setPrivacy(
    orderId: string,
    enabled: boolean,
    reason?: string
  ): Promise<RegistrarResult> {
    try {
      const res = await this.req(
        "POST",
        "/domains/modify-privacy-protection.json",
        {
          "order-id": orderId,
          "protect-privacy": enabled ? "true" : "false",
          reason: reason ?? "Owner request",
        }
      )
      if (!res.ok) {
        return { ok: false, error: res.error ?? "setPrivacy failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  /**
   * The classic ResellerClub API has no clean auto-renew toggle endpoint
   * (auto-renew is decided at purchase time). We report this as a soft failure;
   * the calling service still updates its own local auto-renew flag.
   */
  async setAutoRenew(
    _orderId: string,
    _enabled: boolean
  ): Promise<RegistrarResult> {
    return {
      ok: false,
      error: "Auto-renew is set at purchase; manage it in the registrar panel.",
    }
  }

  async modifyNameServers(
    orderId: string,
    ns: string[]
  ): Promise<RegistrarResult> {
    try {
      const res = await this.req("POST", "/domains/modify-ns.json", {
        "order-id": orderId,
        ns,
      })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "modifyNameServers failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async dnsGetRecords(domain: string): Promise<RegistrarResult<DnsRecord[]>> {
    try {
      const records: DnsRecord[] = []
      let lastError: string | undefined
      let anyOk = false

      for (const type of DNS_TYPES) {
        const res = await this.req<unknown>(
          "GET",
          "/dns/manage/search-records.json",
          {
            "domain-name": domain,
            "no-of-records": 50,
            "page-no": 1,
            type,
          }
        )
        if (!res.ok) {
          lastError = res.error
          continue
        }
        anyOk = true
        this.collectDnsRecords(res.data, records)
      }

      if (!anyOk) {
        return { ok: false, error: lastError ?? "dnsGetRecords failed" }
      }
      return { ok: true, data: records }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async dnsAddRecord(input: DnsRecordInput): Promise<RegistrarResult> {
    try {
      const base: Params = {
        "domain-name": input.domain,
        host: input.host,
        ttl: input.ttl ?? 7200,
      }
      let path: string
      const params: Params = { ...base }

      switch (input.type) {
        case "A":
          path = "/dns/manage/add-ipv4-record.json"
          params.value = input.value
          break
        case "AAAA":
          path = "/dns/manage/add-ipv6-record.json"
          params.value = input.value
          break
        case "CNAME":
          path = "/dns/manage/add-cname-record.json"
          params.value = input.value
          break
        case "MX":
          path = "/dns/manage/add-mx-record.json"
          params.value = input.value
          params.priority = input.priority ?? 10
          break
        case "TXT":
          path = "/dns/manage/add-txt-record.json"
          params.value = input.value
          break
        case "NS":
          path = "/dns/manage/add-ns-record.json"
          params.value = input.value
          break
        default:
          return { ok: false, error: `Unsupported DNS type: ${input.type}` }
      }

      const res = await this.req("POST", path, params)
      if (!res.ok) {
        return { ok: false, error: res.error ?? "dnsAddRecord failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async dnsUpdateRecord(input: DnsRecordInput): Promise<RegistrarResult> {
    try {
      const params: Params = {
        "domain-name": input.domain,
        host: input.host,
        "current-value": input.value,
        "new-value": input.newValue ?? input.value,
        ttl: input.ttl ?? 7200,
      }
      let path: string
      switch (input.type) {
        case "A":
          path = "/dns/manage/update-ipv4-record.json"
          break
        case "AAAA":
          path = "/dns/manage/update-ipv6-record.json"
          break
        case "CNAME":
          path = "/dns/manage/update-cname-record.json"
          break
        case "MX":
          path = "/dns/manage/update-mx-record.json"
          if (input.priority !== undefined) {
            params.priority = input.priority
          }
          break
        case "TXT":
          path = "/dns/manage/update-txt-record.json"
          break
        case "NS":
          path = "/dns/manage/update-ns-record.json"
          break
        default:
          return { ok: false, error: `Unsupported DNS type: ${input.type}` }
      }

      const res = await this.req("POST", path, params)
      if (!res.ok) {
        return { ok: false, error: res.error ?? "dnsUpdateRecord failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  async dnsDeleteRecord(input: DnsRecordInput): Promise<RegistrarResult> {
    try {
      const params: Params = {
        "domain-name": input.domain,
        host: input.host,
        value: input.value,
      }
      let path: string
      switch (input.type) {
        case "A":
          path = "/dns/manage/delete-ipv4-record.json"
          break
        case "AAAA":
          path = "/dns/manage/delete-ipv6-record.json"
          break
        case "CNAME":
          path = "/dns/manage/delete-cname-record.json"
          break
        case "MX":
          path = "/dns/manage/delete-mx-record.json"
          break
        case "TXT":
          path = "/dns/manage/delete-txt-record.json"
          break
        case "NS":
          path = "/dns/manage/delete-ns-record.json"
          break
        default:
          return { ok: false, error: `Unsupported DNS type: ${input.type}` }
      }

      const res = await this.req("POST", path, params)
      if (!res.ok) {
        return { ok: false, error: res.error ?? "dnsDeleteRecord failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  /** Activate DNS management for an order (private helper, best-effort). */
  private async dnsActivate(orderId: string): Promise<RegistrarResult> {
    try {
      const res = await this.req("POST", "/dns/activate.json", {
        "order-id": orderId,
      })
      if (!res.ok) {
        return { ok: false, error: res.error ?? "dnsActivate failed", raw: res.raw }
      }
      return { ok: true, data: res.data, raw: res.raw }
    } catch (e) {
      return { ok: false, error: this.errMsg(e) }
    }
  }

  // --- shared mappers -------------------------------------------------------

  /** Map a register/transfer/renew response to a RegistrarAction result. */
  private toAction(
    res: RegistrarResult<Record<string, unknown>>,
    label: string
  ): RegistrarResult<RegistrarAction> {
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error ?? `${label} failed`, raw: res.raw }
    }
    const d = res.data
    const status = String(
      d.actionstatus ?? d.status ?? d.currentstatus ?? "unknown"
    )
    const description =
      (typeof d.actionstatusdesc === "string" && d.actionstatusdesc) ||
      (typeof d.description === "string" && d.description) ||
      undefined

    const action: RegistrarAction = {
      orderId:
        d.entityid !== undefined && d.entityid !== null
          ? String(d.entityid)
          : d.orderid !== undefined && d.orderid !== null
            ? String(d.orderid)
            : null,
      actionId:
        d.actionid !== undefined && d.actionid !== null
          ? String(d.actionid)
          : d.eaqid !== undefined && d.eaqid !== null
            ? String(d.eaqid)
            : null,
      status,
      description,
    }

    // "Success"/"InvoicePaid"/"active" are treated as ok; anything else too,
    // since the caller inspects `status` — but a hard registrar error would
    // already have surfaced as res.ok === false above.
    return { ok: true, data: action, raw: res.raw }
  }

  /** Flatten a DNS search response into DnsRecord[] (mutates `out`). */
  private collectDnsRecords(data: unknown, out: DnsRecord[]): void {
    if (!data || typeof data !== "object") {
      return
    }
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      // Skip meta keys like "recsonpage"/"recsindb".
      if (!value || typeof value !== "object") {
        continue
      }
      const entry = value as Record<string, unknown>
      if (entry.type === undefined && entry.value === undefined) {
        continue
      }
      const ttlNum = Number(entry.timetolive ?? entry.ttl)
      const priorityRaw = entry.priority
      out.push({
        type: String(entry.type ?? ""),
        host: String(entry.host ?? key),
        value: String(entry.value ?? ""),
        ttl: Number.isFinite(ttlNum) ? ttlNum : 7200,
        priority:
          priorityRaw === undefined || priorityRaw === null
            ? null
            : Number(priorityRaw),
      })
    }
  }

  /** Extract a scalar numeric/string id from a ResellerClub response. */
  private scalarId(data: unknown): string | null {
    if (typeof data === "number" && Number.isFinite(data)) {
      return String(data)
    }
    if (typeof data === "string" && data.trim()) {
      return data.trim()
    }
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>
      for (const key of ["customerid", "contactid", "orderid", "id", "entityid"]) {
        const v = obj[key]
        if (v !== undefined && v !== null && String(v).trim()) {
          return String(v)
        }
      }
    }
    return null
  }

  /** Normalise a caught error into a sanitised message. */
  private errMsg(e: unknown): string {
    const message = e instanceof Error ? e.message : "unexpected error"
    return this.sanitize(message)
  }
}
