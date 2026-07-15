const BACKEND_URL =
  (typeof window !== "undefined"
    ? undefined
    : process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) ||
  (typeof window !== "undefined" ? "" : process.env.MEDUSA_BACKEND_URL_INTERNAL) ||
  "http://localhost:9000"

function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null
  const m = document.cookie.match(`(?:^|; )${name}=([^;]+)`)
  return m ? decodeURIComponent(m[1]) : null
}

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return BACKEND_URL
  }
  // Merchant admin is SAME-ORIGIN. The edge router proxies /merchant + /auth to
  // the control-plane backend on EVERY host, so a relative base works at the
  // canonical merchant.mautomate.ai AND any <store>.mautomate.ai. This
  // removes the host-dependent _tenant_backend cookie + the dead localhost
  // fallback that caused "failed to fetch" at merchant.mautomate.ai (where no
  // store resolves for the host, so the cookie is never set).
  return ""
}

export function apiUrl(path: string): string {
  const base = getBaseUrl()
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

export type LoginInput = { email: string; password: string }
export type MfaVerifyInput = { token: string; code: string }

export type Merchant = {
  id: string
  email: string
  name: string
  status: string
  mfa_enabled: boolean
}

export type Store = {
  id: string
  name: string
  slug: string
  domain: string | null
  status: string
  credit_balance?: number
  active_theme?: string
  allowed_themes?: string[]
  package?: string
  plan?: { key: string; name: string; domains_limit: number }
}

export type MeResponse = { merchant: Merchant; store: Store }

export type Product = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail?: string | null
  created_at: string
  updated_at?: string
  variant_count?: number
  price?: number
  currency_code?: string
  stock?: number
}

export type Order = {
  id: string
  display_id: number
  status: string
  payment_status?: string
  fulfillment_status?: string
  created_at: string
  total: number
  currency_code: string
  email?: string
  customer_name?: string
  country_code?: string | null
  item_count?: number
}

export type Customer = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
}

export type Settings = {
  name: string
  slug: string
  domain: string | null
  status: string
}

export type Theme = {
  id: string
  name: string
  description?: string
  preview?: string | null
  active?: boolean
  /** "react" (compiled) or "liquid" (uploaded). The gallery treats them the
   *  same; only preview URL construction differs. */
  engine?: "react" | "liquid"
}

export type CreditsResponse = {
  tenant_id: string
  balance: number
  trial_ends_at: string | null
  transactions: {
    id: string
    /** "in" = credits arrived, "out" = credits spent/expired */
    kind?: "in" | "out"
    /** Human activity label ("AI images · 3 uses", "Credits purchased") */
    label?: string
    type?: string
    amount: number
    description?: string
    created_at: string
  }[]
  count?: number
  limit?: number
  offset?: number
  has_more?: boolean
}

export type OverviewStats = {
  totalSales: number
  ordersThisMonth: number
  productsLive: number
  customers: number
  creditBalance: number
  currencyCode: string
}

export class ApiError extends Error {
  status: number
  type?: string
  constructor(message: string, status: number, type?: string) {
    super(message)
    this.status = status
    this.type = type
  }
}

/**
 * Build a SAFE human error message from a failed Response. Never surfaces a raw
 * body: gateway/maintenance pages (Cloudflare 5xx) return full HTML, and dumping
 * that into the UI looks like a crash. JSON errors use message/error; 5xx or
 * HTML bodies collapse to a clean line; only short plain-text bodies pass through.
 */
async function httpErrorMessage(res: Response, fallback: string): Promise<string> {
  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null
    return (data && (data.message || data.error)) || `${fallback} (${res.status})`
  }
  const raw = await res.text().catch(() => "")
  const looksHtml = /^\s*<(?:!doctype|html)/i.test(raw)
  if (res.status >= 500 || looksHtml) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return "The service is temporarily unavailable. Please try again in a moment."
    }
    return `${fallback} (${res.status}). Please try again.`
  }
  return raw && raw.length < 300 ? raw : `${fallback} (${res.status})`
}

async function request<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { token?: string; body?: unknown }
): Promise<T> {
  const base = getBaseUrl()
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string>),
  }
  if (init?.token) {
    headers["authorization"] = `Bearer ${init.token}`
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({} as any))
    throw new ApiError(
      data.message || "Access denied.",
      403,
      data.type || "forbidden"
    )
  }
  if (!res.ok) {
    throw new ApiError(await httpErrorMessage(res, "Request failed"), res.status)
  }

  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    return (await res.json()) as T
  }
  return {} as T
}

export async function loginMerchant(input: LoginInput): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/merchant/emailpass", {
    method: "POST",
    body: input,
  })
}

export async function verifyMfa(input: MfaVerifyInput): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/merchant/mfa/verify", {
    method: "POST",
    body: input,
  })
}

export async function getMerchantMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/merchant/me", { token })
}

export type MerchantAnalytics = {
  enabled: boolean
  website_id?: string | null
  range?: string
  stats?: {
    pageviews: number
    visitors: number
    visits: number
    bounces: number
    totaltime: number
  } | null
  series?: {
    pageviews?: { x: string; y: number }[]
    sessions?: { x: string; y: number }[]
  } | null
  realtime?: number
  top?: {
    pages?: { x: string; y: number }[]
    entry?: { x: string; y: number }[]
    exit?: { x: string; y: number }[]
    referrers?: { x: string; y: number }[]
    countries?: { x: string; y: number }[]
    regions?: { x: string; y: number }[]
    cities?: { x: string; y: number }[]
    browsers?: { x: string; y: number }[]
    os?: { x: string; y: number }[]
    devices?: { x: string; y: number }[]
    languages?: { x: string; y: number }[]
    screens?: { x: string; y: number }[]
    campaigns?: { x: string; y: number }[]
    events?: { x: string; y: number }[]
  }
}

export async function getMerchantAnalytics(
  token: string,
  range = "7d"
): Promise<MerchantAnalytics> {
  return request<MerchantAnalytics>(
    `/merchant/analytics?range=${encodeURIComponent(range)}`,
    { token }
  )
}

export async function listProducts(token: string): Promise<{ products: Product[]; count: number }> {
  return request<{ products: Product[]; count: number }>("/merchant/products", { token })
}

export async function listOrders(
  token: string,
  query: { status?: string; from?: string; to?: string; q?: string } = {}
): Promise<{ orders: Order[]; count: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (query.q) params.set("q", query.q)
  const qs = params.toString()
  const path = "/merchant/orders" + (qs ? "?" + qs : "")
  return request<{ orders: Order[]; count: number }>(path, { token })
}

export async function listCustomers(token: string): Promise<{ customers: Customer[]; count: number }> {
  return request<{ customers: Customer[]; count: number }>("/merchant/customers", { token })
}

export async function getSettings(token: string): Promise<Settings> {
  return request<Settings>("/merchant/settings", { token })
}

export async function updateSettings(
  token: string,
  body: { name: string }
): Promise<Settings> {
  return request<Settings>("/merchant/settings", {
    method: "PUT",
    token,
    body,
  })
}

export async function listThemes(token: string): Promise<{ themes: Theme[]; active_theme: string }> {
  return request<{ themes: Theme[]; active_theme: string }>("/merchant/themes", { token })
}

export async function updateTheme(
  token: string,
  body: { active_theme: string }
): Promise<{ active_theme: string }> {
  return request<{ active_theme: string }>("/merchant/theme", {
    method: "PUT",
    token,
    body,
  })
}

export async function getCredits(
  token: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<CreditsResponse> {
  const q = new URLSearchParams()
  if (opts.limit) q.set("limit", String(opts.limit))
  if (opts.offset) q.set("offset", String(opts.offset))
  const qs = q.toString()
  return request<CreditsResponse>(`/merchant/credits${qs ? `?${qs}` : ""}`, { token })
}

export async function getRecentOrders(token: string, limit = 5): Promise<Order[]> {
  const { orders } = await listOrders(token)
  return (orders || []).slice(0, limit)
}

export async function fetchOverview(token: string): Promise<{
  stats: OverviewStats
  recentOrders: Order[]
  products: Product[]
}> {
  const [{ products }, { orders }, { customers }, { balance = 0 }] = await Promise.all([
    listProducts(token),
    listOrders(token),
    listCustomers(token),
    getCredits(token),
  ])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalSales = (orders || []).reduce((sum, o) => sum + (o.total ?? 0), 0)
  const ordersThisMonth = (orders || []).filter((o) => new Date(o.created_at) >= startOfMonth).length
  const productsLive = (products || []).filter((p) => p.status === "published").length
  const currencyCode = orders?.[0]?.currency_code || "USD"

  return {
    stats: {
      totalSales,
      ordersThisMonth,
      productsLive,
      customers: customers?.length ?? 0,
      creditBalance: balance ?? 0,
      currencyCode,
    },
    recentOrders: (orders || []).slice(0, 5),
    products: products || [],
  }
}

// -----------------------------
// Product catalog
// -----------------------------

export type ProductPrice = {
  amount: number
  currency_code: string
}

export type ProductOptionValue = {
  id: string
  value: string
}

export type ProductOption = {
  id: string
  title: string
  values: ProductOptionValue[]
}

export type ProductVariant = {
  id: string
  title: string
  /** The variant's own thumbnail — a URL from the product's gallery. */
  thumbnail?: string | null
  sku?: string | null
  prices?: ProductPrice[]
  metadata?: Record<string, any> | null
  options?: { option_id: string; value: string }[]
  inventory_quantity?: number
  allow_backorder?: boolean
  manage_inventory?: boolean
}

export type ProductImage = {
  id: string
  url: string
  /** The variants this image belongs to. Empty = shown for every variant. */
  variants?: { id: string }[]
}

export type ProductCollection = {
  id: string
  title: string
  handle: string
  product_count?: number
}

export type ProductTag = {
  id: string
  value: string
}

export type ProductType = {
  id: string
  value: string
}

export type ProductSalesChannel = {
  id: string
  name: string
}

export type ProductDetail = Product & {
  subtitle?: string | null
  description?: string | null
  discountable?: boolean
  material?: string | null
  variants?: ProductVariant[]
  images?: ProductImage[]
  tags?: ProductTag[]
  options?: ProductOption[]
  categories?: ProductCategory[]
  collection?: ProductCollection | null
  type?: ProductType | null
  sales_channels?: ProductSalesChannel[]
}

export type CreateProductInput = {
  title: string
  handle?: string
  subtitle?: string
  description?: string
  status?: string
  discountable?: boolean
  material?: string
  prices?: { amount: number; currency_code: string }[]
  inventory_quantity?: number
  sku?: string
  tags?: string[]
  collection_ids?: string[]
  category_ids?: string[]
  type_id?: string
  sales_channel_ids?: string[]
  options?: { title: string; values: string[] }[]
  variants?: {
    title: string
    sku?: string
    prices?: { amount: number; currency_code: string }[]
    inventory_quantity?: number
    allow_backorder?: boolean
    manage_inventory?: boolean
    options?: Record<string, string>
  }[]
}

// A variant update targets an EXISTING variant by id. Mirrors the backend PUT
// /merchant/products/[id] variant schema (UpdateProductSchema.variants): id is
// required, and only these fields are accepted. NOTE: the backend cannot ADD a
// new variant (it looks the id up and skips unknown ones) or REMOVE variants
// via this route, so those are backend gaps — see the deep editor notes.
export type UpdateProductVariantInput = {
  id: string
  sku?: string | null
  prices?: ProductPrice[]
  inventory_quantity?: number
  manage_inventory?: boolean
  allow_backorder?: boolean
}

// The backend PUT ignores `options` entirely (no options field in
// UpdateProductSchema), so editing product options is not wired here — it is a
// backend gap. Variants are typed with the update shape (id required).
export type UpdateProductInput = Omit<Partial<CreateProductInput>, "variants"> & {
  variants?: UpdateProductVariantInput[]
}

export async function getProduct(
  token: string,
  id: string
): Promise<{ product: ProductDetail }> {
  return request<{ product: ProductDetail }>(`/merchant/products/${id}`, { token })
}

// Convenience for the price-list variant picker: loads a product and returns its
// variants (each carries id + title + prices). The price-list POST requires a
// variant_id per price row, so callers use these ids. Backed by GET
// /merchant/products/[id], which populates variants with options + prices.
export async function listProductVariants(
  token: string,
  productId: string
): Promise<ProductVariant[]> {
  const { product } = await getProduct(token, productId)
  return product.variants || []
}

export async function createProduct(
  token: string,
  body: CreateProductInput
): Promise<{ product: ProductDetail }> {
  return request<{ product: ProductDetail }>("/merchant/products", {
    method: "POST",
    token,
    body,
  })
}

export async function updateProduct(
  token: string,
  id: string,
  body: UpdateProductInput
): Promise<{ product: ProductDetail }> {
  return request<{ product: ProductDetail }>(`/merchant/products/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteProduct(token: string, id: string): Promise<void> {
  await request<void>(`/merchant/products/${id}`, { method: "DELETE", token })
}

export async function uploadProductMedia(
  token: string,
  id: string,
  file: File
): Promise<{ product: { id: string; thumbnail: string; url: string } }> {
  const url = apiUrl(`/merchant/products/${id}/media`)
  const formData = new FormData()
  formData.append("image", file)

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  })

  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (!res.ok) {
    throw new ApiError(await httpErrorMessage(res, "Image upload failed"), res.status)
  }

  return (await res.json()) as { product: { id: string; thumbnail: string; url: string } }
}

// -----------------------------
// Categories & Collections
// -----------------------------

export type ProductCategory = {
  id: string
  name: string
  handle: string
  description?: string | null
  status: "active" | "inactive"
  visibility: "public" | "internal"
  parent?: ProductCategory | null
  children?: ProductCategory[]
}

export type CreateCategoryInput = {
  name: string
  handle?: string
  description?: string
  status?: "active" | "inactive"
  visibility?: "public" | "internal"
  parent_id?: string | null
}

export async function listCategories(
  token: string
): Promise<{ categories: ProductCategory[]; count: number }> {
  return request<{ categories: ProductCategory[]; count: number }>("/merchant/product-categories", { token })
}

export async function createCategory(
  token: string,
  body: CreateCategoryInput
): Promise<{ category: ProductCategory }> {
  return request<{ category: ProductCategory }>("/merchant/product-categories", {
    method: "POST",
    token,
    body,
  })
}

export type CreateCollectionInput = {
  title: string
  handle?: string
}

export async function listCollections(
  token: string
): Promise<{ collections: ProductCollection[]; count: number }> {
  return request<{ collections: ProductCollection[]; count: number }>("/merchant/collections", { token })
}

export async function createCollection(
  token: string,
  body: CreateCollectionInput
): Promise<{ collection: ProductCollection }> {
  return request<{ collection: ProductCollection }>("/merchant/collections", {
    method: "POST",
    token,
    body,
  })
}

export type UpdateCollectionInput = Partial<CreateCollectionInput>

export async function getCollection(
  token: string,
  id: string
): Promise<{ collection: ProductCollection }> {
  return request<{ collection: ProductCollection }>(`/merchant/collections/${id}`, { token })
}

export async function updateCollection(
  token: string,
  id: string,
  body: UpdateCollectionInput
): Promise<{ collection: ProductCollection }> {
  return request<{ collection: ProductCollection }>(`/merchant/collections/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteCollection(token: string, id: string): Promise<void> {
  await request<void>(`/merchant/collections/${id}`, { method: "DELETE", token })
}

export async function listCollectionProducts(
  token: string,
  id: string
): Promise<{ products: Product[]; count: number }> {
  return request<{ products: Product[]; count: number }>(`/merchant/collections/${id}/products`, { token })
}

export async function addProductsToCollection(
  token: string,
  id: string,
  productIds: string[]
): Promise<{ success: boolean; collection_id: string; product_ids: string[] }> {
  return request<{ success: boolean; collection_id: string; product_ids: string[] }>(
    `/merchant/collections/${id}/products`,
    {
      method: "POST",
      token,
      body: { product_ids: productIds },
    }
  )
}

export async function removeProductsFromCollection(
  token: string,
  id: string,
  productIds: string[]
): Promise<{ success: boolean; collection_id: string; product_ids: string[] }> {
  return request<{ success: boolean; collection_id: string; product_ids: string[] }>(
    `/merchant/collections/${id}/products`,
    {
      method: "DELETE",
      token,
      body: { product_ids: productIds },
    }
  )
}

export async function listProductTypes(
  token: string
): Promise<{ types: ProductType[]; count: number }> {
  return request<{ types: ProductType[]; count: number }>("/merchant/product-types", { token })
}

export async function listProductTags(
  token: string
): Promise<{ tags: ProductTag[]; count: number }> {
  return request<{ tags: ProductTag[]; count: number }>("/merchant/product-tags", { token })
}

export type CallAgent = {
  id: string
  name: string
  use_case: string
  status: string
  current_version_id?: string | null
}

export async function listCallAgents(
  token: string
): Promise<{ agents: CallAgent[]; count: number }> {
  return request<{ agents: CallAgent[]; count: number }>("/merchant/call-center/agents", { token })
}

export async function createCallAgent(
  token: string,
  body: { name: string; use_case?: string; status?: "draft" | "published"; definition?: Record<string, any> }
): Promise<{ agent: CallAgent }> {
  return request<{ agent: CallAgent }>("/merchant/call-center/agents", {
    method: "POST",
    token,
    body,
  })
}


// Call Agent — training definition + editor
// -----------------------------

/** One node of the conversation state machine (mirrors PlaybookState). */
export type CallAgentState = {
  id: string
  goal?: string
  sample_lines?: string[]
  allowed_tools?: string[]
  transitions?: { on: string; to: string }[]
}

/** A model-callable tool (mirrors PlaybookTool). */
export type CallAgentTool = {
  name: string
  description?: string
  parameters?: Record<string, any>
}

/** The rich training definition — matches the backend DefinitionSchema (zod). */
export type CallAgentDefinition = {
  persona?: {
    name?: string
    voice_provider?: string
    voice_id?: string
    language?: string
    tone?: string
    style?: string
  }
  voice?: {
    provider?: string
    voice_id?: string
    language?: string
  }
  objective?: string
  first_message?: string
  prompt?: string
  system_prompt?: string
  merge_fields?: string[]
  states?: CallAgentState[]
  tools?: CallAgentTool[]
  guardrails?: {
    max_turns?: number
    max_clarify?: number
    save_offer_once?: boolean
    recording_disclosure?: string
  }
  disposition_set?: string[]
  dtmf_map?: Record<string, string>
}

/** A single agent loaded for the editor (live version definition inlined). */
export type CallAgentDetail = CallAgent & {
  definition: CallAgentDefinition
  version: number | null
}

/** A version snapshot in the agent's history. */
export type CallAgentVersion = {
  id: string
  version: number
  published: boolean
  created_at: string
}

/** A knowledge-base entry attached to an agent. */
export type CallAgentKnowledge = {
  id: string
  agent_id: string
  name: string
  source_type: "faq" | "text" | "url" | "file" | "product_catalog"
  content?: string | null
  url?: string | null
  created_at?: string
}

/** GET /merchant/call-center/agents/:id */
export async function getCallAgent(
  token: string,
  id: string
): Promise<{ agent: CallAgentDetail; versions: CallAgentVersion[] }> {
  return request<{ agent: CallAgentDetail; versions: CallAgentVersion[] }>(
    `/merchant/call-center/agents/${id}`,
    { token }
  )
}

/** PUT /merchant/call-center/agents/:id — edit / train (name/use_case/status/definition). */
export async function updateCallAgent(
  token: string,
  id: string,
  body: {
    name?: string
    use_case?: string
    status?: "draft" | "published"
    definition?: CallAgentDefinition
  }
): Promise<{ agent: CallAgentDetail }> {
  return request<{ agent: CallAgentDetail }>(
    `/merchant/call-center/agents/${id}`,
    { method: "PUT", token, body }
  )
}

/** DELETE /merchant/call-center/agents/:id */
export async function deleteCallAgent(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/call-center/agents/${id}`,
    { method: "DELETE", token }
  )
}

/** POST /merchant/call-center/agents/:id/publish — snapshot an immutable version. */
export async function publishCallAgent(
  token: string,
  id: string
): Promise<{ agent: CallAgent; version: { id: string; version: number; published: boolean } }> {
  return request<{ agent: CallAgent; version: { id: string; version: number; published: boolean } }>(
    `/merchant/call-center/agents/${id}/publish`,
    { method: "POST", token }
  )
}

/** GET /merchant/call-center/agents/:id/knowledge */
export async function listAgentKnowledge(
  token: string,
  id: string
): Promise<{ knowledge: CallAgentKnowledge[]; count: number }> {
  return request<{ knowledge: CallAgentKnowledge[]; count: number }>(
    `/merchant/call-center/agents/${id}/knowledge`,
    { token }
  )
}

/** POST /merchant/call-center/agents/:id/knowledge */
export async function addAgentKnowledge(
  token: string,
  id: string,
  body: {
    name: string
    source_type?: "faq" | "text" | "url" | "file" | "product_catalog"
    content?: string | null
    url?: string | null
  }
): Promise<{ knowledge: CallAgentKnowledge }> {
  return request<{ knowledge: CallAgentKnowledge }>(
    `/merchant/call-center/agents/${id}/knowledge`,
    { method: "POST", token, body }
  )
}

/** DELETE /merchant/call-center/agents/:id/knowledge/:kbId */
export async function deleteAgentKnowledge(
  token: string,
  id: string,
  kbId: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/call-center/agents/${id}/knowledge/${kbId}`,
    { method: "DELETE", token }
  )
}

// Customers
// -----------------------------

export type CustomerAddress = {
  id: string
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

export type CustomerDetail = Customer & {
  phone?: string | null
  status?: "active" | "inactive"
  shipping_addresses?: CustomerAddress[]
  billing_addresses?: CustomerAddress[]
  // Backend GET /merchant/customers/:id always returns arrays (possibly empty)
  // for orders and groups; kept non-optional so the detail page's
  // CustomerDetail["orders"][number] column typing resolves cleanly.
  orders: Order[]
  groups: { id: string; name: string }[]
}

export type CustomerGroup = {
  id: string
  name: string
  customer_count?: number
}

export type CreateCustomerGroupInput = {
  name: string
}

export async function getCustomer(
  token: string,
  id: string
): Promise<{ customer: CustomerDetail }> {
  return request<{ customer: CustomerDetail }>(`/merchant/customers/${id}`, { token })
}

export async function listCustomerGroups(
  token: string
): Promise<{ groups: CustomerGroup[]; count: number }> {
  return request<{ groups: CustomerGroup[]; count: number }>(
    "/merchant/customer-groups",
    { token }
  )
}

export async function createCustomerGroup(
  token: string,
  body: CreateCustomerGroupInput
): Promise<{ group: CustomerGroup }> {
  return request<{ group: CustomerGroup }>("/merchant/customer-groups", {
    method: "POST",
    token,
    body,
  })
}

// -----------------------------
// Store configuration
// -----------------------------

export type RegionCountry = {
  iso_2: string
  display_name: string
  name?: string
}

export type Currency = {
  code: string
  name: string
  symbol: string
}

export type PaymentProvider = {
  id: string
  name: string
}

export type FulfillmentProvider = {
  id: string
  name: string
}

export type Region = {
  id: string
  name: string
  currency_code: string
  countries: RegionCountry[]
  payment_providers: PaymentProvider[]
  fulfillment_providers: FulfillmentProvider[]
}

export type CreateRegionInput = {
  name: string
  currency_code: string
  countries: string[]
  payment_providers: string[]
  fulfillment_providers: string[]
}

export async function listRegions(token: string): Promise<{ regions: Region[]; count: number }> {
  return request<{ regions: Region[]; count: number }>("/merchant/regions", { token })
}
// Static ISO 3166 country reference catalog used to populate region selectors.
// Not tenant state; there is no /merchant/countries backend route. iso_2 codes
// are lowercase to match Medusa's country_code convention.
export async function listRegionCountries(_token: string): Promise<RegionCountry[]> {
  return [
    { iso_2: "us", display_name: "United States", name: "United States" },
    { iso_2: "ca", display_name: "Canada", name: "Canada" },
    { iso_2: "gb", display_name: "United Kingdom", name: "United Kingdom" },
    { iso_2: "de", display_name: "Germany", name: "Germany" },
    { iso_2: "fr", display_name: "France", name: "France" },
    { iso_2: "au", display_name: "Australia", name: "Australia" },
    { iso_2: "jp", display_name: "Japan", name: "Japan" },
  ]
}

export async function listCountries(token: string): Promise<{ countries: RegionCountry[] }> {
  const countries = await listRegionCountries(token)
  return { countries }
}

// ISO 4217 display metadata (name/symbol) keyed by LOWERCASE currency code.
// Static reference catalog, NOT tenant state. Codes are lowercase to match
// Medusa conventions (region.currency_code, variant price currency_code). The
// tenant's actual currency selection lives on the backend and is read/written
// via GET/PUT /merchant/store.
const CURRENCY_REFERENCE: Record<string, { name: string; symbol: string }> = {
  usd: { name: "US Dollar", symbol: "$" },
  eur: { name: "Euro", symbol: "€" },
  gbp: { name: "British Pound", symbol: "£" },
  cad: { name: "Canadian Dollar", symbol: "C$" },
  aud: { name: "Australian Dollar", symbol: "A$" },
  jpy: { name: "Japanese Yen", symbol: "¥" },
  inr: { name: "Indian Rupee", symbol: "₹" },
  bdt: { name: "Bangladeshi Taka", symbol: "৳" },
}

function currencyMeta(code: string): { name: string; symbol: string } {
  return CURRENCY_REFERENCE[code] || { name: code.toUpperCase(), symbol: code.toUpperCase() }
}

// Currencies are a static ISO 4217 reference table, not tenant state. There is
// no /merchant/currencies backend route, so this returns the well-known reference
// catalog above (lowercase codes) rather than any fabricated "saved" selection.
export async function listCurrencies(_token: string): Promise<{ currencies: Currency[] }> {
  return {
    currencies: Object.entries(CURRENCY_REFERENCE).map(([code, meta]) => ({
      code,
      name: meta.name,
      symbol: meta.symbol,
    })),
  }
}

// Static reference catalog of selectable payment providers (not saved tenant
// state). No dedicated /merchant/payment-providers route exists yet; wire here
// if one is added.
export async function listPaymentProviders(
  _token: string
): Promise<{ providers: PaymentProvider[] }> {
  return {
    providers: [
      { id: "stripe", name: "Stripe" },
      { id: "paypal", name: "PayPal" },
      { id: "manual", name: "Manual" },
    ],
  }
}

// Static reference catalog of selectable fulfillment providers (not saved tenant
// state). No dedicated /merchant/fulfillment-providers route exists yet; wire
// here if one is added.
export async function listFulfillmentProviders(
  _token: string
): Promise<{ providers: FulfillmentProvider[] }> {
  return {
    providers: [
      { id: "manual", name: "Manual" },
      { id: "shipstation", name: "ShipStation" },
    ],
  }
}

// There is no POST /merchant/regions backend route: a tenant has exactly ONE
// region (tenant.meta.region_id) whose currency is managed through Store settings
// (PUT /merchant/store, which syncs the region's currency_code). We therefore do
// NOT fabricate a persisted region here. Wire this to a real route only if one
// is added.
export async function createRegion(
  _token: string,
  _body: CreateRegionInput
): Promise<{ region: Region }> {
  throw new ApiError(
    "Creating regions is not supported. Your store uses a single region — set its currency in Store settings.",
    400,
    "not_supported"
  )
}

export type StoreSettings = {
  id: string
  name: string
  default_currency_code: string
  default_locale: string
  supported_currencies: { code: string; name: string; symbol: string; enabled: boolean }[]
}

// CONTRACT shape returned by GET/PUT /merchant/store.
type StoreCurrencyResponse = {
  default_currency_code?: string
  supported_currencies?: string[]
  default_locale?: string
}

function mapStoreSettings(meStore: Store, currency: StoreCurrencyResponse): StoreSettings {
  const supported = (currency.supported_currencies || []).map((c) => c.toLowerCase())
  const defaultCode = (currency.default_currency_code || supported[0] || "usd").toLowerCase()
  // The default currency is always part of the supported/enabled set.
  const supportedSet = new Set([...supported, defaultCode])
  // Toggle-able universe = static reference catalog unioned with whatever the
  // backend actually reports as supported.
  const codes = Array.from(new Set([...Object.keys(CURRENCY_REFERENCE), ...supportedSet]))
  return {
    id: meStore.id,
    name: meStore.name,
    default_currency_code: defaultCode,
    default_locale: currency.default_locale || "en-US",
    supported_currencies: codes.map((code) => {
      const meta = currencyMeta(code)
      return { code, name: meta.name, symbol: meta.symbol, enabled: supportedSet.has(code) }
    }),
  }
}

// Reads the tenant's REAL currency configuration from GET /merchant/store and the
// store name/id from GET /merchant/me. The store route (CONTRACT) returns
// { default_currency_code, supported_currencies: string[] }; display metadata
// (name/symbol) is hydrated from the static currency reference catalog.
export async function getStoreSettings(token: string): Promise<{ store: StoreSettings }> {
  const [meRes, currency] = await Promise.all([
    getMerchantMe(token),
    request<StoreCurrencyResponse>("/merchant/store", { token }),
  ])
  return { store: mapStoreSettings(meRes.store, currency) }
}

// Persists the tenant's currency selection via PUT /merchant/store, sending ONLY
// the CONTRACT fields (default_currency_code + the enabled currency codes). The
// backend also syncs the tenant region's currency_code. We then re-read via
// getStoreSettings so the UI reflects the PERSISTED value, not a local echo.
// NOTE: store name / locale are NOT persisted by this route (not in the CONTRACT);
// they are sourced read-only from /merchant/me.
export async function updateStoreSettings(
  token: string,
  body: Partial<StoreSettings>
): Promise<{ store: StoreSettings }> {
  const payload: { default_currency_code?: string; supported_currencies?: string[] } = {}
  if (body.default_currency_code) {
    payload.default_currency_code = body.default_currency_code.toLowerCase()
  }
  if (body.supported_currencies) {
    payload.supported_currencies = body.supported_currencies
      .filter((c) => c.enabled)
      .map((c) => c.code.toLowerCase())
  }
  await request<StoreCurrencyResponse>("/merchant/store", {
    method: "PUT",
    token,
    body: payload,
  })
  return getStoreSettings(token)
}

// -----------------------------
// Orders
// -----------------------------

export type OrderAddress = {
  id?: string
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

export type OrderCustomer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company_name?: string | null
  has_account?: boolean
  created_at?: string
  order_count?: number
}

export type OrderItemDetail = {
  quantity: number
  fulfilled_quantity: number
  shipped_quantity: number
  delivered_quantity: number
  return_requested_quantity: number
  return_received_quantity: number
}

export type OrderItem = {
  id: string
  title: string
  subtitle?: string | null
  product_title?: string | null
  variant_title?: string | null
  sku?: string | null
  product_id?: string | null
  quantity: number
  unit_price: number
  subtotal: number
  total: number
  tax_total: number
  discount_total: number
  original_total: number
  thumbnail?: string | null
  metadata?: Record<string, any> | null
  detail: OrderItemDetail
}

export type OrderRefund = {
  id: string
  amount: number
  created_at?: string
  note?: string | null
  reason?: string | null
}

export type OrderPayment = {
  id: string
  amount: number
  currency_code?: string
  provider_id?: string | null
  created_at?: string
  captured_at?: string | null
  canceled_at?: string | null
  captured_amount: number
  refunded_amount: number
  captures: { id: string; amount: number }[]
  refunds: OrderRefund[]
}

export type FulfillmentItem = {
  title: string
  quantity: number
  line_item_id: string
}

export type OrderFulfillment = {
  id: string
  created_at: string
  packed_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  canceled_at?: string | null
  provider_id?: string | null
  location_id?: string | null
  shipping_option_name?: string | null
  items: FulfillmentItem[]
  labels: { tracking_number?: string; tracking_url?: string }[]
}

export type OrderShippingMethod = {
  id: string
  name: string
  amount: number
  total: number
  subtotal: number
  tax_total: number
}

export type OrderPromotion = { id: string; code: string }

export type OrderSalesChannel = { id: string; name: string }

export type OrderDetail = {
  id: string
  display_id: number
  status: string
  payment_status: string
  fulfillment_status: string
  email?: string
  currency_code: string
  metadata?: Record<string, any> | null
  created_at: string
  updated_at?: string
  canceled_at?: string | null
  total: number
  subtotal: number
  item_subtotal: number
  item_total: number
  item_tax_total: number
  shipping_total: number
  shipping_subtotal: number
  shipping_tax_total: number
  tax_total: number
  discount_total: number
  discount_subtotal: number
  original_total: number
  paid_total: number
  refunded_total: number
  outstanding: number
  sales_channel: OrderSalesChannel | null
  customer: OrderCustomer | null
  shipping_address: OrderAddress | null
  billing_address: OrderAddress | null
  shipping_methods: OrderShippingMethod[]
  promotions: OrderPromotion[]
  items: OrderItem[]
  payments: OrderPayment[]
  fulfillments: OrderFulfillment[]
}

export type FulfillOrderInput = {
  items?: { id: string; quantity: number }[]
  tracking_number?: string
}

export type RefundOrderInput = {
  amount?: number
  note?: string
  reason_id?: string
}

export async function getOrder(token: string, id: string): Promise<{ order: OrderDetail }> {
  return request<{ order: OrderDetail }>("/merchant/orders/" + id, { token })
}

export async function fulfillOrder(
  token: string,
  id: string,
  input: FulfillOrderInput
): Promise<{ fulfillment: any }> {
  return request<{ fulfillment: any }>("/merchant/orders/" + id + "/fulfill", {
    method: "POST",
    token,
    body: input,
  })
}

export async function cancelOrder(token: string, id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/merchant/orders/" + id + "/cancel", {
    method: "POST",
    token,
  })
}

export async function refundOrder(
  token: string,
  id: string,
  input: RefundOrderInput
): Promise<{ refund: any }> {
  return request<{ refund: any }>("/merchant/orders/" + id + "/refund", {
    method: "POST",
    token,
    body: input,
  })
}

export type OrderNote = {
  id: string
  note: string
  author_id?: string
  author_email?: string
  created_at: string
}

// POST /merchant/orders/:id/shipments — creates a shipment for an existing
// fulfillment. tracking_numbers is optional; when items are omitted the backend
// derives the shipped items from the fulfillment.
export async function createShipment(
  token: string,
  id: string,
  body: { fulfillment_id: string; tracking_numbers?: string[] }
): Promise<{ shipment: any }> {
  return request<{ shipment: any }>("/merchant/orders/" + id + "/shipments", {
    method: "POST",
    token,
    body,
  })
}

// POST /merchant/orders/:id/deliveries — marks a fulfillment as delivered.
export async function markDelivered(
  token: string,
  id: string,
  body: { fulfillment_id: string }
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/merchant/orders/" + id + "/deliveries", {
    method: "POST",
    token,
    body,
  })
}

// POST /merchant/orders/:id/returns/receive — receives and completes a return.
// items[].id is the order line item id (orli_...) and quantity the amount received.
export async function receiveReturn(
  token: string,
  id: string,
  body: { return_id: string; items: ReturnItemInput[] }
): Promise<{ return: any }> {
  return request<{ return: any }>("/merchant/orders/" + id + "/returns/receive", {
    method: "POST",
    token,
    body,
  })
}

// POST /merchant/orders/:id/capture — captures an authorized payment. amount is
// optional and, when provided, is an integer in minor units per the backend
// schema; omit it to capture the full authorized amount.
export async function captureOrderPayment(
  token: string,
  id: string,
  body: { amount?: number } = {}
): Promise<{ payment: any }> {
  return request<{ payment: any }>("/merchant/orders/" + id + "/capture", {
    method: "POST",
    token,
    body,
  })
}

// GET /merchant/orders/:id/notes — lists internal notes stored on order metadata.
export async function listOrderNotes(
  token: string,
  id: string
): Promise<{ notes: OrderNote[] }> {
  return request<{ notes: OrderNote[] }>("/merchant/orders/" + id + "/notes", { token })
}

// POST /merchant/orders/:id/notes — appends an internal note.
export type UpdateOrderInput = {
  email?: string
  shipping_address?: Record<string, string | undefined>
  billing_address?: Record<string, string | undefined>
}

export async function updateOrder(
  token: string,
  id: string,
  body: UpdateOrderInput
): Promise<{ success: boolean }> {
  return request(`/merchant/orders/${id}/update`, { method: "POST", token, body })
}

export async function editOrder(
  token: string,
  id: string,
  body: { updates?: { id: string; quantity: number }[]; adds?: { variant_id: string; quantity: number }[] }
): Promise<{ success: boolean }> {
  return request(`/merchant/orders/${id}/edit`, { method: "POST", token, body })
}

export async function markOrderPaid(
  token: string,
  id: string
): Promise<{ success: boolean }> {
  return request(`/merchant/orders/${id}/mark-paid`, { method: "POST", token })
}

export async function addOrderNote(
  token: string,
  id: string,
  body: { note: string }
): Promise<{ note: OrderNote; notes: OrderNote[] }> {
  return request<{ note: OrderNote; notes: OrderNote[] }>("/merchant/orders/" + id + "/notes", {
    method: "POST",
    token,
    body,
  })
}

// -----------------------------
// Marketing
// -----------------------------

export type MarketingSummary = {
  tenant_id: string
  posts: {
    total: number
    by_status: Record<string, number>
  }
  scheduled_next_7d: number
  brand_voice_count: number
  connected_accounts_count: number
  recent_conversations_count: number
}

// Lifecycle statuses of a marketing_post — mirrors the backend model enum
// (apps/backend/src/modules/marketing/models/post.ts).
export type MarketingPostStatus =
  | "draft"
  | "needs_approval"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed"

// Per-platform delivery of a post — mirrors marketing_post_target.
export type MarketingPostTargetStatus =
  | "pending"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"

export type MarketingPostTarget = {
  id: string
  tenant_id: string
  post_id?: string | null
  platform: string
  social_account_id: string | null
  status: MarketingPostTargetStatus | string
  override_body: string | null
  override_hashtags: string[] | null
  scheduled_at: string | null
  published_at: string | null
  external_post_id: string | null
  external_url: string | null
  error: string | null
}

// Media attached to a post — mirrors marketing_post_media.
export type MarketingPostMedia = {
  id: string
  tenant_id: string
  post_id?: string | null
  kind: "image" | "video"
  file_id: string | null
  url: string | null
  alt: string | null
  position: number
}

export type MarketingPost = {
  id: string
  tenant_id: string
  status: MarketingPostStatus | string
  title: string | null
  body: string | null
  source: string
  hashtags?: string[] | null
  link_url?: string | null
  product_ids?: string[] | null
  campaign_id?: string | null
  brand_voice_id?: string | null
  created_at: string
  updated_at: string
  // Present when the post is fetched via getMarketingPost / a write endpoint
  // (the list endpoint does NOT hydrate these relations).
  targets?: MarketingPostTarget[] | null
  media?: MarketingPostMedia[] | null
}

// Journey step-node schema — mirrors backend
// apps/backend/src/modules/marketing/journey/types.ts and the zod validation
// in apps/backend/src/api/merchant/marketing/journeys/route.ts. The step
// builder MUST emit exactly these shapes or the backend zod strips them.
export type JourneyConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "contains"

export type JourneyCondition = {
  field: string
  op: JourneyConditionOp
  value?: unknown
}

export type JourneyAction =
  | {
      type: "send_email"
      template_id?: string
      subject?: string
      html?: string
      brief?: string
      brand_voice_id?: string
    }
  | { type: "send_dm"; channel: string; text: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "add_score"; points: number }
  | {
      type: "discount"
      percentage?: number
      amount?: number
      expires_hours?: number
    }
  | { type: "webhook"; url: string }

export type JourneyStep =
  | { type: "wait"; delay_seconds: number; label?: string }
  | {
      type: "condition"
      condition: JourneyCondition
      on_fail?: "exit" | "skip"
      label?: string
    }
  | { type: "action"; action: JourneyAction; label?: string }

export type MarketingJourney = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  trigger_event: string
  status: string
  steps: JourneyStep[] | null
  segment_filter: Record<string, unknown> | null
  allow_reenroll: boolean
  brand_voice_id: string | null
  created_at: string
  updated_at: string
}

export type CreateMarketingJourneyInput = {
  name: string
  description?: string
  trigger_event: string
  status?: string
  steps?: JourneyStep[]
  segment_filter?: Record<string, unknown>
  allow_reenroll?: boolean
  brand_voice_id?: string
}

export type UpdateMarketingJourneyInput = {
  name?: string
  description?: string | null
  trigger_event?: string
  status?: "draft" | "active" | "paused" | "archived"
  steps?: JourneyStep[]
  segment_filter?: Record<string, unknown> | null
  allow_reenroll?: boolean
  brand_voice_id?: string | null
}

// A create-time platform target. Either a bare platform string OR an object
// carrying per-platform copy overrides. The backend (POST /merchant/marketing/
// posts → normalizePlatforms) creates one post_target per entry.
export type CreatePostPlatformTarget =
  | string
  | {
      platform: string
      override_body?: string
      override_hashtags?: string[]
    }

// A create-time media attachment. Register an external asset by `url` or a
// previously uploaded file by `file_id` (see uploadPostMedia).
export type CreatePostMediaInput = {
  url?: string
  file_id?: string
  kind?: "image" | "video"
  alt?: string
  position?: number
}

export type CreateMarketingPostInput = {
  title?: string
  body?: string
  hashtags?: string[]
  link_url?: string
  product_ids?: string[]
  campaign_id?: string
  brand_voice_id?: string
  platforms?: CreatePostPlatformTarget[]
  // When set AND platforms exist, the backend creates the targets "scheduled"
  // at this time and flips the post to "scheduled".
  scheduled_at?: string
  media?: CreatePostMediaInput[]
}

export type UpdateMarketingPostInput = {
  title?: string
  body?: string
  hashtags?: string[]
  link_url?: string
  status?: string
  campaign_id?: string
  brand_voice_id?: string
}

export type MarketingCampaign = {
  id: string
  tenant_id: string
  name: string
  objective: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  product_ids?: string[] | null
  channel_mix?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type CreateMarketingCampaignInput = {
  name: string
  objective?: string
  status?: string
  starts_at?: string
  ends_at?: string
  product_ids?: string[]
  channel_mix?: Record<string, unknown>
}

export type UpdateMarketingCampaignInput = {
  name?: string
  objective?: string
  status?: string
  starts_at?: string | null
  ends_at?: string | null
  product_ids?: string[]
  channel_mix?: Record<string, unknown>
}

export type MarketingEmailTemplate = {
  id: string
  tenant_id: string
  name: string
  subject: string | null
  preheader?: string | null
  html?: string | null
  kind: string
  from_name: string | null
  from_email: string | null
  created_at: string
  updated_at: string
}

export type CreateMarketingEmailTemplateInput = {
  name: string
  subject?: string
  preheader?: string
  html?: string
  kind?: string
  from_name?: string
  from_email?: string
}

export type UpdateMarketingEmailTemplateInput = {
  name?: string
  subject?: string
  preheader?: string
  html?: string
  kind?: string
  from_name?: string
  from_email?: string
}

export type MarketingChatbot = {
  id: string
  tenant_id: string
  name: string
  greeting: string | null
  agent_id?: string | null
  reply_mode: string
  channel_config?: Record<string, unknown> | null
  active: boolean
  public_key: string | null
  /** Persona / behaviour. */
  instructions: string | null
  dont_go_beyond: boolean
  language: string | null
  welcome_message: string | null
  bubble_message: string | null
  /** Appearance. */
  avatar: string | null
  color: string
  position: "left" | "right"
  show_logo: boolean
  show_datetime: boolean
  embed_width: number
  embed_height: number
  /** Feature toggles. */
  collect_email: boolean
  allow_attachments: boolean
  allow_emoji: boolean
  /** Embedding pipeline state for this bot's knowledge sources. */
  training_status: "not_trained" | "training" | "trained"
  created_at: string
  updated_at: string
}

export type MarketingChatbotData = {
  id: string
  tenant_id: string
  chatbot_id: string
  kind: string
  content: string | null
  source: string | null
  status: "pending" | "embedded" | "failed"
  error: string | null
  created_at: string
  updated_at: string
}

export type MarketingChatbotFields = {
  name?: string
  greeting?: string | null
  agent_id?: string | null
  reply_mode?: "draft" | "auto"
  channel_config?: Record<string, unknown> | null
  active?: boolean
  instructions?: string | null
  dont_go_beyond?: boolean
  language?: string | null
  welcome_message?: string | null
  bubble_message?: string | null
  avatar?: string | null
  color?: string
  position?: "left" | "right"
  show_logo?: boolean
  show_datetime?: boolean
  embed_width?: number
  embed_height?: number
  collect_email?: boolean
  allow_attachments?: boolean
  allow_emoji?: boolean
}

export type CreateMarketingChatbotInput = MarketingChatbotFields & {
  name: string
  data?: Array<{ kind?: string; content?: string; source?: string }>
}

export type UpdateMarketingChatbotInput = MarketingChatbotFields

/** What one /train run actually did, straight from the embedding pipeline. */
export type MarketingChatbotTraining = {
  chatbot_id: string
  training_status: "not_trained" | "trained"
  sources: number
  embedded: number
  failed: number
  chunks: number
  error?: string
}

export async function getMarketingSummary(token: string): Promise<MarketingSummary> {
  return request<MarketingSummary>("/merchant/marketing", { token })
}

export async function listMarketingPosts(
  token: string,
  query: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ posts: MarketingPost[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ posts: MarketingPost[]; count: number; limit: number; offset: number }>(
    "/merchant/marketing/posts" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function listMarketingJourneys(
  token: string,
  query: { status?: string; trigger_event?: string; limit?: number; offset?: number } = {}
): Promise<{ journeys: MarketingJourney[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.trigger_event) params.set("trigger_event", query.trigger_event)
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ journeys: MarketingJourney[]; count: number; limit: number; offset: number }>(
    "/merchant/marketing/journeys" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function createMarketingJourney(
  token: string,
  body: CreateMarketingJourneyInput
): Promise<{ journey: MarketingJourney }> {
  return request<{ journey: MarketingJourney }>("/merchant/marketing/journeys", {
    method: "POST",
    token,
    body,
  })
}

export async function listMarketingCampaigns(
  token: string,
  query: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ campaigns: MarketingCampaign[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ campaigns: MarketingCampaign[]; count: number; limit: number; offset: number }>(
    "/merchant/marketing/campaigns" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function listMarketingEmailTemplates(
  token: string,
  query: { kind?: string; limit?: number; offset?: number } = {}
): Promise<{ templates: MarketingEmailTemplate[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.kind) params.set("kind", query.kind)
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ templates: MarketingEmailTemplate[]; count: number; limit: number; offset: number }>(
    "/merchant/marketing/email/templates" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function listMarketingChatbots(
  token: string,
  query: { limit?: number; offset?: number } = {}
): Promise<{ chatbots: MarketingChatbot[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ chatbots: MarketingChatbot[]; count: number; limit: number; offset: number }>(
    "/merchant/marketing/chatbots" + (qs ? "?" + qs : ""),
    { token }
  )
}

// --- Marketing writes: journeys --------------------------------------------

export async function getMarketingJourney(
  token: string,
  id: string
): Promise<{ journey: MarketingJourney; enrollment_counts: Record<string, number> }> {
  return request<{ journey: MarketingJourney; enrollment_counts: Record<string, number> }>(
    `/merchant/marketing/journeys/${id}`,
    { token }
  )
}

export async function updateMarketingJourney(
  token: string,
  id: string,
  body: UpdateMarketingJourneyInput
): Promise<{ journey: MarketingJourney }> {
  return request<{ journey: MarketingJourney }>(`/merchant/marketing/journeys/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteMarketingJourney(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/journeys/${id}`,
    { method: "DELETE", token }
  )
}

// --- Marketing writes: chatbots --------------------------------------------

export async function getMarketingChatbot(
  token: string,
  id: string
): Promise<{ chatbot: MarketingChatbot; data: MarketingChatbotData[] }> {
  return request<{ chatbot: MarketingChatbot; data: MarketingChatbotData[] }>(
    `/merchant/marketing/chatbots/${id}`,
    { token }
  )
}

export async function createMarketingChatbot(
  token: string,
  body: CreateMarketingChatbotInput
): Promise<{ chatbot: MarketingChatbot; data: MarketingChatbotData[] }> {
  return request<{ chatbot: MarketingChatbot; data: MarketingChatbotData[] }>(
    "/merchant/marketing/chatbots",
    { method: "POST", token, body }
  )
}

export async function updateMarketingChatbot(
  token: string,
  id: string,
  body: UpdateMarketingChatbotInput
): Promise<{ chatbot: MarketingChatbot }> {
  return request<{ chatbot: MarketingChatbot }>(`/merchant/marketing/chatbots/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteMarketingChatbot(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/chatbots/${id}`,
    { method: "DELETE", token }
  )
}

// --- Chatbot studio: knowledge, training, test chat -------------------------

/**
 * Add ONE knowledge source. `kind: "url"` is fetched server-side and its page
 * text is stored as the row's content, so the resulting row is embeddable.
 */
export async function addMarketingChatbotData(
  token: string,
  id: string,
  body: { kind: string; content?: string; source?: string }
): Promise<{ data: MarketingChatbotData }> {
  return request<{ data: MarketingChatbotData }>(
    `/merchant/marketing/chatbots/${id}/data`,
    { method: "POST", token, body }
  )
}

/** Delete one knowledge source and the embedded chunks it produced. */
export async function deleteMarketingChatbotData(
  token: string,
  id: string,
  dataId: string
): Promise<{ id: string; deleted: boolean; chunks_deleted: number }> {
  return request<{ id: string; deleted: boolean; chunks_deleted: number }>(
    `/merchant/marketing/chatbots/${id}/data?data_id=${encodeURIComponent(dataId)}`,
    { method: "DELETE", token }
  )
}

/**
 * Train the bot: chunk + embed every knowledge source so replies can retrieve
 * them. Synchronous — when it resolves, the counts it returns are persisted.
 */
export async function trainMarketingChatbot(
  token: string,
  id: string
): Promise<{
  chatbot: MarketingChatbot
  training: MarketingChatbotTraining
  data: MarketingChatbotData[]
}> {
  return request<{
    chatbot: MarketingChatbot
    training: MarketingChatbotTraining
    data: MarketingChatbotData[]
  }>(`/merchant/marketing/chatbots/${id}/train`, { method: "POST", token })
}

/**
 * Ask the bot a question and get its real, grounded answer. Creates no
 * conversation and no messages — it is a dry run of the live reply pipeline.
 */
export async function testMarketingChatbot(
  token: string,
  id: string,
  body: {
    message: string
    history?: Array<{ role: "user" | "assistant"; text: string }>
  }
): Promise<{
  reply: string
  used_knowledge: number
  needs_ai: boolean
  training_status: string
}> {
  return request<{
    reply: string
    used_knowledge: number
    needs_ai: boolean
    training_status: string
  }>(`/merchant/marketing/chatbots/${id}/test-chat`, {
    method: "POST",
    token,
    body,
  })
}

// --- Chatbot channels: which channels an assistant answers -------------------

/** The channels an assistant can be bound to. Mirrors marketing_chatbot_channel. */
export type MarketingChannelKey =
  | "web_widget"
  | "telegram"
  | "messenger"
  | "instagram"
  | "whatsapp"

/** The non-secret identity of the connected account a binding serves. */
export type MarketingChannelAccount = {
  id: string
  platform: string
  display_name: string | null
  handle: string | null
  status: string | null
}

/**
 * One chatbot-channel binding. `active` is the merchant's on/off switch for that
 * channel; for "web_widget" it is what mounts (or removes) the chat bubble on
 * the storefront.
 */
export type MarketingChatbotChannel = {
  id: string
  chatbot_id: string
  channel: MarketingChannelKey | string
  social_account_id: string | null
  active: boolean
  config: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
  /** The connected account behind the binding (null for the web widget). */
  social_account?: MarketingChannelAccount | null
}

/**
 * A channel as this platform install can actually run it. `available` comes from
 * the backend messaging provider's own isConfigured(); when it is false, `reason`
 * is the honest explanation to show instead of a button that cannot work.
 */
export type MarketingChannelAvailability = {
  channel: MarketingChannelKey | string
  label: string
  description: string
  available: boolean
  reason: string | null
  /** True when the channel is served by a connected account (not the widget). */
  requires_account: boolean
  account_platform: string | null
  /** This tenant's connected accounts that can back the channel. */
  accounts: MarketingChannelAccount[]
}

export type MarketingChannelBinding = {
  id: string
  chatbot_id: string
  chatbot_name: string | null
  channel: MarketingChannelKey | string
  social_account_id: string | null
  active: boolean
}

export type MarketingChannelChatbot = {
  id: string
  name: string
  active: boolean
  reply_mode: string
  public_key: string | null
}

export type MarketingChannelsResponse = {
  channels: MarketingChannelAvailability[]
  chatbots: MarketingChannelChatbot[]
  bindings: MarketingChannelBinding[]
}

/** The tenant's channel map: availability, assistants, and every binding. */
export async function listMarketingChannels(
  token: string
): Promise<MarketingChannelsResponse> {
  return request<MarketingChannelsResponse>("/merchant/marketing/channels", {
    token,
  })
}

/** The channels ONE assistant is bound to. */
export async function listMarketingChatbotChannels(
  token: string,
  chatbotId: string
): Promise<{ channels: MarketingChatbotChannel[] }> {
  return request<{ channels: MarketingChatbotChannel[] }>(
    `/merchant/marketing/chatbots/${chatbotId}/channels`,
    { token }
  )
}

/**
 * Bind an assistant to a channel, or update that binding (upsert on
 * (chatbot, channel)). `active: false` mutes the assistant on the channel
 * without unbinding it.
 */
export async function bindMarketingChatbotChannel(
  token: string,
  chatbotId: string,
  body: {
    channel: MarketingChannelKey | string
    social_account_id?: string | null
    active?: boolean
    config?: Record<string, unknown> | null
  }
): Promise<{ channel: MarketingChatbotChannel }> {
  return request<{ channel: MarketingChatbotChannel }>(
    `/merchant/marketing/chatbots/${chatbotId}/channels`,
    { method: "POST", token, body }
  )
}

/** Unbind an assistant from a channel entirely. */
export async function unbindMarketingChatbotChannel(
  token: string,
  chatbotId: string,
  channel: MarketingChannelKey | string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/chatbots/${chatbotId}/channels?channel=${encodeURIComponent(
      channel
    )}`,
    { method: "DELETE", token }
  )
}

// --- Marketing writes: campaigns -------------------------------------------

export async function getMarketingCampaign(
  token: string,
  id: string
): Promise<{ campaign: MarketingCampaign }> {
  return request<{ campaign: MarketingCampaign }>(
    `/merchant/marketing/campaigns/${id}`,
    { token }
  )
}

export async function createMarketingCampaign(
  token: string,
  body: CreateMarketingCampaignInput
): Promise<{ campaign: MarketingCampaign }> {
  return request<{ campaign: MarketingCampaign }>("/merchant/marketing/campaigns", {
    method: "POST",
    token,
    body,
  })
}

export async function updateMarketingCampaign(
  token: string,
  id: string,
  body: UpdateMarketingCampaignInput
): Promise<{ campaign: MarketingCampaign }> {
  return request<{ campaign: MarketingCampaign }>(`/merchant/marketing/campaigns/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteMarketingCampaign(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/campaigns/${id}`,
    { method: "DELETE", token }
  )
}

// --- Marketing writes: posts -----------------------------------------------

export async function getMarketingPost(
  token: string,
  id: string
): Promise<{ post: MarketingPost }> {
  return request<{ post: MarketingPost }>(`/merchant/marketing/posts/${id}`, { token })
}

export async function createMarketingPost(
  token: string,
  body: CreateMarketingPostInput
): Promise<{ post: MarketingPost; targets: unknown[] }> {
  return request<{ post: MarketingPost; targets: unknown[] }>(
    "/merchant/marketing/posts",
    { method: "POST", token, body }
  )
}

export async function updateMarketingPost(
  token: string,
  id: string,
  body: UpdateMarketingPostInput
): Promise<{ post: MarketingPost }> {
  return request<{ post: MarketingPost }>(`/merchant/marketing/posts/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteMarketingPost(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/posts/${id}`,
    { method: "DELETE", token }
  )
}

// --- Marketing posts: scheduling / approval / publishing -------------------

// POST /merchant/marketing/posts/:id/schedule
// Sets scheduled_at + status "scheduled" on the post's targets (optionally
// restricted to `target_platforms`) and flips the post to "scheduled". Pass
// `scheduled_at: null` to unschedule (targets → pending, post → draft).
// NOTE: the post must already have targets — schedule the create/edit with
// platforms first, otherwise the backend 400s ("no matching targets").
export async function schedulePost(
  token: string,
  id: string,
  body: { scheduled_at: string | null; target_platforms?: string[] }
): Promise<{ post: MarketingPost; scheduled_target_ids: string[] }> {
  return request<{ post: MarketingPost; scheduled_target_ids: string[] }>(
    `/merchant/marketing/posts/${id}/schedule`,
    { method: "POST", token, body }
  )
}

// POST /merchant/marketing/posts/:id/approve
// Drives the approval lifecycle. `submit`: draft → needs_approval. `approve`:
// draft|needs_approval → scheduled (when a schedule exists) else needs_approval.
// `reject`: needs_approval → draft.
export async function approvePost(
  token: string,
  id: string,
  body: { action: "submit" | "approve" | "reject"; scheduled_at?: string }
): Promise<{ post: MarketingPost }> {
  return request<{ post: MarketingPost }>(
    `/merchant/marketing/posts/${id}/approve`,
    { method: "POST", token, body }
  )
}

// POST /merchant/marketing/posts/:id/publish-now
// Marks the post's targets due now and runs the publish sweep. Honestly gated:
// when MARKETING_ENABLED is off the response carries publishing_disabled=true
// and a note; nothing is faked. Requires existing targets.
export async function publishPostNow(
  token: string,
  id: string,
  body: { target_platforms?: string[] } = {}
): Promise<{
  published: boolean
  publishing_disabled?: boolean
  note?: string
  sweep?: unknown
  post: MarketingPost
}> {
  return request<{
    published: boolean
    publishing_disabled?: boolean
    note?: string
    sweep?: unknown
    post: MarketingPost
  }>(`/merchant/marketing/posts/${id}/publish-now`, {
    method: "POST",
    token,
    body,
  })
}

// --- Marketing posts: media upload -----------------------------------------

// POST /merchant/marketing/media (multipart field `file`)
// Uploads an asset for the caller's tenant and returns the created media row.
// Pass `post_id` to attach it to an existing post immediately (used in edit
// mode); omit it to collect the media and attach at post-create time via the
// create body's `media` array ({ url, file_id, kind, alt }).
export async function uploadPostMedia(
  token: string,
  file: File,
  opts: { post_id?: string; alt?: string; position?: number } = {}
): Promise<{ media: MarketingPostMedia }> {
  const url = apiUrl("/merchant/marketing/media")
  const formData = new FormData()
  formData.append("file", file)
  if (opts.post_id) formData.append("post_id", opts.post_id)
  if (opts.alt) formData.append("alt", opts.alt)
  if (opts.position !== undefined) formData.append("position", String(opts.position))

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  })

  if (res.status === 401) {
    throw new ApiError("Session expired. Please log in again.", 401, "unauthorized")
  }
  if (!res.ok) {
    throw new ApiError(await httpErrorMessage(res, "Media upload failed"), res.status)
  }

  return (await res.json()) as { media: MarketingPostMedia }
}

// --- Marketing posts: AI copy (OpenAI-key gated) ---------------------------
// These call the real backend AI endpoints. When no AI provider is configured
// the backend still responds 2xx with `needs_ai: true` and unchanged/empty copy
// — surface that honestly to the merchant, never fabricate output.

export type MarketingAiPostResult = { post: MarketingPost; needs_ai?: boolean }

// POST /merchant/marketing/posts/generate — creates a draft AND generates copy.
export async function generateMarketingPost(
  token: string,
  body: {
    prompt: string
    product_ids?: string[]
    platforms?: string[]
    brand_voice_id?: string
    tone?: string
    length?: string
    title?: string
    campaign_id?: string
  }
): Promise<MarketingAiPostResult> {
  return request<MarketingAiPostResult>("/merchant/marketing/posts/generate", {
    method: "POST",
    token,
    body,
  })
}

// POST /merchant/marketing/posts/:id/rework — rewrite copy per an instruction.
export async function reworkMarketingPost(
  token: string,
  id: string,
  body: { instruction: string }
): Promise<MarketingAiPostResult> {
  return request<MarketingAiPostResult>(
    `/merchant/marketing/posts/${id}/rework`,
    { method: "POST", token, body }
  )
}

// POST /merchant/marketing/posts/:id/tailor — write a platform-specific
// override onto the matching target.
export async function tailorMarketingPost(
  token: string,
  id: string,
  body: { platform: string; instruction?: string }
): Promise<MarketingAiPostResult> {
  return request<MarketingAiPostResult>(
    `/merchant/marketing/posts/${id}/tailor`,
    { method: "POST", token, body }
  )
}

// --- Marketing writes: email templates -------------------------------------

export async function getMarketingEmailTemplate(
  token: string,
  id: string
): Promise<{ template: MarketingEmailTemplate }> {
  return request<{ template: MarketingEmailTemplate }>(
    `/merchant/marketing/email/templates/${id}`,
    { token }
  )
}

export async function createMarketingEmailTemplate(
  token: string,
  body: CreateMarketingEmailTemplateInput
): Promise<{ template: MarketingEmailTemplate }> {
  return request<{ template: MarketingEmailTemplate }>(
    "/merchant/marketing/email/templates",
    { method: "POST", token, body }
  )
}

export async function updateMarketingEmailTemplate(
  token: string,
  id: string,
  body: UpdateMarketingEmailTemplateInput
): Promise<{ template: MarketingEmailTemplate }> {
  return request<{ template: MarketingEmailTemplate }>(
    `/merchant/marketing/email/templates/${id}`,
    { method: "PUT", token, body }
  )
}

export async function deleteMarketingEmailTemplate(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/email/templates/${id}`,
    { method: "DELETE", token }
  )
}

// --- Call Center -----------------------------------------------------------

export type CallCenterDashboard = {
  tenant_id: string
  calls_today: { total: number; by_status: Record<string, number> }
  total_minutes: number
  total_cost: number
  tasks_scheduled: number
  campaigns_running: number
}

export type CallCenterCall = {
  id: string
  tenant_id: string
  status: string
  direction: "inbound" | "outbound"
  from_number?: string | null
  to_number?: string | null
  order_id?: string | null
  campaign_id?: string | null
  playbook_id?: string | null
  disposition?: string | null
  sentiment?: string | null
  cost_total?: number
  started_at?: string | null
  ended_at?: string | null
  created_at: string
  summary?: string | null
  transcript?: CallTranscriptTurn[] | null
  recording_url?: string | null
  locale?: string | null
  provider_call_id?: string | null
  playbook_version?: string | null
}

export type CallTranscriptTurn = { role: string; content: string }

export type CallDisposition = {
  id: string
  outcome: string
  reason?: string | null
  notes?: string | null
  set_by?: string | null
  created_at: string
}

export type CallDetail = {
  call: CallCenterCall
  dispositions: CallDisposition[]
  agent: { id: string; name: string } | null
  order: { id: string; display_id: number } | null
  has_recording?: boolean
}

export type CallCenterCampaign = {
  id: string
  tenant_id: string
  name: string
  status: string
  playbook_id?: string | null
  concurrency?: number
  daily_cap?: number | null
  from_number?: string | null
  created_at: string
  updated_at?: string
}

export type CallCenterPlaybook = {
  id: string
  name: string
  use_case?: string | null
  status: string
  version?: string | null
}

export type CallCenterAnalytics = {
  summary: {
    total: number
    connect_rate: number
    containment_rate: number
    avg_handle_time: number
    total_cost: number
  }
  outcomes: Record<string, number>
  by_status: Record<string, number>
  by_day: { date: string; count: number; cost: number }[]
  sentiment: Record<string, number>
  kpis_note: string
}

export async function getCallCenterDashboard(
  token: string
): Promise<CallCenterDashboard> {
  return request<CallCenterDashboard>("/merchant/call-center", { token })
}

export async function listCallCenterCalls(
  token: string,
  query: {
    status?: string
    direction?: string
    order_id?: string
    campaign_id?: string
    limit?: number
    offset?: number
  } = {}
): Promise<{ calls: CallCenterCall[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.direction) params.set("direction", query.direction)
  if (query.order_id) params.set("order_id", query.order_id)
  if (query.campaign_id) params.set("campaign_id", query.campaign_id)
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ calls: CallCenterCall[]; count: number; limit: number; offset: number }>(
    "/merchant/call-center/calls" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function getCallCenterCall(
  token: string,
  id: string
): Promise<CallDetail> {
  return request<CallDetail>("/merchant/call-center/calls/" + id, { token })
}

// Fetches the call's WAV recording as an authenticated blob and returns an
// object URL suitable for an <audio> src. The caller should revoke it on unmount.
export async function fetchCallRecordingObjectUrl(
  token: string,
  id: string
): Promise<string> {
  const base = getBaseUrl().replace(/\/$/, "")
  const res = await fetch(`${base}/merchant/call-center/calls/${id}/recording`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new ApiError("Failed to load recording", res.status)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function listCallCenterCampaigns(
  token: string,
  query: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ campaigns: CallCenterCampaign[]; count: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  const qs = params.toString()
  return request<{ campaigns: CallCenterCampaign[]; count: number; limit: number; offset: number }>(
    "/merchant/call-center/campaigns" + (qs ? "?" + qs : ""),
    { token }
  )
}

export async function listCallCenterPlaybooks(
  token: string
): Promise<{ playbooks: CallCenterPlaybook[]; count: number }> {
  return request<{ playbooks: CallCenterPlaybook[]; count: number }>("/merchant/call-center/playbooks", {
    token,
  })
}

export async function getCallCenterAnalytics(
  token: string,
  query: { from?: string; to?: string; campaign_id?: string; direction?: string } = {}
): Promise<CallCenterAnalytics> {
  const params = new URLSearchParams()
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (query.campaign_id) params.set("campaign_id", query.campaign_id)
  if (query.direction) params.set("direction", query.direction)
  const qs = params.toString()
  return request<CallCenterAnalytics>("/merchant/call-center/analytics" + (qs ? "?" + qs : ""), {
    token,
  })
}

// -----------------------------
// Payment gateways
// -----------------------------

export type GatewayCredential = {
  key: string
  label: string
  secret: boolean
  optional?: boolean
  help?: string
  value?: string
  is_set?: boolean
}

export type GatewaySetupGuide = {
  intro?: string
  steps: string[]
  dashboard_url?: string
  keys_url?: string
  sandbox_note?: string
  docs_url?: string
}

export type PaymentGateway = {
  id: string
  provider_id: string
  name: string
  blurb: string
  countries: string[]
  mode: "direct" | "redirect" | "offline"
  logo?: string
  docs_url?: string
  setup_guide?: GatewaySetupGuide
  configured: boolean
  enabled: boolean
  enabled_regions: string[]
  credentials: GatewayCredential[]
}

export type GatewaysResponse = {
  tenant_country: string | null
  gateways: PaymentGateway[]
}

export type GatewayUpdateInput = {
  gateway_id: string
  enabled: boolean
  enabled_regions?: string[]
  credentials: Record<string, string | null>
}

export async function listPaymentGateways(token: string): Promise<GatewaysResponse> {
  return request<GatewaysResponse>("/merchant/payments/gateways", { token })
}

export async function updatePaymentGateway(
  token: string,
  input: GatewayUpdateInput
): Promise<PaymentGateway> {
  return request<PaymentGateway>("/merchant/payments/gateways", {
    method: "POST",
    token,
    body: input,
  })
}

// -----------------------------
// MFA
// -----------------------------

export type MfaStatus = {
  mfa_enabled: boolean
  setup_pending: boolean
}

export async function getMfaStatus(token: string): Promise<MfaStatus> {
  return request<MfaStatus>("/merchant/mfa/status", { token })
}

export type MfaSetup = {
  secret: string
  qr_uri: string
  backup_codes: string[]
}

export async function setupMfa(token: string): Promise<MfaSetup> {
  return request<MfaSetup>("/merchant/mfa/setup", { method: "POST", token })
}

export async function enableMfa(
  token: string,
  code: string
): Promise<{ message: string }> {
  return request<{ message: string }>("/merchant/mfa/enable", {
    method: "POST",
    token,
    body: { code },
  })
}

export async function disableMfa(
  token: string,
  code: string
): Promise<{ message: string }> {
  return request<{ message: string }>("/merchant/mfa/disable", {
    method: "POST",
    token,
    body: { code },
  })
}

// -----------------------------
// Credits top-up
// -----------------------------

export type TopUpCreditsInput = {
  credits: number
  amount_usd?: number
}

export type TopUpCreditsResponse = {
  checkout_url?: string
  checkout_id?: string
  provider?: string
  credits: number
  amount_usd: number
}

export async function topUpCredits(
  token: string,
  input: TopUpCreditsInput
): Promise<TopUpCreditsResponse> {
  return request<TopUpCreditsResponse>("/merchant/credits", {
    method: "POST",
    token,
    body: input,
  })
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

// -----------------------------
// Domains
// -----------------------------

/**
 * A DNS record the merchant must add at their DNS provider to connect a custom
 * domain. `kind` mirrors the backend routing service:
 *   - "cname" — routing record (subdomain / www → our origin)
 *   - "txt"   — ownership + SSL validation records
 *   - "note"  — apex guidance (no literal record to add; ALIAS/flattening hint)
 * Route: GET/POST /merchant/domains
 */
export type DnsInstruction = {
  kind: "cname" | "txt" | "note"
  name: string
  value: string
  ttl?: number
}

export type Domain = {
  id: string
  domain: string
  type: "free" | "custom"
  is_primary: boolean
  ssl_status: string
  verification_status: string
  instructions: DnsInstruction[]
}

/** GET /merchant/domains — free subdomain + connected/registered domains. */
export async function listDomains(token: string): Promise<{ domains: Domain[] }> {
  return request<{ domains: Domain[] }>("/merchant/domains", { token })
}

export type ConnectDomainResponse = {
  domain_id: string
  domain: string
  instructions: DnsInstruction[]
  message: string
}

/** POST /merchant/domains — connect a domain the merchant already owns. */
export async function connectDomain(
  token: string,
  domain: string
): Promise<ConnectDomainResponse> {
  return request<ConnectDomainResponse>("/merchant/domains", {
    method: "POST",
    token,
    body: { domain },
  })
}

/** DELETE /merchant/domains — disconnect a custom domain. */
export async function disconnectDomain(
  token: string,
  domainId: string
): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>("/merchant/domains", {
    method: "DELETE",
    token,
    body: { domain_id: domainId },
  })
}

/** POST /merchant/domains/verify — re-check DNS/SSL for a connected domain. */
export async function verifyDomain(
  token: string,
  domainId: string
): Promise<{ domain_id: string; ssl_status: string; verification_status: string; pending: boolean }> {
  return request<{ domain_id: string; ssl_status: string; verification_status: string; pending: boolean }>("/merchant/domains/verify", {
    method: "POST",
    token,
    body: { domain_id: domainId },
  })
}

// -----------------------------
// Registrant profile (contacts)
// -----------------------------

export type DomainContact = {
  id: string
  name: string
  email: string
  phone?: string | null
  phone_country_code?: string | null
  company?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  is_default?: boolean
  created_at?: string
}

export type DomainContactInput = {
  name: string
  email: string
  phone?: string
  phone_country_code?: string
  company?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  is_default?: boolean
}

/** GET /merchant/domains/contacts — the merchant's registrant profiles. */
export async function listDomainContacts(
  token: string
): Promise<{ contacts: DomainContact[]; count: number }> {
  return request<{ contacts: DomainContact[]; count: number }>("/merchant/domains/contacts", {
    token,
  })
}

/** POST /merchant/domains/contacts — create a registrant profile. */
export async function createDomainContact(
  token: string,
  input: DomainContactInput
): Promise<{ contact: DomainContact }> {
  return request<{ contact: DomainContact }>("/merchant/domains/contacts", {
    method: "POST",
    token,
    body: input,
  })
}

// -----------------------------
// Domain purchase (search + buy)
// -----------------------------

export type DomainSearchResultPrice = {
  register: number
  renew: number
  transfer: number
  currency: string
}

export type DomainSearchResult = {
  domain: string
  tld: string
  available: boolean
  status: string
  isPremium?: boolean
  price?: DomainSearchResultPrice
}

export type DomainSearchResponse = {
  query: string
  configured: boolean
  results: DomainSearchResult[]
  note?: string
}

export type DomainBuyResponse = {
  ok: boolean
  domain: unknown
  order?: unknown
  manual_approval: boolean
  instructions: DnsInstruction[]
  note?: string
}

/** POST /merchant/domains/search — availability + pricing across TLDs. */
export async function searchDomainsForPurchase(
  token: string,
  query: string,
  tlds?: string[]
): Promise<DomainSearchResponse> {
  return request<DomainSearchResponse>("/merchant/domains/search", {
    method: "POST",
    token,
    body: { query, tlds },
  })
}

/** POST /merchant/domains/buy — register a new domain (or request approval). */
export async function buyDomainForStore(
  token: string,
  body: {
    domain_name: string
    years?: number
    privacy?: boolean
    auto_renew?: boolean
  }
): Promise<DomainBuyResponse> {
  return request<DomainBuyResponse>("/merchant/domains/buy", {
    method: "POST",
    token,
    body: {
      years: 1,
      privacy: true,
      auto_renew: true,
      ...body,
    },
  })
}

// -----------------------------
// Transfer in
// -----------------------------

export type TransferValidateResponse = {
  domain: string
  configured: boolean
  valid: boolean
  eligible: boolean
  message: string | null
}

/** POST /merchant/domains/transfer-in/validate — pre-flight eligibility check. */
export async function validateTransferIn(
  token: string,
  domain: string,
  authCode?: string
): Promise<TransferValidateResponse> {
  return request<TransferValidateResponse>("/merchant/domains/transfer-in/validate", {
    method: "POST",
    token,
    body: { domain, auth_code: authCode },
  })
}

export type TransferInResponse = {
  ok: boolean
  manual_approval: boolean
  order?: unknown
  domain?: unknown
  note?: string
}

/** POST /merchant/domains/transfer-in — submit the transfer with the EPP code. */
export async function transferInDomain(
  token: string,
  body: { domain: string; auth_code: string; years?: number }
): Promise<TransferInResponse> {
  return request<TransferInResponse>("/merchant/domains/transfer-in", {
    method: "POST",
    token,
    body,
  })
}

// -----------------------------
// Per-domain management (registrar)
// -----------------------------

const domainPath = (domain: string, suffix = ""): string =>
  `/merchant/domains/${encodeURIComponent(domain)}${suffix}`

/** POST /merchant/domains/:domain/renew */
export async function renewDomain(
  token: string,
  domain: string,
  years = 1
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/renew"), {
    method: "POST",
    token,
    body: { years },
  })
}

export type DnsRecord = {
  id?: string
  type: string
  host: string
  value: string
  ttl?: number
  priority?: number
}

/** GET /merchant/domains/:domain/dns */
export async function getDomainDnsRecords(
  token: string,
  domain: string
): Promise<{ records: DnsRecord[] }> {
  return request<{ records: DnsRecord[] }>(domainPath(domain, "/dns"), { token })
}

/** POST /merchant/domains/:domain/dns — add a record. */
export async function addDomainDnsRecord(
  token: string,
  domain: string,
  record: DnsRecord
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/dns"), {
    method: "POST",
    token,
    body: { record },
  })
}

/** PUT /merchant/domains/:domain/dns — update a record. */
export async function updateDomainDnsRecord(
  token: string,
  domain: string,
  record: DnsRecord
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/dns"), {
    method: "PUT",
    token,
    body: { record },
  })
}

/** DELETE /merchant/domains/:domain/dns — delete a record. */
export async function deleteDomainDnsRecord(
  token: string,
  domain: string,
  record: DnsRecord
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/dns"), {
    method: "DELETE",
    token,
    body: { record },
  })
}

/** GET /merchant/domains/:domain/nameservers */
export async function getDomainNameservers(
  token: string,
  domain: string
): Promise<{ nameservers: string[] }> {
  return request<{ nameservers: string[] }>(domainPath(domain, "/nameservers"), {
    token,
  })
}

/** PUT /merchant/domains/:domain/nameservers */
export async function setDomainNameservers(
  token: string,
  domain: string,
  nameservers: string[]
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/nameservers"), {
    method: "PUT",
    token,
    body: { nameservers },
  })
}

/** POST /merchant/domains/:domain/privacy */
export async function setDomainPrivacy(
  token: string,
  domain: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/privacy"), {
    method: "POST",
    token,
    body: { enabled },
  })
}

/** POST /merchant/domains/:domain/lock */
export async function setDomainLock(
  token: string,
  domain: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(domainPath(domain, "/lock"), {
    method: "POST",
    token,
    body: { enabled },
  })
}

export type TransferOutResponse = {
  domain: string
  locked: boolean
  auth_code: string | null
}

/** POST /merchant/domains/:domain/transfer-out — unlock + return the EPP code. */
export async function prepareDomainTransferOut(
  token: string,
  domain: string
): Promise<TransferOutResponse> {
  return request<TransferOutResponse>(domainPath(domain, "/transfer-out"), {
    method: "POST",
    token,
  })
}

// -----------------------------
// Discounts
// -----------------------------

export type Discount = {
  id: string
  code: string
  type: "percentage" | "fixed" | "free_shipping"
  status: "draft" | "active" | "inactive"
  value: number
  currency_code?: string | null
  target_type?: string
  usage_limit?: number | null
  usage_count?: number
  starts_at?: string | null
  expires_at?: string | null
  is_automatic?: boolean
  created_at: string
  updated_at?: string
}

export type CreateDiscountInput = {
  code: string
  type: "percentage" | "fixed" | "free_shipping"
  value: number
  status?: "draft" | "active" | "inactive"
  usage_limit?: number | null
  starts_at?: string | null
  expires_at?: string | null
}

export type UpdateDiscountInput = Partial<Omit<CreateDiscountInput, "code">> & {
  code?: string
}

export async function listDiscounts(
  token: string
): Promise<{ discounts: Discount[]; count: number }> {
  return request<{ discounts: Discount[]; count: number }>("/merchant/discounts", { token })
}

export async function getDiscount(
  token: string,
  id: string
): Promise<{ discount: Discount }> {
  return request<{ discount: Discount }>(`/merchant/discounts/${id}`, { token })
}

export async function createDiscount(
  token: string,
  body: CreateDiscountInput
): Promise<{ discount: Discount }> {
  return request<{ discount: Discount }>("/merchant/discounts", {
    method: "POST",
    token,
    body,
  })
}

export async function updateDiscount(
  token: string,
  id: string,
  body: UpdateDiscountInput
): Promise<{ discount: Discount }> {
  return request<{ discount: Discount }>(`/merchant/discounts/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteDiscount(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/discounts/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Gift cards
// -----------------------------

export type GiftCard = {
  id: string
  title: string
  handle: string
  description?: string | null
  status: string
  thumbnail?: string | null
  price?: number | null
  currency_code?: string | null
  sku?: string | null
  created_at: string
  updated_at?: string
}

export type CreateGiftCardInput = {
  title: string
  handle?: string
  description?: string
  status?: string
  prices: { amount: number; currency_code: string }[]
  sku?: string
  thumbnail?: string
}

export type UpdateGiftCardInput = Partial<CreateGiftCardInput> & {
  thumbnail?: string | null
}

export async function listGiftCards(
  token: string
): Promise<{ gift_cards: GiftCard[]; count: number }> {
  return request<{ gift_cards: GiftCard[]; count: number }>("/merchant/gift-cards", { token })
}

export async function getGiftCard(
  token: string,
  id: string
): Promise<{ gift_card: GiftCard }> {
  return request<{ gift_card: GiftCard }>(`/merchant/gift-cards/${id}`, { token })
}

export async function createGiftCard(
  token: string,
  body: CreateGiftCardInput
): Promise<{ gift_card: GiftCard }> {
  return request<{ gift_card: GiftCard }>("/merchant/gift-cards", {
    method: "POST",
    token,
    body,
  })
}

export async function updateGiftCard(
  token: string,
  id: string,
  body: UpdateGiftCardInput
): Promise<{ gift_card: GiftCard }> {
  return request<{ gift_card: GiftCard }>(`/merchant/gift-cards/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteGiftCard(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/gift-cards/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Tax regions
// -----------------------------

export type TaxRegion = {
  id: string
  country_code: string
  province_code?: string | null
  default_rate?: {
    id: string
    name: string
    rate: number
    code?: string | null
  } | null
  created_at: string
  updated_at?: string
}

export type CreateTaxRegionInput = {
  country_code: string
  province_code?: string | null
  default_tax_rate?: {
    name: string
    rate: number
    code?: string
  } | null
}

export async function listTaxRegions(
  token: string
): Promise<{ tax_regions: TaxRegion[]; count: number }> {
  return request<{ tax_regions: TaxRegion[]; count: number }>("/merchant/tax-regions", { token })
}

export async function createTaxRegion(
  token: string,
  body: CreateTaxRegionInput
): Promise<{ tax_region: TaxRegion }> {
  return request<{ tax_region: TaxRegion }>("/merchant/tax-regions", {
    method: "POST",
    token,
    body,
  })
}

export async function deleteTaxRegion(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/tax-regions/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Stock locations
// -----------------------------

export type StockLocationAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  country_code?: string | null
  postal_code?: string | null
  province?: string | null
  phone?: string | null
}

export type StockLocation = {
  id: string
  name: string
  address?: StockLocationAddress | null
  created_at: string
  updated_at?: string
  sales_channels?: LocationSalesChannel[]
  fulfillment_set_types?: string[]
}

export type LocationSalesChannel = { id: string; name: string }

export type LocationFulfillmentProvider = { id: string; is_enabled: boolean }

export type LocationGeoZone = {
  id: string
  type: string
  country_code?: string | null
  province_code?: string | null
}

export type LocationShippingOptionPrice = {
  amount: number
  currency_code?: string | null
}

export type LocationShippingOption = {
  id: string
  name: string
  price_type: string
  provider_id?: string | null
  is_return: boolean
  enabled_in_store: boolean
  shipping_profile?: { id: string; name: string } | null
  type?: { id: string; label?: string | null; code?: string | null } | null
  prices: LocationShippingOptionPrice[]
}

export type LocationServiceZone = {
  id: string
  name: string
  geo_zones: LocationGeoZone[]
  shipping_options: LocationShippingOption[]
}

export type LocationFulfillmentSet = {
  id: string
  name: string
  type: string
  service_zones: LocationServiceZone[]
}

export type StockLocationDetail = StockLocation & {
  metadata?: Record<string, any> | null
  sales_channels: LocationSalesChannel[]
  fulfillment_providers: LocationFulfillmentProvider[]
  fulfillment_sets: LocationFulfillmentSet[]
}

export type StockLocationAddressInput = {
  address_1: string
  address_2?: string
  city?: string
  country_code: string
  postal_code?: string
  province?: string
  phone?: string
}

export type CreateStockLocationInput = {
  name: string
  address?: StockLocationAddressInput | null
}

export type UpdateStockLocationInput = {
  name?: string
  address?: StockLocationAddressInput | null
}

export async function listStockLocations(
  token: string
): Promise<{ stock_locations: StockLocation[]; count: number }> {
  return request<{ stock_locations: StockLocation[]; count: number }>(
    "/merchant/stock-locations",
    { token }
  )
}

export type OnboardingStatus = {
  products: boolean
  shipping: boolean
  payment: boolean
  domain: boolean
  /** Countries a shopper can actually be delivered to today (may be empty). */
  shipping_countries?: string[]
  /** The country the storefront sells in. If it is not covered, checkout dies. */
  store_country?: string
  /** A custom domain that was added but never verified — not yet connected. */
  pending_domain?: string | null
}

export async function getOnboarding(token: string): Promise<OnboardingStatus> {
  return request<OnboardingStatus>("/merchant/onboarding", { token })
}

export async function getStockLocation(
  token: string,
  id: string
): Promise<{ stock_location: StockLocationDetail }> {
  return request<{ stock_location: StockLocationDetail }>(
    `/merchant/stock-locations/${id}`,
    { token }
  )
}

// -----------------------------
// Locations: shipping hierarchy (fulfillment sets, zones, options, assoc)
// -----------------------------

export async function enableFulfillmentSet(
  token: string,
  locationId: string,
  type: "shipping" | "pickup"
): Promise<{ success: boolean }> {
  return request(`/merchant/stock-locations/${locationId}/fulfillment-sets`, {
    method: "POST",
    token,
    body: { type },
  })
}

export async function deleteFulfillmentSet(
  token: string,
  setId: string
): Promise<{ deleted: boolean }> {
  return request(`/merchant/fulfillment-sets/${setId}`, { method: "DELETE", token })
}

export async function createServiceZone(
  token: string,
  setId: string,
  body: { name: string; country_codes: string[] }
): Promise<{ success: boolean }> {
  return request(`/merchant/fulfillment-sets/${setId}/service-zones`, {
    method: "POST",
    token,
    body,
  })
}

export async function updateServiceZone(
  token: string,
  zoneId: string,
  body: { name?: string; country_codes?: string[] }
): Promise<{ success: boolean }> {
  return request(`/merchant/service-zones/${zoneId}`, { method: "POST", token, body })
}

export async function deleteServiceZone(
  token: string,
  zoneId: string
): Promise<{ deleted: boolean }> {
  return request(`/merchant/service-zones/${zoneId}`, { method: "DELETE", token })
}

export type CreateShippingOptionInput = {
  service_zone_id: string
  name: string
  price_type: "flat" | "calculated"
  is_return: boolean
  enabled_in_store: boolean
  amount?: number
}

export async function createShippingOption(
  token: string,
  body: CreateShippingOptionInput
): Promise<{ shipping_option: { id: string } }> {
  return request(`/merchant/shipping-options`, { method: "POST", token, body })
}

export async function updateShippingOption(
  token: string,
  id: string,
  body: { name?: string; price_type?: "flat" | "calculated"; enabled_in_store?: boolean; amount?: number }
): Promise<{ success: boolean }> {
  return request(`/merchant/shipping-options/${id}`, { method: "POST", token, body })
}

export async function deleteShippingOption(
  token: string,
  id: string
): Promise<{ deleted: boolean }> {
  return request(`/merchant/shipping-options/${id}`, { method: "DELETE", token })
}

export async function updateLocationSalesChannels(
  token: string,
  locationId: string,
  body: { add?: string[]; remove?: string[] }
): Promise<{ success: boolean }> {
  return request(`/merchant/stock-locations/${locationId}/sales-channels`, {
    method: "POST",
    token,
    body,
  })
}

export async function updateLocationFulfillmentProviders(
  token: string,
  locationId: string,
  body: { add?: string[]; remove?: string[] }
): Promise<{ success: boolean }> {
  return request(`/merchant/stock-locations/${locationId}/fulfillment-providers`, {
    method: "POST",
    token,
    body,
  })
}

export type MerchantFulfillmentProvider = { id: string; is_enabled: boolean }

export async function listMerchantFulfillmentProviders(
  token: string,
  locationId?: string
): Promise<{ fulfillment_providers: MerchantFulfillmentProvider[] }> {
  const qs = locationId ? `?location_id=${encodeURIComponent(locationId)}` : ""
  return request(`/merchant/fulfillment-providers${qs}`, { token })
}

export type MerchantSalesChannel = { id: string; name: string; is_disabled?: boolean }

export type ShippingProfile = {
  id: string
  name: string
  type: string
  is_default?: boolean
  is_own?: boolean
}

export async function listShippingProfiles(
  token: string
): Promise<{ shipping_profiles: ShippingProfile[]; count: number }> {
  return request(`/merchant/shipping-profiles`, { token })
}

export async function createShippingProfile(
  token: string,
  body: { name: string; type: string }
): Promise<{ shipping_profile: { id: string } }> {
  return request(`/merchant/shipping-profiles`, { method: "POST", token, body })
}

export async function deleteShippingProfile(
  token: string,
  id: string
): Promise<{ deleted: boolean }> {
  return request(`/merchant/shipping-profiles/${id}`, { method: "DELETE", token })
}

export async function listMerchantSalesChannels(
  token: string
): Promise<{ sales_channels: MerchantSalesChannel[] }> {
  return request(`/merchant/sales-channels`, { token })
}

export async function createStockLocation(
  token: string,
  body: CreateStockLocationInput
): Promise<{ stock_location: StockLocation }> {
  return request<{ stock_location: StockLocation }>("/merchant/stock-locations", {
    method: "POST",
    token,
    body,
  })
}

export async function updateStockLocation(
  token: string,
  id: string,
  body: UpdateStockLocationInput
): Promise<{ stock_location: StockLocation }> {
  return request<{ stock_location: StockLocation }>(`/merchant/stock-locations/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteStockLocation(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/stock-locations/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Return reasons
// -----------------------------

export type ReturnReason = {
  id: string
  value: string
  label: string
  description?: string | null
  created_at: string
  updated_at?: string
}

export type CreateReturnReasonInput = {
  value: string
  label: string
  description?: string
}

export type UpdateReturnReasonInput = {
  label?: string
  description?: string | null
}

export async function listReturnReasons(
  token: string
): Promise<{ return_reasons: ReturnReason[]; count: number }> {
  return request<{ return_reasons: ReturnReason[]; count: number }>(
    "/merchant/return-reasons",
    { token }
  )
}

export async function createReturnReason(
  token: string,
  body: CreateReturnReasonInput
): Promise<{ return_reason: ReturnReason }> {
  return request<{ return_reason: ReturnReason }>("/merchant/return-reasons", {
    method: "POST",
    token,
    body,
  })
}

export async function updateReturnReason(
  token: string,
  id: string,
  body: UpdateReturnReasonInput
): Promise<{ return_reason: ReturnReason }> {
  return request<{ return_reason: ReturnReason }>(`/merchant/return-reasons/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deleteReturnReason(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/return-reasons/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Returns / Exchanges / Claims
// -----------------------------

// Shape mirrors GET /merchant/returns row (returns/route.ts formatter).
export type Return = {
  id: string
  display_id: number
  status: string
  refund_amount?: number
  created_at: string
  order_id?: string
  order_display_id?: number
  item_count?: number
}

// Shape mirrors POST /merchant/exchanges response (exchanges/route.ts formatter).
export type Exchange = {
  id: string
  display_id: number
  status: string
  difference_due?: number
  created_at: string
  order_id?: string
  order_display_id?: number
}

// Shape mirrors POST /merchant/claims response (claims/route.ts formatter).
export type Claim = {
  id: string
  display_id: number
  status: string
  type: string
  refund_amount?: number
  created_at: string
  order_id?: string
  order_display_id?: number
}

// Item selector shared by returns/exchanges/claims. Backend filters to
// { id, quantity } where id is the order line item id and quantity > 0.
export type ReturnItemInput = { id: string; quantity: number }

export async function listReturns(
  token: string
): Promise<{ returns: Return[]; count: number }> {
  return request<{ returns: Return[]; count: number }>("/merchant/returns", { token })
}

export async function createReturn(
  token: string,
  body: { order_id: string; items: ReturnItemInput[]; refund_amount?: number }
): Promise<{ return: Return }> {
  return request<{ return: Return }>("/merchant/returns", {
    method: "POST",
    token,
    body,
  })
}

export async function createExchange(
  token: string,
  body: { order_id: string; items: ReturnItemInput[] }
): Promise<{ exchange: Exchange }> {
  return request<{ exchange: Exchange }>("/merchant/exchanges", {
    method: "POST",
    token,
    body,
  })
}

export async function createClaim(
  token: string,
  body: { order_id: string; type: "refund" | "replace"; items: ReturnItemInput[] }
): Promise<{ claim: Claim }> {
  return request<{ claim: Claim }>("/merchant/claims", {
    method: "POST",
    token,
    body,
  })
}

// GET /merchant/claims — lists claims across this tenant's orders.
export async function listClaims(
  token: string
): Promise<{ claims: Claim[]; count: number }> {
  return request<{ claims: Claim[]; count: number }>("/merchant/claims", { token })
}

// GET /merchant/exchanges — lists exchanges across this tenant's orders.
export async function listExchanges(
  token: string
): Promise<{ exchanges: Exchange[]; count: number }> {
  return request<{ exchanges: Exchange[]; count: number }>("/merchant/exchanges", { token })
}

// -----------------------------
// Price lists
// -----------------------------

// Shape mirrors formatPriceList() in price-lists/route.ts. `expires_at` maps to
// the pricing module's `ends_at` server-side.
export type PriceList = {
  id: string
  title: string
  description?: string | null
  status: "draft" | "active" | "inactive"
  starts_at?: string | null
  expires_at?: string | null
  prices_count?: number
  created_at: string
  updated_at?: string
}

// A single price row. NOTE: the backend (CreatePriceListSchema in
// price-lists/route.ts) REQUIRES `variant_id` on every price and rejects the
// request otherwise. `variant_id` is optional here only so the current create
// page (which does not yet supply one) still type-checks — the POST will 400
// until the page adds a variant selector.
export type PriceListPriceInput = {
  variant_id?: string
  amount: number
  currency_code: string
}

export type CreatePriceListInput = {
  title: string
  description?: string
  status?: "draft" | "active" | "inactive"
  prices: PriceListPriceInput[]
  starts_at?: string | null
  expires_at?: string | null
}

// NOTE: the backend PUT (UpdatePriceListSchema) validates only
// title/description/status/starts_at/expires_at and IGNORES `prices`. It is
// accepted here so the edit page type-checks, but price edits are a no-op until
// the backend adds price mutation support.
export type UpdatePriceListInput = {
  title?: string
  description?: string | null
  status?: "draft" | "active" | "inactive"
  prices?: PriceListPriceInput[]
  starts_at?: string | null
  expires_at?: string | null
}

export async function listPriceLists(
  token: string
): Promise<{ price_lists: PriceList[]; count: number }> {
  return request<{ price_lists: PriceList[]; count: number }>(
    "/merchant/price-lists",
    { token }
  )
}

export async function createPriceList(
  token: string,
  body: CreatePriceListInput
): Promise<{ price_list: PriceList }> {
  return request<{ price_list: PriceList }>("/merchant/price-lists", {
    method: "POST",
    token,
    body,
  })
}

export async function getPriceList(
  token: string,
  id: string
): Promise<{ price_list: PriceList }> {
  return request<{ price_list: PriceList }>(`/merchant/price-lists/${id}`, { token })
}

export async function updatePriceList(
  token: string,
  id: string,
  body: UpdatePriceListInput
): Promise<{ price_list: PriceList }> {
  return request<{ price_list: PriceList }>(`/merchant/price-lists/${id}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function deletePriceList(token: string, id: string): Promise<void> {
  return request<void>(`/merchant/price-lists/${id}`, { method: "DELETE", token })
}

// -----------------------------
// Draft orders
// -----------------------------

// Shape mirrors the draft-orders/route.ts formatter (GET rows + POST response).
export type DraftOrder = {
  id: string
  display_id: number
  status: string
  email?: string | null
  customer_name?: string
  currency_code: string
  total: number
  created_at: string
}

export type DraftOrderItemInput = {
  title: string
  quantity: number
  unit_price?: number
}

export async function listDraftOrders(
  token: string
): Promise<{ draft_orders: DraftOrder[]; count: number }> {
  return request<{ draft_orders: DraftOrder[]; count: number }>(
    "/merchant/draft-orders",
    { token }
  )
}

export async function createDraftOrder(
  token: string,
  body: { email?: string; customer_id?: string; items: DraftOrderItemInput[] }
): Promise<{ draft_order: DraftOrder }> {
  return request<{ draft_order: DraftOrder }>("/merchant/draft-orders", {
    method: "POST",
    token,
    body,
  })
}

// ---------------------------------------------------------------------------
// Marketing — Social accounts (Connect)
// Backend: /merchant/marketing/accounts (tenant-scoped)
// ---------------------------------------------------------------------------

export type SocialAccountStatus = "connected" | "expired" | "revoked" | "error"

export type SocialAccount = {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  status: SocialAccountStatus | string
  external_id: string | null
  connected_at: string | null
}

// Provider catalog entry as computed by the backend GET response. `configured`
// reflects whether the operator has set up the platform's APP-level credentials
// (OAuth apps). `connect` is the connection mechanism the backend expects.
export type SocialProvider = {
  platform: string
  label: string
  configured: boolean
  connect: "oauth" | "app_password" | "webhook_token" | string
  connected: boolean
}

export type ListSocialAccountsResponse = {
  accounts: SocialAccount[]
  providers: SocialProvider[]
}

// Mirrors the backend connect route body. OAuth platforms only need `platform`;
// token-based platforms (telegram) pass their secrets via `credentials`.
export type ConnectSocialInput = {
  platform: string
  mode?: "system" | "custom"
  client_id?: string
  client_secret?: string
  credentials?: Record<string, unknown>
}

// The connect route either returns an OAuth consent URL to redirect to, or the
// freshly created account (token-based platforms).
export type ConnectSocialResponse = {
  auth_url?: string
  account?: SocialAccount
}

export async function listSocialAccounts(
  token: string
): Promise<ListSocialAccountsResponse> {
  return request<ListSocialAccountsResponse>("/merchant/marketing/accounts", {
    token,
  })
}

export async function connectSocialAccount(
  token: string,
  input: ConnectSocialInput
): Promise<ConnectSocialResponse> {
  return request<ConnectSocialResponse>(
    "/merchant/marketing/accounts/connect",
    {
      method: "POST",
      token,
      body: input,
    }
  )
}

export async function disconnectSocialAccount(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/accounts/${id}`,
    {
      method: "DELETE",
      token,
    }
  )
}

export async function refreshSocialAccount(
  token: string,
  id: string
): Promise<{ refreshed: boolean }> {
  return request<{ refreshed: boolean }>(
    `/merchant/marketing/accounts/${id}/refresh`,
    {
      method: "POST",
      token,
    }
  )
}

// -----------------------------
// Billing (subscription + AI credits)
// -----------------------------

export type BillingPlan = {
  key: string
  name: string
  price_usd: number
  included_credits: number
  products_limit?: number | null
  seats_limit?: number | null
  domains_limit?: number | null
  features?: unknown
  sort?: number
}

export type BillingUsageRow = {
  action: string
  label: string
  units: number
  credits: number
}

export type BillingPack = {
  credits: number
  amount_usd: number
  bonus_pct: number
}

export type BillingOverview = {
  credit_usd: number
  /** Two buckets: plan credits expire at period end; purchased never do. */
  credits?: {
    total: number
    expiring: number
    purchased: number
    next_expiry: string | null
  }
  plan_status: string
  trial_ends_at: string | null
  wallet: { balance: number; reserved: number }
  current_plan: BillingPlan | null
  plans: BillingPlan[]
  allowance: { included: number; used_this_cycle: number; cycle_start: string }
  usage: BillingUsageRow[]
  packs: BillingPack[]
  gateway: { configured: boolean; name: string | null }
}

export async function getBillingOverview(
  token: string
): Promise<BillingOverview> {
  return request<BillingOverview>("/merchant/billing/overview", { token })
}

export type ChangePlanResponse = {
  pending?: boolean
  checkout_url?: string
  requested_plan?: { key: string; name: string; price_usd: number }
  message?: string
}

export async function changePlan(
  token: string,
  key: string
): Promise<ChangePlanResponse> {
  return request<ChangePlanResponse>("/merchant/billing/change-plan", {
    method: "POST",
    token,
    body: { key },
  })
}

/** Result of starting a browser test call against an agent. */
export type AgentTestCall = {
  call_id: string
  room_url: string
  token: string
  bot_dispatched: boolean
}

/**
 * POST /merchant/call-center/agents/:id/test-call — start a live browser test
 * call. The backend creates a Daily room + owner token and dispatches the bot.
 */
export async function startAgentTestCall(
  token: string,
  id: string
): Promise<AgentTestCall> {
  return request<AgentTestCall>(
    `/merchant/call-center/agents/${id}/test-call`,
    { method: "POST", token }
  )
}

/**
 * POST /merchant/call-center/agents/:id/test-call/end — end a browser test call
 * (tears down the bot + marks the call completed).
 */
export async function endAgentTestCall(
  token: string,
  id: string,
  callId: string
): Promise<{ call_id: string; ended: boolean }> {
  return request<{ call_id: string; ended: boolean }>(
    `/merchant/call-center/agents/${id}/test-call/end`,
    { method: "POST", token, body: { call_id: callId } }
  )
}


// ---------------------------------------------------------------------------
// Store notification email templates (default catalog, per-shop editable)
// ---------------------------------------------------------------------------

export type NotifTemplateSummary = {
  key: string
  title: string
  description: string
  category: string
  trigger: string | null
  customized: boolean
  enabled: boolean
}

export type NotifToken = { token: string; label: string; sample: string }

export type NotifTemplateDetail = {
  key: string
  title: string
  description: string
  category: string
  trigger: string | null
  tokens: NotifToken[]
  subject: string
  body: string
  enabled: boolean
  customized: boolean
  defaultSubject: string
  defaultBody: string
  previewSubject: string
  previewHtml: string
}

export async function listNotificationTemplates(
  token: string
): Promise<{ templates: NotifTemplateSummary[] }> {
  return request("/merchant/marketing/email/notifications", { token })
}

export async function getNotificationTemplate(
  token: string,
  key: string
): Promise<NotifTemplateDetail> {
  return request(`/merchant/marketing/email/notifications/${key}`, { token })
}

export async function saveNotificationTemplate(
  token: string,
  key: string,
  body: { subject?: string; body?: string; enabled?: boolean }
): Promise<{ ok: boolean }> {
  return request(`/merchant/marketing/email/notifications/${key}`, {
    method: "PUT",
    token,
    body,
  })
}

export async function resetNotificationTemplate(
  token: string,
  key: string
): Promise<{ ok: boolean }> {
  return request(`/merchant/marketing/email/notifications/${key}`, {
    method: "DELETE",
    token,
  })
}

export async function testNotificationTemplate(
  token: string,
  key: string,
  to?: string
): Promise<{ ok: boolean; to?: string; suppressed?: boolean }> {
  return request(`/merchant/marketing/email/notifications/${key}/test`, {
    method: "POST",
    token,
    body: to ? { to } : {},
  })
}


// ===== Products parity (Medusa admin UX) additions 2026-07-12 =====

export type ProductListItem = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail?: string | null
  collection?: { id: string; title: string } | null
  type?: { id: string; value: string } | null
  tags?: { id: string; value: string }[]
  variants_count: number
  sales_channels?: { id: string; name: string }[]
  created_at: string
  updated_at?: string
}



export type ListProductsPagedParams = {
  q?: string
  offset?: number
  limit?: number
  status?: string[]
  type_id?: string[]
  tag_id?: string[]
  collection_id?: string[]
  category_id?: string[]
  order?: string
}



export async function listProductsPaged(
  token: string,
  params: ListProductsPagedParams = {}
): Promise<{ products: ProductListItem[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.order) search.set("order", params.order)
  if (params.status?.length) search.set("status", params.status.join(","))
  if (params.type_id?.length) search.set("type_id", params.type_id.join(","))
  if (params.tag_id?.length) search.set("tag_id", params.tag_id.join(","))
  if (params.collection_id?.length) {
    search.set("collection_id", params.collection_id.join(","))
  }
  if (params.category_id?.length) {
    search.set("category_id", params.category_id.join(","))
  }
  const qs = search.toString()
  return request<{ products: ProductListItem[]; count: number }>(
    `/merchant/products${qs ? `?${qs}` : ""}`,
    { token }
  )
}



export type ProductFullVariant = {
  id: string
  title: string
  /** The variant's own thumbnail (an image from the product's gallery). */
  thumbnail?: string | null
  sku: string | null
  barcode: string | null
  ean: string | null
  upc: string | null
  options: ProductFullVariantOption[]
  prices: ProductFullVariantPrice[]
  inventory_quantity?: number
  manage_inventory: boolean
  allow_backorder: boolean
  // Optional attribute fields; returned when the backend includes them.
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  mid_code?: string | null
  hs_code?: string | null
  origin_country?: string | null
  material?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}



export type ProductFull = {
  id: string
  title: string
  subtitle?: string | null
  handle: string
  description?: string | null
  status: string
  thumbnail?: string | null
  images: { id: string; url: string; rank?: number }[]
  options: {
    id: string
    title: string
    values: { id: string; value: string; rank?: number | null }[]
  }[]
  variants: ProductFullVariant[]
  collection?: { id: string; title: string } | null
  categories?: { id: string; name: string }[]
  type?: { id: string; value: string } | null
  tags?: { id: string; value: string }[]
  sales_channels?: { id: string; name: string }[]
  shipping_profile?: { id: string; name: string } | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  mid_code?: string | null
  hs_code?: string | null
  origin_country?: string | null
  material?: string | null
  discountable?: boolean
  external_id?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at?: string
}



export async function getProductFull(
  token: string,
  id: string
): Promise<{ product: ProductFullDetail }> {
  return request<{ product: ProductFullDetail }>(
    `/merchant/products/${id}?full=1`,
    { token }
  )
}



export async function createProductOption(
  token: string,
  productId: string,
  payload: { title: string; values: string[] }
): Promise<{ product_option: ProductOption }> {
  return request<{ product_option: ProductOption }>(
    `/merchant/products/${productId}/options`,
    { method: "POST", token, body: payload }
  )
}



export async function updateProductOption(
  token: string,
  productId: string,
  optionId: string,
  payload: { title?: string; values?: string[] }
): Promise<{ product_option: ProductOption }> {
  return request<{ product_option: ProductOption }>(
    `/merchant/products/${productId}/options/${optionId}`,
    { method: "POST", token, body: payload }
  )
}



export async function deleteProductOption(
  token: string,
  productId: string,
  optionId: string
): Promise<void> {
  await request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/products/${productId}/options/${optionId}`,
    { method: "DELETE", token }
  )
}



export async function listStoreCurrencies(
  token: string
): Promise<{ currencies: string[]; default_currency: string }> {
  return request<{ currencies: string[]; default_currency: string }>(
    "/merchant/store/currencies",
    { token }
  )
}

export type VariantPriceInput = {
  currency_code: string
  amount: number
}



export type CreateVariantInput = {
  title?: string
  sku?: string
  barcode?: string
  ean?: string
  upc?: string
  manage_inventory?: boolean
  allow_backorder?: boolean
  options: Record<string, string>
  prices: { currency_code: string; amount: number }[]
}



export type UpdateVariantInput = {
  title?: string
  material?: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  manage_inventory?: boolean
  allow_backorder?: boolean
  options?: Record<string, string>
  prices?: VariantPriceInput[]
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  mid_code?: string | null
  hs_code?: string | null
  origin_country?: string | null
  metadata?: Record<string, unknown> | null
}



export async function createVariant(
  token: string,
  productId: string,
  payload: CreateVariantInput
): Promise<{ variant: any }> {
  return request<{ variant: any }>(`/merchant/products/${productId}/variants`, {
    method: "POST",
    token,
    body: payload,
  })
}



export async function updateVariant(
  token: string,
  productId: string,
  variantId: string,
  payload: VariantUpsertPayload
): Promise<{ variant: any }> {
  return request<{ variant: any }>(
    `/merchant/products/${productId}/variants/${variantId}`,
    {
      method: "POST",
      token,
      body: payload,
    }
  )
}

/**
 * Set which VARIANTS a product image belongs to (Medusa's model: images live on
 * the product; each one is linked to the variants it shows). An image linked to
 * no variants is shown for all of them.
 */
export async function setImageVariants(
  token: string,
  productId: string,
  imageId: string,
  payload: { add?: string[]; remove?: string[] }
): Promise<{ added: string[]; removed: string[] }> {
  return request<{ added: string[]; removed: string[] }>(
    `/merchant/products/${productId}/images/${imageId}/variants`,
    {
      method: "POST",
      token,
      body: payload,
    }
  )
}



export async function deleteVariant(
  token: string,
  productId: string,
  variantId: string
): Promise<void> {
  await request<void>(`/merchant/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
    token,
  })
}



export type VariantPriceBatchUpdate = {
  variant_id: string
  prices: { currency_code: string; amount: number }[]
}



export async function updateVariantPricesBatch(
  token: string,
  productId: string,
  updates: VariantPriceBatchUpdate[]
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/merchant/products/${productId}/prices`, {
    method: "POST",
    token,
    body: { updates },
  })
}



export type ProductStockLocationLevel = {
  location_id: string
  location_name: string
  stocked_quantity: number
  reserved_quantity: number
}



export type ProductStockVariant = {
  variant_id: string
  variant_title: string
  sku: string | null
  inventory_item_id: string | null
  locations: ProductStockLocationLevel[]
}



export async function getProductStock(
  token: string,
  productId: string
): Promise<{ variants: ProductStockVariantRow[] }> {
  return request<{ variants: ProductStockVariantRow[] }>(
    `/merchant/products/${productId}/stock`,
    { token }
  )
}



export type ProductStockUpdate = {
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
}



export async function updateProductStock(
  token: string,
  productId: string,
  updates: ProductStockUpdateInput[]
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/merchant/products/${productId}/stock`, {
    method: "POST",
    token,
    body: { updates },
  })
}

export async function deleteProductImage(
  token: string,
  productId: string,
  imageId: string
): Promise<{ product: any }> {
  return request<{ product: any }>(
    `/merchant/products/${productId}/media?image_id=${encodeURIComponent(imageId)}`,
    { method: "DELETE", token }
  )
}

export type ProductFullImage = { id: string; url: string }



export type ProductFullOptionValue = {
  id: string
  value: string
}



export type ProductFullOption = {
  id: string
  title: string
  values: ProductFullOptionValue[]
}



export type ProductFullVariantPrice = {
  id: string
  currency_code: string
  amount: number
}



export type ProductFullVariantOption = {
  id: string
  value: string
  option: { id: string; title: string } | null
}



export type ProductFullDetail = {
  id: string
  title: string
  subtitle: string | null
  handle: string
  description: string | null
  status: string
  thumbnail: string | null
  images: { id: string; url: string }[]
  options: ProductFullOption[]
  variants: ProductFullVariant[]
  collection: { id: string; title: string } | null
  categories: { id: string; name: string }[]
  type: { id: string; value: string } | null
  tags: { id: string; value: string }[]
  sales_channels: { id: string; name: string }[]
  shipping_profile: { id: string; name: string } | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  mid_code: string | null
  hs_code: string | null
  origin_country: string | null
  material: string | null
  discountable: boolean
  external_id: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}



export async function listShippingProfilesLite(
  token: string
): Promise<{ profiles: { id: string; name: string }[] }> {
  const res = await request<{
    shipping_profiles?: { id: string; name: string }[]
    profiles?: { id: string; name: string }[]
  }>("/merchant/shipping-profiles", { token })
  return {
    profiles: (res.profiles || res.shipping_profiles || []).map((p) => ({
      id: p.id,
      name: p.name,
    })),
  }
}

export type VariantUpsertPayload = {
  title?: string
  /** A URL from the product's gallery (null clears it). */
  thumbnail?: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  manage_inventory?: boolean
  allow_backorder?: boolean
  options?: Record<string, string>
  prices?: { currency_code: string; amount: number }[]
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  mid_code?: string | null
  hs_code?: string | null
  origin_country?: string | null
  material?: string | null
  metadata?: Record<string, any> | null
}



export type ProductStockVariantRow = {
  variant_id: string
  variant_title: string
  sku: string | null
  inventory_item_id: string | null
  locations: ProductStockLocationLevel[]
}



export type ProductStockUpdateInput = {
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
}



// ===== Promotions+Campaigns parity additions 2026-07-12 =====

export type PromotionListItem = {
  id: string
  display_code: string
  is_automatic: boolean
  type: "standard" | "buyget"
  status: "draft" | "active" | "inactive"
  method: "code" | "automatic"
  value_type: "fixed" | "percentage" | null
  value: number | null
  currency_code: string | null
  campaign: { id: string; name: string } | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
}



export type CampaignBudget = {
  type: "spend" | "usage" | "use_by_attribute" | "spend_by_attribute"
  currency_code: string | null
  limit: number | null
  used: number
  attribute: string | null
}



export type CampaignListItem = {
  id: string
  name: string
  description: string | null
  campaign_identifier_display: string
  starts_at: string | null
  ends_at: string | null
  budget: CampaignBudget | null
  promotions_count: number
  created_at: string
  updated_at: string
}



export type CampaignDetail = CampaignListItem & {
  promotions: PromotionListItem[]
}



export type CreateCampaignPayload = {
  name: string
  description?: string | null
  identifier: string
  starts_at?: string | null
  ends_at?: string | null
  budget?: {
    type: CampaignBudget["type"]
    currency_code?: string
    limit?: number | null
    attribute?: string | null
  } | null
}



export type UpdateCampaignPayload = {
  name?: string
  description?: string | null
  identifier?: string
  starts_at?: string | null
  ends_at?: string | null
  budget?: { limit: number | null }
}



export async function listCampaigns(
  token: string,
  params?: { q?: string; offset?: number; limit?: number; order?: string }
): Promise<{ campaigns: CampaignListItem[]; count: number }> {
  const search = new URLSearchParams()
  if (params?.q) search.set("q", params.q)
  if (params?.offset !== undefined) search.set("offset", String(params.offset))
  if (params?.limit !== undefined) search.set("limit", String(params.limit))
  if (params?.order) search.set("order", params.order)
  const qs = search.toString()
  return request<{ campaigns: CampaignListItem[]; count: number }>(
    `/merchant/campaigns${qs ? `?${qs}` : ""}`,
    { token }
  )
}



export async function createCampaign(
  token: string,
  payload: CreateCampaignPayload
): Promise<{ campaign: CampaignListItem }> {
  return request<{ campaign: CampaignListItem }>("/merchant/campaigns", {
    method: "POST",
    token,
    body: payload,
  })
}



export async function getCampaign(
  token: string,
  id: string
): Promise<{ campaign: CampaignDetail }> {
  return request<{ campaign: CampaignDetail }>(
    `/merchant/campaigns/${encodeURIComponent(id)}`,
    { token }
  )
}



export async function updateCampaign(
  token: string,
  id: string,
  partial: UpdateCampaignInput
): Promise<{ campaign: CampaignDetail }> {
  return request<{ campaign: CampaignDetail }>(
    `/merchant/campaigns/${encodeURIComponent(id)}`,
    { method: "POST", token, body: partial }
  )
}



export async function deleteCampaign(token: string, id: string): Promise<void> {
  await request<void>(`/merchant/campaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  })
}



export async function addPromotionsToCampaign(
  token: string,
  id: string,
  promotionIds: string[]
): Promise<{ campaign: CampaignDetail }> {
  return request<{ campaign: CampaignDetail }>(
    `/merchant/campaigns/${encodeURIComponent(id)}/promotions`,
    { method: "POST", token, body: { add: promotionIds } }
  )
}



export async function removePromotionsFromCampaign(
  token: string,
  id: string,
  promotionIds: string[]
): Promise<{ campaign: CampaignDetail }> {
  return request<{ campaign: CampaignDetail }>(
    `/merchant/campaigns/${encodeURIComponent(id)}/promotions`,
    { method: "POST", token, body: { remove: promotionIds } }
  )
}

export async function listPromotions(
  token: string,
  params: {
    q?: string
    offset?: number
    limit?: number
    status?: string[]
    campaign_id?: string
  } = {}
): Promise<{ promotions: PromotionListItem[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  if (params.offset != null) qs.set("offset", String(params.offset))
  if (params.limit != null) qs.set("limit", String(params.limit))
  if (params.status?.length) {
    params.status.forEach((s) => qs.append("status", s))
  }
  if (params.campaign_id) qs.set("campaign_id", params.campaign_id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return request<{ promotions: PromotionListItem[]; count: number }>(
    `/merchant/promotions${suffix}`,
    { token }
  )
}



export async function deletePromotion(token: string, id: string): Promise<void> {
  await request<unknown>(`/merchant/promotions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  })
}



export type PromotionRuleOperator = "in" | "eq" | "ne"



export type PromotionRuleInput = {
  // Backend attribute identifier (the catalog `value`, e.g. "items.product.id"
  // or "customer.groups.id") — the create/batch routes whitelist this, never
  // the display `id`.
  attribute: string
  operator: PromotionRuleOperator
  values: string[]
}



export type PromotionRuleValueOption = {
  value: string
  label: string
}



export type PromotionRuleAttribute = {
  /** Short id, e.g. "product". Disguised attributes have id === value. */
  id: string
  /** Full attribute value path, e.g. "items.product.id" — this is what rule
   *  create/update ops must send as `attribute`. */
  value: string
  label: string
  field_type: "multiselect" | "select" | "number"
  required?: boolean
  disguised?: boolean
  operators: { id: string; label: string }[]
}



export type PromotionApplicationMethod = {
  type: "fixed" | "percentage"
  target_type: "items" | "shipping_methods" | "order"
  value: number
  currency_code?: string | null
  allocation?: "each" | "across" | "once" | null
  max_quantity?: number | null
  apply_to_quantity?: number | null
  buy_rules_min_quantity?: number | null
}



export type CreatePromotionPayload = {
  display_code: string
  is_automatic: boolean
  type: "standard" | "buyget"
  status: "draft" | "active" | "inactive"
  application_method: {
    type: "fixed" | "percentage"
    target_type: "items" | "shipping_methods" | "order"
    value: number
    currency_code?: string
    allocation?: "each" | "across"
    max_quantity?: number | null
    apply_to_quantity?: number
    buy_rules_min_quantity?: number
  }
  rules?: PromotionRuleInput[]
  target_rules?: PromotionRuleInput[]
  buy_rules?: PromotionRuleInput[]
  campaign_id?: string
  starts_at?: string | null
  ends_at?: string | null
  // CONTRACT EXTENSION (flagged in notes): usage limit for the promotion, maps
  // to promotion.limit in the promotion module (spec field "Usage Limit").
  limit?: number | null
}



export type PromotionRuleDisplay = {
  id: string
  attribute: string
  attribute_label: string
  operator: string
  values: { value: string; label: string }[]
}



export type PromotionDetail = PromotionListItem & {
  application_method: PromotionApplicationMethod | null
  rules: PromotionRule[]
  target_rules: PromotionRule[]
  buy_rules: PromotionRule[]
  is_tax_inclusive?: boolean
  limit?: number | null
  used?: number | null
  metadata?: Record<string, unknown> | null
}



export async function createPromotion(
  token: string,
  payload: CreatePromotionPayload
): Promise<{ promotion: PromotionDetail }> {
  return request<{ promotion: PromotionDetail }>("/merchant/promotions", {
    method: "POST",
    token,
    body: payload,
  })
}

// CONTRACT EXTENSION (flagged in notes): optional 4th param `targetType` maps
// to the backend's supported application_method_target_type query param. The
// attribute catalog differs per target type (empty for shipping_methods), so
// callers building target-rules MUST pass it or they will offer attributes
// the create route rejects.


export async function listRuleAttributes(
  token: string,
  ruleType: "rules" | "target-rules" | "buy-rules",
  promotionType: "standard" | "buyget",
  targetType?: "items" | "shipping_methods" | "order"
): Promise<{ attributes: PromotionRuleAttribute[] }> {
  const params = new URLSearchParams({
    rule_type: ruleType,
    promotion_type: promotionType,
  })
  if (targetType) {
    params.set("application_method_target_type", targetType)
  }
  return request<{ attributes: PromotionRuleAttribute[] }>(
    `/merchant/promotions/rule-attributes?${params.toString()}`,
    { token }
  )
}



export async function listRuleValues(
  token: string,
  ruleType: "rules" | "target-rules" | "buy-rules",
  attribute: string,
  q?: string
): Promise<{ values: PromotionRuleValueOption[] }> {
  const params = new URLSearchParams({
    rule_type: ruleType,
    attribute,
  })
  if (q) {
    params.set("q", q)
  }
  return request<{ values: PromotionRuleValueOption[] }>(
    `/merchant/promotions/rule-values?${params.toString()}`,
    { token }
  )
}



export type PromotionRuleValue = { value: string; label: string }



export type PromotionRule = {
  /** null for disguised application-method rules (currency_code,
   *  buy_rules_min_quantity, apply_to_quantity). */
  id: string | null
  /** Full attribute value path for real rules (e.g. "items.product.id");
   *  the disguised id for disguised rules (id === value there). */
  attribute: string
  attribute_label: string
  operator: PromotionRuleOperator
  operator_label?: string
  field_type?: "multiselect" | "select" | "number"
  required?: boolean
  disguised?: boolean
  /** Array of { value, label } for select/multiselect attributes; the RAW
   *  NUMBER (or null) for field_type "number" per the backend contract —
   *  always normalize before treating as an array. */
  values: PromotionRuleValue[] | number | null
}



export type PromotionRuleType = "rules" | "target-rules" | "buy-rules"



export type PromotionCampaignRef = { id: string; name: string }



export type UpdatePromotionInput = {
  display_code?: string
  status?: "draft" | "active" | "inactive"
  is_automatic?: boolean
  is_tax_inclusive?: boolean
  application_method?: Partial<PromotionApplicationMethod>
  campaign_id?: string | null
  starts_at?: string | null
  ends_at?: string | null
}



export type UpdatePromotionRulesOps = {
  create?: PromotionRuleInput[]
  update?: {
    id: string
    attribute: string
    operator: PromotionRuleOperator
    values: string[]
  }[]
  delete?: string[]
}



export async function getPromotion(
  token: string,
  id: string
): Promise<{ promotion: PromotionDetail }> {
  return request<{ promotion: PromotionDetail }>(
    `/merchant/promotions/${encodeURIComponent(id)}`,
    { token }
  )
}



export async function updatePromotion(
  token: string,
  id: string,
  payload: UpdatePromotionInput
): Promise<{ promotion: PromotionDetail }> {
  return request<{ promotion: PromotionDetail }>(
    `/merchant/promotions/${encodeURIComponent(id)}`,
    { method: "POST", token, body: payload }
  )
}



export async function updatePromotionRules(
  token: string,
  id: string,
  ruleType: PromotionRuleType,
  ops: UpdatePromotionRulesOps
): Promise<{ promotion: PromotionDetail }> {
  return request<{ promotion: PromotionDetail }>(
    `/merchant/promotions/${encodeURIComponent(id)}/${ruleType}`,
    { method: "POST", token, body: ops }
  )
}



export type UpdateCampaignInput = {
  name?: string
  description?: string | null
  identifier?: string
  starts_at?: string | null
  ends_at?: string | null
  budget?: { limit: number | null }
}



// ===== Inventory+Reservations parity additions 2026-07-12 =====

export type InventoryItemRow = {
  id: string
  title: string | null
  sku: string | null
  thumbnail?: string | null
  reserved_quantity: number
  stocked_quantity: number
  variant_titles: string[]
}



export type InventoryLocationLevel = {
  id: string
  location_id: string
  location_name: string | null
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
  available_quantity: number
}



export type InventoryItemDetail = {
  id: string
  title: string | null
  sku: string | null
  thumbnail?: string | null
  reserved_quantity: number
  stocked_quantity: number
  variant_titles: string[]
  origin_country: string | null
  hs_code: string | null
  mid_code: string | null
  material: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  requires_shipping: boolean
  metadata: Record<string, any> | null
  location_levels: InventoryLevel[]
  variants: InventoryItemVariantLink[]
}



export type ReservationRow = {
  id: string
  inventory_item_id: string
  item_title: string | null
  sku: string | null
  location_id: string
  location_name: string | null
  quantity: number
  line_item_id: string | null
  order_id?: string | null
  order_display_id?: string | number | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_at?: string
  metadata?: Record<string, unknown> | null
}



export async function listInventoryItems(
  token: string,
  params: { q?: string; offset?: number; limit?: number } = {}
): Promise<{ items: InventoryItemRow[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.offset != null) search.set("offset", String(params.offset))
  if (params.limit != null) search.set("limit", String(params.limit))
  const qs = search.toString()
  const path = "/merchant/inventory-items" + (qs ? "?" + qs : "")
  return request<{ items: InventoryItemRow[]; count: number }>(path, { token })
}



export async function getInventoryItem(
  token: string,
  id: string
): Promise<{ item: InventoryItemDetail }> {
  return request<{ item: InventoryItemDetail }>(
    `/merchant/inventory-items/${id}`,
    { token }
  )
}



export async function createInventoryItem(
  token: string,
  payload: {
    sku?: string
    title?: string
    requires_shipping?: boolean
    origin_country?: string | null
    hs_code?: string | null
    mid_code?: string | null
    material?: string | null
    weight?: number | null
    length?: number | null
    height?: number | null
    width?: number | null
    metadata?: Record<string, unknown>
    location_levels?: { location_id: string; stocked_quantity?: number }[]
  }
): Promise<{ item: InventoryItemDetail }> {
  return request<{ item: InventoryItemDetail }>("/merchant/inventory-items", {
    token,
    method: "POST",
    body: payload,
  })
}



export async function updateInventoryItem(
  token: string,
  id: string,
  partial: Partial<{
    title: string | null
    sku: string | null
    requires_shipping: boolean
    origin_country: string | null
    hs_code: string | null
    mid_code: string | null
    material: string | null
    weight: number | null
    length: number | null
    height: number | null
    width: number | null
    metadata: Record<string, unknown> | null
  }>
): Promise<{ item: InventoryItemDetail }> {
  return request<{ item: InventoryItemDetail }>(
    `/merchant/inventory-items/${id}`,
    { token, method: "POST", body: partial }
  )
}



export async function deleteInventoryItem(
  token: string,
  id: string
): Promise<void> {
  return request<void>(`/merchant/inventory-items/${id}`, {
    method: "DELETE",
    token,
  })
}



export async function updateInventoryLevels(
  token: string,
  id: string,
  updates: { location_id: string; stocked_quantity: number }[]
): Promise<{ item: InventoryItemDetail }> {
  return request<{ item: InventoryItemDetail }>(
    `/merchant/inventory-items/${id}/levels`,
    { token, method: "POST", body: { updates } }
  )
}



export async function deleteInventoryLevel(
  token: string,
  id: string,
  locationId: string
): Promise<{ item: InventoryItemDetail }> {
  return request<{ item: InventoryItemDetail }>(
    `/merchant/inventory-items/${id}/levels?location_id=${encodeURIComponent(locationId)}`,
    { token, method: "DELETE" }
  )
}



export async function listReservations(
  token: string,
  params: {
    q?: string
    offset?: number
    limit?: number
    location_id?: string
    inventory_item_id?: string
  } = {}
): Promise<{ reservations: ReservationRow[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.offset != null) search.set("offset", String(params.offset))
  if (params.limit != null) search.set("limit", String(params.limit))
  if (params.location_id) search.set("location_id", params.location_id)
  if (params.inventory_item_id) search.set("inventory_item_id", params.inventory_item_id)
  const qs = search.toString()
  const path = "/merchant/reservations" + (qs ? "?" + qs : "")
  return request<{ reservations: ReservationRow[]; count: number }>(path, { token })
}



export async function getReservation(
  token: string,
  id: string
): Promise<{ reservation: ReservationRow & { metadata: Record<string, unknown> | null; location_level: { stocked_quantity: number; reserved_quantity: number; available_quantity: number; incoming_quantity: number } | null } }> {
  return request(`/merchant/reservations/${id}`, { token })
}



export async function createReservation(
  token: string,
  payload: {
    inventory_item_id: string
    location_id: string
    quantity: number
    description?: string
  }
): Promise<{ reservation: ReservationRow }> {
  return request<{ reservation: ReservationRow }>("/merchant/reservations", {
    token,
    method: "POST",
    body: payload,
  })
}



export async function updateReservation(
  token: string,
  id: string,
  partial: { location_id?: string; quantity?: number; description?: string | null; metadata?: Record<string, unknown> | null }
): Promise<{ reservation: ReservationRow }> {
  return request<{ reservation: ReservationRow }>(
    `/merchant/reservations/${id}`,
    { token, method: "POST", body: partial }
  )
}



export async function deleteReservation(
  token: string,
  id: string
): Promise<void> {
  return request<void>(`/merchant/reservations/${id}`, {
    method: "DELETE",
    token,
  })
}

export type InventoryLevelRow = {
  id: string
  location_id: string
  location_name: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
  available_quantity: number
}



export type InventoryItemVariantLink = {
  id: string
  title: string | null
  product_id: string | null
  product_title: string | null
}



export type CreateInventoryItemPayload = {
  title?: string
  sku?: string
  description?: string
  requires_shipping?: boolean
  width?: number
  length?: number
  height?: number
  weight?: number
  mid_code?: string
  hs_code?: string
  origin_country?: string
  material?: string
}



export type InventoryLevelUpdateInput = {
  location_id: string
  stocked_quantity: number
}



export type InventoryLevel = {
  id: string
  location_id: string
  location_name: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
  available_quantity: number
}



export type UpdateInventoryItemInput = {
  title?: string | null
  sku?: string | null
  requires_shipping?: boolean
  origin_country?: string | null
  hs_code?: string | null
  mid_code?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  metadata?: Record<string, any> | null
}



export type ListReservationsParams = {
  q?: string
  offset?: number
  limit?: number
  location_id?: string
  inventory_item_id?: string
}



export type CreateReservationInput = {
  inventory_item_id: string
  location_id: string
  quantity: number
  description?: string | null
}



export type UpdateReservationInput = {
  location_id?: string
  quantity?: number
  description?: string | null
}



// ===== Customers completion parity additions 2026-07-12 =====

export type CreateCustomerInput = {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  phone?: string
}



export type UpdateCustomerInput = {
  email?: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
}



export type CustomerAddressInput = {
  address_name?: string
  first_name?: string
  last_name?: string
  company?: string
  address_1: string
  address_2?: string
  city?: string
  postal_code?: string
  province?: string
  country_code: string
  phone?: string
  is_default_shipping?: boolean
  is_default_billing?: boolean
}



export type CustomerGroupDetail = {
  id: string
  name: string
  customers_count: number
  created_at?: string
  updated_at?: string
  metadata?: Record<string, unknown> | null
}



export type GroupCustomer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  has_account: boolean
  created_at?: string
}



export async function createCustomer(
  token: string,
  payload: CreateCustomerInput
): Promise<{ customer: CustomerDetail }> {
  return request<{ customer: CustomerDetail }>("/merchant/customers", {
    method: "POST",
    token,
    body: payload,
  })
}



export async function updateCustomer(
  token: string,
  id: string,
  partial: UpdateCustomerInput
): Promise<{ customer: CustomerDetail }> {
  return request<{ customer: CustomerDetail }>(`/merchant/customers/${id}`, {
    method: "POST",
    token,
    body: partial,
  })
}



export async function updateCustomerMetadata(
  token: string,
  id: string,
  metadata: Record<string, unknown> | null
): Promise<{ customer: CustomerDetail }> {
  return updateCustomer(token, id, { metadata })
}

/**
 * DELETE /merchant/customers/:id
 *
 * Tenant-safe delete: succeeds only for customers this tenant created
 * (metadata.tenant_id) that have no orders outside the tenant's sales channel.
 * The backend returns 409 when foreign orders exist; surface that message.
 */


export async function deleteCustomer(token: string, id: string): Promise<void> {
  await request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/customers/${id}`,
    { method: "DELETE", token }
  )
}



export async function createCustomerAddress(
  token: string,
  id: string,
  address: CustomerAddressInput
): Promise<{ address: CustomerAddress }> {
  return request<{ address: CustomerAddress }>(
    `/merchant/customers/${id}/addresses`,
    { method: "POST", token, body: address }
  )
}



export async function updateCustomerAddress(
  token: string,
  id: string,
  addressId: string,
  partial: Partial<CustomerAddressInput>
): Promise<{ address: CustomerAddress }> {
  return request<{ address: CustomerAddress }>(
    `/merchant/customers/${id}/addresses/${addressId}`,
    { method: "POST", token, body: partial }
  )
}



export async function deleteCustomerAddress(
  token: string,
  id: string,
  addressId: string
): Promise<void> {
  await request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/customers/${id}/addresses/${addressId}`,
    { method: "DELETE", token }
  )
}



export async function addCustomerToGroups(
  token: string,
  id: string,
  body: { add?: string[]; remove?: string[] }
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/merchant/customers/${id}/customer-groups`, {
    method: "POST",
    token,
    body,
  })
}



export async function getCustomerGroup(
  token: string,
  id: string
): Promise<{ group: CustomerGroupDetail }> {
  return request<{ group: CustomerGroupDetail }>(
    `/merchant/customer-groups/${id}`,
    { token }
  )
}



export async function updateCustomerGroup(
  token: string,
  id: string,
  body: { name?: string; metadata?: Record<string, unknown> | null }
): Promise<{ group: CustomerGroupDetail }> {
  return request<{ group: CustomerGroupDetail }>(
    `/merchant/customer-groups/${id}`,
    { method: "POST", token, body }
  )
}



export async function deleteCustomerGroup(
  token: string,
  id: string
): Promise<void> {
  await request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/customer-groups/${id}`,
    { method: "DELETE", token }
  )
}



export async function listGroupCustomers(
  token: string,
  id: string,
  params?: { q?: string; offset?: number; limit?: number }
): Promise<{ customers: GroupCustomer[]; count: number }> {
  const search = new URLSearchParams()
  if (params?.q) search.set("q", params.q)
  if (typeof params?.offset === "number") search.set("offset", String(params.offset))
  if (typeof params?.limit === "number") search.set("limit", String(params.limit))
  const qs = search.toString()
  return request<{ customers: GroupCustomer[]; count: number }>(
    `/merchant/customer-groups/${id}/customers${qs ? `?${qs}` : ""}`,
    { token }
  )
}



export async function batchGroupCustomers(
  token: string,
  id: string,
  body: { add?: string[]; remove?: string[] }
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/merchant/customer-groups/${id}/customers`, {
    method: "POST",
    token,
    body,
  })
}

export interface CustomerFullAddress {
  id: string
  address_name?: string | null
  company?: string | null
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

/** Rich customer returned by GET /merchant/customers/:id used by the detail page. */


export type CustomerFull = CustomerDetail & {
  company_name?: string | null
  has_account?: boolean
  metadata?: Record<string, unknown> | null
  addresses?: CustomerFullAddress[]
}

/** Customer row as returned by the list endpoint, including account/company info. */


export type CustomerListItem = Customer & {
  has_account?: boolean
  company_name?: string | null
  phone?: string | null
}



export type UpsertCustomerInput = {
  email?: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
}



// ===== Taxonomy parity additions 2026-07-12 =====

export type CategoryDetail = {
  id: string
  name: string
  description: string | null
  handle: string
  is_active: boolean
  is_internal: boolean
  rank: number
  parent_category: { id: string; name: string } | null
  category_children: {
    id: string
    name: string
    rank: number
    is_active: boolean
  }[]
  products_count: number
  metadata: Record<string, any>
}



export type UpdateCategoryInput = {
  name?: string
  description?: string | null
  handle?: string
  is_active?: boolean
  is_internal?: boolean
  parent_category_id?: string | null
  rank?: number
  metadata?: Record<string, any>
}

// Shared row shape for category/collection product tables (Product, Collection,
// Sales Channels, Variants, Status columns).


export type TaxonomyProductRow = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail: string | null
  collection: { id: string; title: string } | null
  variants_count: number
  sales_channels: { id: string; name: string }[]
}



export type CategoryReorderUpdate = {
  id: string
  rank: number
  parent_category_id?: string | null
}



export type ProductOptionRegistryEntry = {
  title: string
  values: string[]
  product_count: number
  products: { id: string; title: string }[]
}



export async function getCategory(
  token: string,
  id: string
): Promise<{ category: CategoryDetail }> {
  return request<{ category: CategoryDetail }>(
    `/merchant/product-categories/${id}`,
    { token }
  )
}



export async function updateCategory(
  token: string,
  id: string,
  body: UpdateCategoryInput
): Promise<{ category: CategoryDetail }> {
  return request<{ category: CategoryDetail }>(
    `/merchant/product-categories/${id}`,
    { method: "POST", token, body }
  )
}



export async function deleteCategory(token: string, id: string): Promise<void> {
  await request<void>(`/merchant/product-categories/${id}`, {
    method: "DELETE",
    token,
  })
}



export async function listCategoryProducts(
  token: string,
  id: string,
  params: { q?: string; offset?: number; limit?: number } = {}
): Promise<{ products: TaxonomyProductRow[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.offset != null) search.set("offset", String(params.offset))
  if (params.limit != null) search.set("limit", String(params.limit))
  const qs = search.toString()
  return request<{ products: TaxonomyProductRow[]; count: number }>(
    `/merchant/product-categories/${id}/products` + (qs ? "?" + qs : ""),
    { token }
  )
}



export async function batchCategoryProducts(
  token: string,
  id: string,
  body: { add: string[]; remove: string[] }
): Promise<{
  success: boolean
  category_id: string
  add: string[]
  remove: string[]
}> {
  return request<{
    success: boolean
    category_id: string
    add: string[]
    remove: string[]
  }>(`/merchant/product-categories/${id}/products`, {
    method: "POST",
    token,
    body,
  })
}



export async function reorderCategories(
  token: string,
  updates: CategoryReorderUpdate[]
): Promise<{ success: boolean; count: number }> {
  return request<{ success: boolean; count: number }>(
    `/merchant/product-categories/reorder`,
    { method: "POST", token, body: { updates } }
  )
}

// ---- Taxonomy: collection product batch ----



export async function batchCollectionProducts(
  token: string,
  id: string,
  body: { add: string[]; remove: string[] }
): Promise<{
  success: boolean
  collection_id: string
  add: string[]
  remove: string[]
}> {
  return request<{
    success: boolean
    collection_id: string
    add: string[]
    remove: string[]
  }>(`/merchant/collections/${id}/products`, {
    method: "POST",
    token,
    body,
  })
}

// ---- Taxonomy: product option registry (read-only, tenancy-adapted) ----



export async function listProductOptionRegistry(
  token: string
): Promise<{ options: ProductOptionRegistryEntry[] }> {
  return request<{ options: ProductOptionRegistryEntry[] }>(
    `/merchant/product-options`,
    { token }
  )
}

// ===== Settings tail parity additions 2026-07-12 =====

export type TenantCurrencies = {
  currencies: string[]
  default_currency: string
}

// Persists the tenant's currency selection (enabled set + default) via
// POST /merchant/store/currencies. The backend validates every code against
// the global store's supported list and requires default_currency to be within
// the submitted set. Returns the persisted selection so callers can reflect
// the canonical server state instead of a local echo.


export async function updateTenantCurrencies(
  token: string,
  body: { currencies: string[]; default_currency: string }
): Promise<TenantCurrencies> {
  return request<TenantCurrencies>("/merchant/store/currencies", {
    method: "POST",
    token,
    body: {
      currencies: body.currencies.map((c) => c.toLowerCase()),
      default_currency: body.default_currency.toLowerCase(),
    },
  })
}

export type TaxRateRule = {
  reference: string
  reference_id: string
}



export type TaxRate = {
  id: string
  name: string
  rate: number | null
  code: string | null
  is_default: boolean
  is_combinable: boolean
  rules: TaxRateRule[]
  created_at?: string
  updated_at?: string
}



export type TaxRegionProvince = {
  id: string
  country_code: string
  province_code: string | null
  parent_id: string | null
  default_rate: {
    id: string
    name: string
    rate: number
    code?: string | null
  } | null
}



export type TaxRegionDetail = {
  id: string
  country_code: string
  province_code: string | null
  parent_id: string | null
  provider_id?: string | null
  rates: TaxRate[]
  provinces: TaxRegionProvince[]
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}



export type TaxRateInput = {
  name: string
  rate?: number | null
  code?: string | null
  is_default?: boolean
  is_combinable?: boolean
  rules?: TaxRateRule[]
}



export type CreateTaxProvinceInput = {
  province_code: string
  default_tax_rate?: {
    name: string
    rate?: number | null
    code?: string | null
    is_combinable?: boolean
  } | null
}



export async function getTaxRegion(
  token: string,
  id: string
): Promise<{ tax_region: TaxRegionDetail }> {
  return request<{ tax_region: TaxRegionDetail }>(`/merchant/tax-regions/${id}`, {
    token,
  })
}



export async function createTaxRate(
  token: string,
  regionId: string,
  body: TaxRateInput
): Promise<{ tax_rate: TaxRate }> {
  return request<{ tax_rate: TaxRate }>(
    `/merchant/tax-regions/${regionId}/tax-rates`,
    { method: "POST", token, body }
  )
}



export async function updateTaxRate(
  token: string,
  regionId: string,
  rateId: string,
  body: Partial<TaxRateInput>
): Promise<{ tax_rate: TaxRate }> {
  return request<{ tax_rate: TaxRate }>(
    `/merchant/tax-regions/${regionId}/tax-rates/${rateId}`,
    { method: "POST", token, body }
  )
}



export async function deleteTaxRate(
  token: string,
  regionId: string,
  rateId: string
): Promise<void> {
  return request<void>(`/merchant/tax-regions/${regionId}/tax-rates/${rateId}`, {
    method: "DELETE",
    token,
  })
}



export async function createTaxProvince(
  token: string,
  regionId: string,
  body: CreateTaxProvinceInput
): Promise<{ tax_region: TaxRegionProvince }> {
  return request<{ tax_region: TaxRegionProvince }>(
    `/merchant/tax-regions/${regionId}/provinces`,
    { method: "POST", token, body }
  )
}

export type RefundReason = {
  id: string
  label: string
  code: string
  description?: string | null
  created_at: string
  updated_at?: string
}



export async function listRefundReasons(
  token: string,
  params: { q?: string } = {}
): Promise<{ refund_reasons: RefundReason[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  const s = qs.toString()
  return request<{ refund_reasons: RefundReason[]; count: number }>(
    `/merchant/refund-reasons${s ? `?${s}` : ""}`,
    { token }
  )
}



export async function createRefundReason(
  token: string,
  body: { label: string; code?: string; description?: string }
): Promise<{ refund_reason: RefundReason }> {
  return request<{ refund_reason: RefundReason }>("/merchant/refund-reasons", {
    method: "POST",
    token,
    body,
  })
}



export async function updateRefundReason(
  token: string,
  id: string,
  body: { label?: string; code?: string; description?: string | null }
): Promise<{ refund_reason: RefundReason }> {
  return request<{ refund_reason: RefundReason }>(
    `/merchant/refund-reasons/${id}`,
    { method: "PUT", token, body }
  )
}



export async function deleteRefundReason(
  token: string,
  id: string
): Promise<void> {
  return request<void>(`/merchant/refund-reasons/${id}`, {
    method: "DELETE",
    token,
  })
}

// -----------------------------
// Product types (full: products_count + CRUD)
// -----------------------------



export type ProductTypeFull = {
  id: string
  value: string
  products_count: number
  created_at?: string
  updated_at?: string
}



export async function listProductTypesFull(
  token: string,
  params: { q?: string; offset?: number; limit?: number } = {}
): Promise<{ types: ProductTypeFull[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  if (params.offset != null) qs.set("offset", String(params.offset))
  if (params.limit != null) qs.set("limit", String(params.limit))
  const s = qs.toString()
  return request<{ types: ProductTypeFull[]; count: number }>(
    `/merchant/product-types${s ? `?${s}` : ""}`,
    { token }
  )
}



export async function createProductType(
  token: string,
  body: { value: string }
): Promise<{ type: ProductTypeFull }> {
  return request<{ type: ProductTypeFull }>("/merchant/product-types", {
    method: "POST",
    token,
    body,
  })
}



export async function updateProductType(
  token: string,
  id: string,
  body: { value: string }
): Promise<{ type: ProductTypeFull }> {
  return request<{ type: ProductTypeFull }>(`/merchant/product-types/${id}`, {
    method: "PUT",
    token,
    body,
  })
}



export async function deleteProductType(
  token: string,
  id: string
): Promise<void> {
  return request<void>(`/merchant/product-types/${id}`, {
    method: "DELETE",
    token,
  })
}

// -----------------------------
// Product tags (full: products_count + CRUD)
// -----------------------------



export type ProductTagFull = {
  id: string
  value: string
  products_count: number
  created_at?: string
  updated_at?: string
}



export async function listProductTagsFull(
  token: string,
  params: { q?: string; offset?: number; limit?: number } = {}
): Promise<{ tags: ProductTagFull[]; count: number }> {
  const qs = new URLSearchParams()
  if (params.q) qs.set("q", params.q)
  if (params.offset != null) qs.set("offset", String(params.offset))
  if (params.limit != null) qs.set("limit", String(params.limit))
  const s = qs.toString()
  return request<{ tags: ProductTagFull[]; count: number }>(
    `/merchant/product-tags${s ? `?${s}` : ""}`,
    { token }
  )
}



export async function createProductTag(
  token: string,
  body: { value: string }
): Promise<{ tag: ProductTagFull }> {
  return request<{ tag: ProductTagFull }>("/merchant/product-tags", {
    method: "POST",
    token,
    body,
  })
}



export async function updateProductTag(
  token: string,
  id: string,
  body: { value: string }
): Promise<{ tag: ProductTagFull }> {
  return request<{ tag: ProductTagFull }>(`/merchant/product-tags/${id}`, {
    method: "PUT",
    token,
    body,
  })
}



export async function deleteProductTag(
  token: string,
  id: string
): Promise<void> {
  return request<void>(`/merchant/product-tags/${id}`, {
    method: "DELETE",
    token,
  })
}

// -----------------------------
// Tenant currencies (tenant-meta backed; never mutates the global store)
// -----------------------------



export type TaxRateRuleRef = { reference: string; reference_id: string }



export type TaxRateDetail = {
  id: string
  name: string
  code?: string | null
  rate?: number | null
  is_default: boolean
  is_combinable: boolean
  rules: TaxRateRuleRef[]
}



export async function updateTaxRegionProvider(
  token: string,
  id: string,
  body: { provider_id?: string | null }
): Promise<{ id: string; object: string; updated: boolean }> {
  return request<{ id: string; object: string; updated: boolean }>(
    `/merchant/tax-regions/${id}`,
    { method: "PUT", token, body }
  )
}



export type CreateTaxRateInput = {
  name: string
  code?: string | null
  rate?: number | null
  is_default?: boolean
  is_combinable?: boolean
  rules?: TaxRateRuleRef[]
}



export async function createProvince(
  token: string,
  regionId: string,
  body: {
    province_code: string
    is_combinable?: boolean
    default_tax_rate?: { name: string; code?: string; rate?: number }
  }
): Promise<{ tax_region: { id: string; country_code: string; province_code: string | null; parent_id: string | null } }> {
  return request<{
    tax_region: {
      id: string
      country_code: string
      province_code: string | null
      parent_id: string | null
    }
  }>(`/merchant/tax-regions/${regionId}/provinces`, {
    method: "POST",
    token,
    body,
  })
}

export type CreateRefundReasonInput = {
  label: string
  code: string
  description?: string
}



export type UpdateRefundReasonInput = {
  label?: string
  code?: string
  description?: string | null
}



export type ProductTypeListItem = {
  id: string
  value: string
  products_count: number
}



export type ProductTagListItem = {
  id: string
  value: string
  products_count: number
}



// ===== Products list date filters addition 2026-07-12 =====

// ===== Products list: Created/Updated date filters (additive) =====
// Purely additive companion to the existing listProductsPaged: identical
// contract plus created_after/created_before/updated_after/updated_before
// pass-through. The existing ListProductsPagedParams type and
// listProductsPaged function in api.ts are left untouched, so all existing
// callers are unaffected. New callers that need date filtering use
// listProductsPagedWithDates below.

export type ListProductsPagedWithDatesParams = ListProductsPagedParams & {
  // ISO date bounds (YYYY-MM-DD or full ISO). The backend expands date-only
  // values to inclusive UTC day boundaries.
  created_after?: string
  created_before?: string
  updated_after?: string
  updated_before?: string
}

export async function listProductsPagedWithDates(
  token: string,
  params: ListProductsPagedWithDatesParams = {}
): Promise<{ products: ProductListItem[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.order) search.set("order", params.order)
  if (params.status?.length) search.set("status", params.status.join(","))
  if (params.type_id?.length) search.set("type_id", params.type_id.join(","))
  if (params.tag_id?.length) search.set("tag_id", params.tag_id.join(","))
  if (params.collection_id?.length) {
    search.set("collection_id", params.collection_id.join(","))
  }
  if (params.category_id?.length) {
    search.set("category_id", params.category_id.join(","))
  }
  if (params.created_after) search.set("created_after", params.created_after)
  if (params.created_before) search.set("created_before", params.created_before)
  if (params.updated_after) search.set("updated_after", params.updated_after)
  if (params.updated_before) search.set("updated_before", params.updated_before)
  const qs = search.toString()
  return request<{ products: ProductListItem[]; count: number }>(
    `/merchant/products${qs ? `?${qs}` : ""}`,
    { token }
  )
}
/* ------------------------------------------------------------------ inbox */
// The unified merchant inbox. Backend: /merchant/marketing/conversations
// (tenant-scoped, merchant-auth). The types below mirror the serializers in
// apps/backend/src/api/merchant/marketing/conversations/_dto.ts exactly — do
// not add fields the backend does not send.

export type InboxChannel =
  | "web_widget"
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "telegram"
  | "email"
  | "review"
  | "voice"

export type InboxStatus = "open" | "snoozed" | "closed"
export type InboxHandlerMode = "ai" | "queued" | "human"
export type InboxAuthor = "contact" | "agent" | "ai" | "system"

export type InboxContact = {
  id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  customer_id: string | null
}

export type InboxConversation = {
  id: string
  channel: InboxChannel | string
  status: InboxStatus | string
  handler_mode: InboxHandlerMode | string
  handoff_reason: string | null
  chatbot_id: string | null
  starred: boolean
  unread_count: number
  last_message_at: string | null
  assigned_user_id: string | null
  contact: InboxContact | null
  preview: string | null
}

export type InboxMessage = {
  id: string
  direction: string
  author: InboxAuthor | string
  body: string | null
  media: unknown
  sent_at: string | null
  delivery_status: string | null
}

export type InboxCustomer360Order = {
  id: string
  display_id: number | null
  total: number
  currency_code: string | null
  status: string | null
  created_at: string | null
}

export type InboxCustomer360 = {
  matched: boolean
  customer: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    has_account: boolean
  } | null
  order_count: number
  total_spent: number
  currency_code: string | null
  recent_orders: InboxCustomer360Order[]
}

export type InboxNote = {
  id: string
  conversation_id: string
  author_id: string
  content: string
  created_at: string | null
}

export type CannedResponse = {
  id: string
  shortcut: string
  title: string
  content: string
  category: string | null
  created_at: string | null
  updated_at: string | null
}

export type ListInboxConversationsParams = {
  status?: string
  /** Drop closed threads — what every working view wants. */
  excludeClosed?: boolean
  channel?: string
  handlerMode?: string
  /** "me" = assigned to the signed-in agent, "none" = nobody has claimed it. */
  assigned?: "me" | "none"
  starred?: boolean
  unread?: boolean
  q?: string
  limit?: number
  offset?: number
}

/**
 * Exact badge counts for the inbox rail, over the tenant's WHOLE inbox — never
 * derived from the page of conversations the list happens to hold.
 */
export type InboxCounts = {
  views: {
    needs_you: number
    unassigned: number
    mine: number
    starred: number
    open: number
    closed: number
    all: number
    unread: number
  }
  channels: Record<string, number>
}

export async function getInboxCounts(token: string): Promise<InboxCounts> {
  return request<InboxCounts>("/merchant/marketing/conversations/counts", {
    token,
  })
}

export async function listInboxConversations(
  token: string,
  params: ListInboxConversationsParams = {}
): Promise<{ conversations: InboxConversation[]; count: number }> {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  else if (params.excludeClosed) search.set("exclude_closed", "true")
  if (params.channel) search.set("channel", params.channel)
  if (params.handlerMode) search.set("handler_mode", params.handlerMode)
  if (params.assigned) search.set("assigned", params.assigned)
  if (params.starred) search.set("starred", "true")
  if (params.unread) search.set("unread", "true")
  if (params.q) search.set("q", params.q)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  const qs = search.toString()
  return request<{ conversations: InboxConversation[]; count: number }>(
    `/merchant/marketing/conversations${qs ? `?${qs}` : ""}`,
    { token }
  )
}

export async function getInboxConversation(
  token: string,
  id: string
): Promise<{
  conversation: InboxConversation
  messages: InboxMessage[]
  customer360: InboxCustomer360
}> {
  return request(`/merchant/marketing/conversations/${id}`, { token })
}

// The backend records the reply on the thread even when the external channel
// send fails; `delivered` reports the external outcome.
export async function replyToInboxConversation(
  token: string,
  id: string,
  text: string
): Promise<{ message: InboxMessage; delivered: boolean }> {
  return request<{ message: InboxMessage; delivered: boolean }>(
    `/merchant/marketing/conversations/${id}/reply`,
    { token, method: "POST", body: { text } }
  )
}

// Drafts a reply — never sends it. `needs_ai` means no AI provider is set up.
// Throws ApiError 402 when the store is out of AI credits.
export async function suggestInboxReply(
  token: string,
  id: string
): Promise<{ suggestion: string; needs_ai: boolean }> {
  return request<{ suggestion: string; needs_ai: boolean }>(
    `/merchant/marketing/conversations/${id}/suggest`,
    { token, method: "POST", body: {} }
  )
}

// Throws ApiError 409 when another agent already holds the conversation.
export async function takeOverInboxConversation(
  token: string,
  id: string
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/take-over`,
    { token, method: "POST", body: {} }
  )
}

// Throws ApiError 403 when the thread is assigned to another agent.
export async function returnInboxConversationToAi(
  token: string,
  id: string
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/return-to-ai`,
    { token, method: "POST", body: {} }
  )
}

export async function assignInboxConversation(
  token: string,
  id: string,
  assignedUserId: string | null
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/assign`,
    { token, method: "POST", body: { assigned_user_id: assignedUserId } }
  )
}

export async function setInboxConversationStatus(
  token: string,
  id: string,
  status: InboxStatus
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/status`,
    { token, method: "POST", body: { status } }
  )
}

// Omit `starred` to toggle the current value.
export async function starInboxConversation(
  token: string,
  id: string,
  starred?: boolean
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/star`,
    {
      token,
      method: "POST",
      body: starred === undefined ? {} : { starred },
    }
  )
}

export async function markInboxConversationRead(
  token: string,
  id: string
): Promise<{ conversation: InboxConversation }> {
  return request<{ conversation: InboxConversation }>(
    `/merchant/marketing/conversations/${id}/read`,
    { token, method: "POST", body: {} }
  )
}

export async function listInboxNotes(
  token: string,
  id: string
): Promise<{ notes: InboxNote[]; count: number }> {
  return request<{ notes: InboxNote[]; count: number }>(
    `/merchant/marketing/conversations/${id}/notes`,
    { token }
  )
}

export async function createInboxNote(
  token: string,
  id: string,
  content: string
): Promise<{ note: InboxNote }> {
  return request<{ note: InboxNote }>(
    `/merchant/marketing/conversations/${id}/notes`,
    { token, method: "POST", body: { content } }
  )
}

export async function listCannedResponses(
  token: string,
  params: { q?: string; category?: string } = {}
): Promise<{ canned_responses: CannedResponse[]; count: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.category) search.set("category", params.category)
  const qs = search.toString()
  return request<{ canned_responses: CannedResponse[]; count: number }>(
    `/merchant/marketing/conversations/canned-responses${qs ? `?${qs}` : ""}`,
    { token }
  )
}

// ---------------------------------------------------------------------------
// Marketing — autonomous agents, brand voices, posting schedules
// Backend: /merchant/marketing/{agents,brand-voices,schedules} (tenant-scoped)
//
// The PLAYBOOK is the agent's whole cadence/behaviour contract and is defined,
// documented and validated by
// apps/backend/src/modules/marketing/agents/playbook.ts. Keep the types below in
// step with it: the API REJECTS unknown playbook keys, so anything that is not
// listed there (a business description, an audience note) must live on the
// agent's `instructions` instead.
//
// CAPABILITY GATE: a platform whose publish adapter requires media (instagram)
// cannot carry an agent post, because agent-generated posts are text-only. The
// API rejects such a platform with a 400. GET /agents returns the authoritative
// `supported_platforms` list, so the UI offers exactly those.
// ---------------------------------------------------------------------------

export type AgentSlotDay =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"
  | "daily"

/** One cadence slot. `time` is 24h "HH:MM" wall-clock in the cadence timezone. */
export type AgentSlot = {
  day: AgentSlotDay
  time: string
  platforms?: string[]
}

export type AgentCadence = {
  timezone: string
  slots: AgentSlot[]
}

/** approval -> generated posts land in the review queue; auto -> they publish. */
export type AgentMode = "approval" | "auto"

export type AgentPostType =
  | "promo"
  | "educational"
  | "story"
  | "tip"
  | "announcement"
  | "question"
  | "ugc"
  | "behind_the_scenes"
  | "product_spotlight"
  | "seasonal"

export type AgentLength = "short" | "medium" | "long"

/** Server-owned observability state. Never sent by the client. */
export type AgentRuntime = {
  last_run_at?: string
  last_generated_at?: string
  last_post_id?: string
  last_error?: string | null
  last_error_at?: string | null
  generated_count?: number
  skipped_reason?: string | null
}

export type AgentPlaybook = {
  platforms: string[]
  mode: AgentMode
  schedule_id?: string
  cadence?: AgentCadence
  topics?: string[]
  post_types?: string[]
  tone?: string
  creativity?: number
  hashtag_count?: number
  cta_templates?: string[]
  goals?: string[]
  length?: AgentLength
  daily_post_count?: number
  campaign_id?: string
  product_ids?: string[]
  _runtime?: AgentRuntime
}

export type MarketingAgent = {
  id: string
  tenant_id: string
  name: string
  kind: "content" | "social" | string
  instructions: string | null
  model: string | null
  brand_voice_id: string | null
  playbook: AgentPlaybook | null
  tools?: unknown[] | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CreateMarketingAgentInput = {
  name: string
  kind?: "content" | "social"
  instructions?: string | null
  model?: string | null
  brand_voice_id?: string | null
  active?: boolean
  playbook: AgentPlaybook
}

export type UpdateMarketingAgentInput = {
  name?: string
  kind?: "content" | "social"
  instructions?: string | null
  model?: string | null
  brand_voice_id?: string | null
  active?: boolean
  playbook?: AgentPlaybook
}

export type ListMarketingAgentsResponse = {
  agents: MarketingAgent[]
  count: number
  limit: number
  offset: number
  /** The only platforms an agent may target (the capability gate). */
  supported_platforms: string[]
}

export type GenerateAgentPostsResponse = {
  posts: MarketingPost[]
  count: number
  needs_ai: boolean
}

/**
 * `tone` is a json column: this UI writes a plain string, but a row written by
 * another surface may hold a list, so read defensively.
 */
export type MarketingBrandVoice = {
  id: string
  tenant_id: string
  name: string
  tone: string | string[] | null
  do_rules: string[] | null
  dont_rules: string[] | null
  sample_copy: string | null
  language: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export type BrandVoiceInput = {
  name: string
  tone?: string | null
  do_rules?: string[] | null
  dont_rules?: string[] | null
  sample_copy?: string | null
  language?: string
  is_default?: boolean
}

export type MarketingSchedule = {
  id: string
  tenant_id: string
  name: string
  timezone: string
  slots: AgentSlot[] | null
  platform_filter: string[] | null
  active: boolean
  created_at: string
  updated_at: string
}

export type MarketingScheduleInput = {
  name: string
  timezone?: string
  slots: AgentSlot[]
  platform_filter?: string[] | null
  active?: boolean
}

export async function listMarketingAgents(
  token: string,
  params?: { kind?: string; active?: boolean; limit?: number; offset?: number }
): Promise<ListMarketingAgentsResponse> {
  const qs = new URLSearchParams()
  if (params?.kind) qs.set("kind", params.kind)
  if (params?.active !== undefined) qs.set("active", String(params.active))
  if (params?.limit !== undefined) qs.set("limit", String(params.limit))
  if (params?.offset !== undefined) qs.set("offset", String(params.offset))
  return request<ListMarketingAgentsResponse>(
    "/merchant/marketing/agents" + (qs.toString() ? "?" + qs.toString() : ""),
    { token }
  )
}

export async function getMarketingAgent(
  token: string,
  id: string
): Promise<{ agent: MarketingAgent }> {
  return request<{ agent: MarketingAgent }>(
    `/merchant/marketing/agents/${id}`,
    { token }
  )
}

export async function createMarketingAgent(
  token: string,
  body: CreateMarketingAgentInput
): Promise<{ agent: MarketingAgent }> {
  return request<{ agent: MarketingAgent }>("/merchant/marketing/agents", {
    method: "POST",
    token,
    body,
  })
}

export async function updateMarketingAgent(
  token: string,
  id: string,
  body: UpdateMarketingAgentInput
): Promise<{ agent: MarketingAgent }> {
  return request<{ agent: MarketingAgent }>(
    `/merchant/marketing/agents/${id}`,
    { method: "PUT", token, body }
  )
}

export async function deleteMarketingAgent(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/agents/${id}`,
    { method: "DELETE", token }
  )
}

/**
 * "Generate now" / "Generate batch". Runs the agent's generation on demand with
 * the same prompt and placement the cadence uses. A 402 means the tenant is out
 * of AI credits; ApiError.status carries it.
 */
export async function generateAgentPosts(
  token: string,
  id: string,
  body?: { count?: number; platform?: string }
): Promise<GenerateAgentPostsResponse> {
  return request<GenerateAgentPostsResponse>(
    `/merchant/marketing/agents/${id}/generate`,
    { method: "POST", token, body: body ?? {} }
  )
}

export async function listBrandVoices(
  token: string,
  params?: { limit?: number; offset?: number }
): Promise<{
  brand_voices: MarketingBrandVoice[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set("limit", String(params.limit))
  if (params?.offset !== undefined) qs.set("offset", String(params.offset))
  return request<{
    brand_voices: MarketingBrandVoice[]
    count: number
    limit: number
    offset: number
  }>(
    "/merchant/marketing/brand-voices" +
      (qs.toString() ? "?" + qs.toString() : ""),
    { token }
  )
}

export async function createBrandVoice(
  token: string,
  body: BrandVoiceInput
): Promise<{ brand_voice: MarketingBrandVoice }> {
  return request<{ brand_voice: MarketingBrandVoice }>(
    "/merchant/marketing/brand-voices",
    { method: "POST", token, body }
  )
}

export async function updateBrandVoice(
  token: string,
  id: string,
  body: Partial<BrandVoiceInput>
): Promise<{ brand_voice: MarketingBrandVoice }> {
  return request<{ brand_voice: MarketingBrandVoice }>(
    `/merchant/marketing/brand-voices/${id}`,
    { method: "PUT", token, body }
  )
}

export async function deleteBrandVoice(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/brand-voices/${id}`,
    { method: "DELETE", token }
  )
}

export async function listMarketingSchedules(
  token: string,
  params?: { active?: boolean; limit?: number; offset?: number }
): Promise<{
  schedules: MarketingSchedule[]
  count: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.active !== undefined) qs.set("active", String(params.active))
  if (params?.limit !== undefined) qs.set("limit", String(params.limit))
  if (params?.offset !== undefined) qs.set("offset", String(params.offset))
  return request<{
    schedules: MarketingSchedule[]
    count: number
    limit: number
    offset: number
  }>(
    "/merchant/marketing/schedules" + (qs.toString() ? "?" + qs.toString() : ""),
    { token }
  )
}

export async function createMarketingSchedule(
  token: string,
  body: MarketingScheduleInput
): Promise<{ schedule: MarketingSchedule }> {
  return request<{ schedule: MarketingSchedule }>(
    "/merchant/marketing/schedules",
    { method: "POST", token, body }
  )
}

export async function updateMarketingSchedule(
  token: string,
  id: string,
  body: Partial<MarketingScheduleInput>
): Promise<{ schedule: MarketingSchedule }> {
  return request<{ schedule: MarketingSchedule }>(
    `/merchant/marketing/schedules/${id}`,
    { method: "PUT", token, body }
  )
}

export async function deleteMarketingSchedule(
  token: string,
  id: string
): Promise<{ id: string; object: string; deleted: boolean }> {
  return request<{ id: string; object: string; deleted: boolean }>(
    `/merchant/marketing/schedules/${id}`,
    { method: "DELETE", token }
  )
}
