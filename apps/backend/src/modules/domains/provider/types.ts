/**
 * Registrar provider contract — the fixed seam the ResellerClub adapter
 * implements and the domain-service depends on. One provider abstracts the
 * ResellerClub HTTP API (availability, register, transfer, renew, DNS, contacts,
 * privacy, lock). Env-gated: `isConfigured()` reports whether reseller creds are
 * present, so the whole domains subsystem stays dormant until configured.
 *
 * Every method is NO-THROW: on failure it returns a result object with
 * `ok:false` + `error` (never throws), so the service + UI degrade cleanly.
 */

export type RegistrarResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
  /** Raw provider payload, for debugging/audit. */
  raw?: unknown
}

/** Per-TLD price bundle. */
export type TldPrice = {
  tld: string
  register: number | null
  renew: number | null
  transfer: number | null
  restore?: number | null
  currency: string
}

/** One availability result. */
export type AvailabilityResult = {
  domain: string
  tld: string
  available: boolean
  status: string
  isPremium?: boolean
  price?: TldPrice
}

export type NameSuggestion = {
  domain: string
  tld: string
  available?: boolean
  price?: TldPrice
}

/** A registrar customer (account under which domains are held). */
export type CustomerInput = {
  name: string
  email: string
  company?: string
  phone: string
  phoneCountryCode: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  country: string // ISO-2
  postalCode: string
}

/** A registrant/admin/tech/billing contact. */
export type ContactInput = CustomerInput & { type?: string }

/** Register a new domain. */
export type RegisterInput = {
  domainName: string
  years: number
  nameservers: string[]
  customerId: string
  contactId: string
  invoiceOption?: "NoInvoice" | "PayInvoice" | "KeepInvoice"
  protectPrivacy?: boolean
  autoRenew?: boolean
}

/** Transfer a domain IN. */
export type TransferInput = {
  domainName: string
  authCode: string
  years?: number
  nameservers?: string[]
  customerId: string
  contactId: string
  invoiceOption?: "NoInvoice" | "PayInvoice" | "KeepInvoice"
  protectPrivacy?: boolean
  autoRenew?: boolean
}

export type RenewInput = {
  orderId: string
  years: number
  /** Current expiry as a unix timestamp (ResellerClub `exp-date`). */
  expDate?: number
  invoiceOption?: "NoInvoice" | "PayInvoice" | "KeepInvoice"
  isRestore?: boolean
}

/** The async action envelope ResellerClub returns for register/transfer/renew. */
export type RegistrarAction = {
  orderId?: string | null
  actionId?: string | null
  status: string // e.g. Success, InvoicePaid, Failed, ...
  description?: string
}

export type TransferValidation = {
  valid: boolean
  eligible: boolean
  locked?: boolean
  message?: string
}

export type RegistrarDomainDetails = {
  domainName: string
  orderId: string | null
  status: string | null
  registrationDate: string | null
  expiryDate: string | null
  autoRenew: boolean
  privacyEnabled: boolean
  locked: boolean
  nameservers: string[]
  authCode?: string | null
}

export type DnsRecordInput = {
  domain: string
  type: "A" | "AAAA" | "MX" | "CNAME" | "TXT" | "NS"
  host: string
  value: string
  /** For updates: the new value replacing `value`. */
  newValue?: string
  ttl?: number
  priority?: number
}

export type DnsRecord = {
  type: string
  host: string
  value: string
  ttl: number
  priority?: number | null
}

export interface RegistrarProvider {
  readonly name: string
  isConfigured(): boolean

  checkAvailability(
    domains: string[],
    tlds: string[]
  ): Promise<RegistrarResult<AvailabilityResult[]>>
  suggestNames(
    keyword: string,
    tlds?: string[]
  ): Promise<RegistrarResult<NameSuggestion[]>>
  getPricing(): Promise<RegistrarResult<Record<string, TldPrice>>>

  addCustomer(input: CustomerInput): Promise<RegistrarResult<{ customerId: string }>>
  addContact(
    customerId: string,
    input: ContactInput
  ): Promise<RegistrarResult<{ contactId: string }>>

  registerDomain(input: RegisterInput): Promise<RegistrarResult<RegistrarAction>>
  validateTransfer(domain: string): Promise<RegistrarResult<TransferValidation>>
  transferDomain(input: TransferInput): Promise<RegistrarResult<RegistrarAction>>
  renewDomain(input: RenewInput): Promise<RegistrarResult<RegistrarAction>>

  getOrderId(domain: string): Promise<RegistrarResult<string>>
  getDomainDetails(
    domain: string
  ): Promise<RegistrarResult<RegistrarDomainDetails>>
  getAuthCode(orderId: string): Promise<RegistrarResult<string>>

  setLock(orderId: string, locked: boolean): Promise<RegistrarResult>
  setPrivacy(
    orderId: string,
    enabled: boolean,
    reason?: string
  ): Promise<RegistrarResult>
  setAutoRenew(orderId: string, enabled: boolean): Promise<RegistrarResult>
  modifyNameServers(orderId: string, ns: string[]): Promise<RegistrarResult>

  dnsGetRecords(domain: string): Promise<RegistrarResult<DnsRecord[]>>
  dnsAddRecord(input: DnsRecordInput): Promise<RegistrarResult>
  dnsUpdateRecord(input: DnsRecordInput): Promise<RegistrarResult>
  dnsDeleteRecord(input: DnsRecordInput): Promise<RegistrarResult>
}
