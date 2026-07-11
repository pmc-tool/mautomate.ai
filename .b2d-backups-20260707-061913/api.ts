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
  return getCookie("_tenant_backend") || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
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
}

export type CreditsResponse = {
  tenant_id: string
  balance: number
  trial_ends_at: string | null
  transactions: {
    id: string
    type: string
    amount: number
    description: string
    created_at: string
  }[]
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
    const text = await res.text().catch(() => "Request failed")
    throw new ApiError(text || `Request failed (${res.status})`, res.status)
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

export async function getCredits(token: string): Promise<CreditsResponse> {
  return request<CreditsResponse>("/merchant/credits", { token })
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
  type_id?: string
  sales_channel_ids?: string[]
  options?: { title: string; values: string[] }[]
  variants?: {
    title: string
    sku?: string
    prices?: { amount: number; currency_code: string }[]
    inventory_quantity?: number
    allow_backorder?: boolean
    options?: Record<string, string>
  }[]
}

export type UpdateProductInput = Partial<CreateProductInput>

export async function getProduct(
  token: string,
  id: string
): Promise<{ product: ProductDetail }> {
  return request<{ product: ProductDetail }>(`/merchant/products/${id}`, { token })
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
    const text = await res.text().catch(() => "Image upload failed")
    throw new ApiError(text || `Image upload failed (${res.status})`, res.status)
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
  // Placeholder: wire to /merchant/product-categories when backend is ready
  await new Promise((r) => setTimeout(r, 400))
  return {
    categories: [
      {
        id: "cat_1",
        name: "Clothing",
        handle: "clothing",
        description: "Apparel and accessories",
        status: "active",
        visibility: "public",
      },
      {
        id: "cat_2",
        name: "Electronics",
        handle: "electronics",
        description: "Gadgets and devices",
        status: "active",
        visibility: "public",
      },
      {
        id: "cat_3",
        name: "Internal Notes",
        handle: "internal-notes",
        description: "Back-office only",
        status: "inactive",
        visibility: "internal",
      },
    ],
    count: 3,
  }
}

export async function createCategory(
  token: string,
  body: CreateCategoryInput
): Promise<{ category: ProductCategory }> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    category: {
      id: `cat_${Date.now()}`,
      name: body.name,
      handle: body.handle || slugify(body.name),
      description: body.description ?? null,
      status: body.status ?? "active",
      visibility: body.visibility ?? "public",
      parent: body.parent_id
        ? {
            id: body.parent_id,
            name: "Parent",
            handle: "parent",
            status: "active",
            visibility: "public",
          }
        : null,
    },
  }
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
  orders?: Order[]
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
  await new Promise((r) => setTimeout(r, 400))
  return {
    customer: {
      id,
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Morgan",
      phone: "+1 555 0199",
      created_at: new Date().toISOString(),
      status: "active",
      shipping_addresses: [
        {
          id: "addr_1",
          first_name: "Alex",
          last_name: "Morgan",
          address_1: "123 Market St",
          address_2: "Apt 4B",
          city: "San Francisco",
          province: "CA",
          postal_code: "94105",
          country_code: "us",
          phone: "+1 555 0199",
        },
      ],
      billing_addresses: [
        {
          id: "addr_2",
          first_name: "Alex",
          last_name: "Morgan",
          address_1: "123 Market St",
          address_2: "Apt 4B",
          city: "San Francisco",
          province: "CA",
          postal_code: "94105",
          country_code: "us",
          phone: "+1 555 0199",
        },
      ],
      orders: [
        {
          id: "ord_1",
          display_id: 1001,
          status: "completed",
          payment_status: "captured",
          fulfillment_status: "fulfilled",
          created_at: new Date().toISOString(),
          total: 12900,
          currency_code: "USD",
          customer_name: "Alex Morgan",
        },
        {
          id: "ord_2",
          display_id: 1005,
          status: "pending",
          payment_status: "awaiting",
          fulfillment_status: "not_fulfilled",
          created_at: new Date().toISOString(),
          total: 5600,
          currency_code: "USD",
          customer_name: "Alex Morgan",
        },
      ],
    },
  }
}

export async function listCustomerGroups(
  token: string
): Promise<{ groups: CustomerGroup[]; count: number }> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    groups: [
      { id: "cg_1", name: "VIP", customer_count: 12 },
      { id: "cg_2", name: "Newsletter subscribers", customer_count: 145 },
      { id: "cg_3", name: "Wholesale", customer_count: 6 },
    ],
    count: 3,
  }
}

export async function createCustomerGroup(
  token: string,
  body: CreateCustomerGroupInput
): Promise<{ group: CustomerGroup }> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    group: {
      id: `cg_${Date.now()}`,
      name: body.name,
      customer_count: 0,
    },
  }
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
export async function listRegionCountries(token: string): Promise<RegionCountry[]> {
  await new Promise((r) => setTimeout(r, 200))
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

export async function listCurrencies(_token: string): Promise<{ currencies: Currency[] }> {
  await new Promise((r) => setTimeout(r, 200))
  return {
    currencies: [
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "EUR", name: "Euro", symbol: "€" },
      { code: "GBP", name: "British Pound", symbol: "£" },
      { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
    ],
  }
}

export async function listPaymentProviders(
  token: string
): Promise<{ providers: PaymentProvider[] }> {
  await new Promise((r) => setTimeout(r, 200))
  return {
    providers: [
      { id: "stripe", name: "Stripe" },
      { id: "paypal", name: "PayPal" },
      { id: "manual", name: "Manual" },
    ],
  }
}

export async function listFulfillmentProviders(
  token: string
): Promise<{ providers: FulfillmentProvider[] }> {
  await new Promise((r) => setTimeout(r, 200))
  return {
    providers: [
      { id: "manual", name: "Manual" },
      { id: "shipstation", name: "ShipStation" },
    ],
  }
}

export async function createRegion(
  token: string,
  body: CreateRegionInput
): Promise<{ region: Region }> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    region: {
      id: `reg_${Date.now()}`,
      name: body.name,
      currency_code: body.currency_code,
      countries: body.countries.map((c) => ({ iso_2: c, display_name: c.toUpperCase(), name: c.toUpperCase() })),
      payment_providers: body.payment_providers.map((id) => ({ id, name: id })),
      fulfillment_providers: body.fulfillment_providers.map((id) => ({ id, name: id })),
    },
  }
}

export type StoreSettings = {
  id: string
  name: string
  default_currency_code: string
  default_locale: string
  supported_currencies: { code: string; name: string; symbol: string; enabled: boolean }[]
}

export async function getStoreSettings(token: string): Promise<{ store: StoreSettings }> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    store: {
      id: "store_1",
      name: "Brand2Door Store",
      default_currency_code: "USD",
      default_locale: "en-US",
      supported_currencies: [
        { code: "USD", name: "United States Dollar", symbol: "$", enabled: true },
        { code: "EUR", name: "Euro", symbol: "€", enabled: true },
        { code: "GBP", name: "British Pound", symbol: "£", enabled: false },
        { code: "CAD", name: "Canadian Dollar", symbol: "C$", enabled: false },
      ],
    },
  }
}

export async function updateStoreSettings(
  token: string,
  body: Partial<StoreSettings>
): Promise<{ store: StoreSettings }> {
  await new Promise((r) => setTimeout(r, 400))
  const current = await getStoreSettings(token)
  return {
    store: {
      ...current.store,
      ...body,
      supported_currencies: body.supported_currencies ?? current.store.supported_currencies,
    },
  }
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
}

export type OrderItem = {
  id: string
  title: string
  product_title?: string | null
  variant_title?: string | null
  quantity: number
  unit_price: number
  total: number
  thumbnail?: string | null
  metadata?: Record<string, any> | null
}

export type OrderPayment = {
  id: string
  amount: number
  captured_at?: string | null
  captures: { id: string; amount: number }[]
}

export type OrderFulfillment = {
  id: string
  created_at: string
  shipped_at?: string | null
  delivered_at?: string | null
  canceled_at?: string | null
  labels: { tracking_number?: string; tracking_url?: string }[]
}

export type OrderDetail = {
  id: string
  display_id: number
  status: string
  payment_status: string
  fulfillment_status: string
  email?: string
  currency_code: string
  total: number
  subtotal: number
  shipping_total: number
  tax_total: number
  discount_total: number
  created_at: string
  customer: OrderCustomer | null
  shipping_address: OrderAddress | null
  billing_address: OrderAddress | null
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

export type MarketingPost = {
  id: string
  tenant_id: string
  status: string
  title: string | null
  body: string | null
  source: string
  created_at: string
  updated_at: string
}

export type MarketingJourney = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  trigger_event: string
  status: string
  created_at: string
  updated_at: string
}

export type CreateMarketingJourneyInput = {
  name: string
  description?: string
  trigger_event: string
  status?: string
}

export type MarketingCampaign = {
  id: string
  tenant_id: string
  name: string
  objective: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export type MarketingEmailTemplate = {
  id: string
  tenant_id: string
  name: string
  subject: string | null
  kind: string
  from_name: string | null
  from_email: string | null
  created_at: string
  updated_at: string
}

export type MarketingChatbot = {
  id: string
  tenant_id: string
  name: string
  greeting: string | null
  reply_mode: string
  active: boolean
  public_key: string | null
  created_at: string
  updated_at: string
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

export type DnsInstruction = {
  type: string
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

export async function listDomains(token: string): Promise<{ domains: Domain[] }> {
  return request<{ domains: Domain[] }>("/merchant/domains", { token })
}

export async function connectDomain(
  token: string,
  domain: string
): Promise<{ domain_id: string; domain: string; instructions: DnsInstruction[]; message: string }> {
  return request<{ domain_id: string; domain: string; instructions: DnsInstruction[]; message: string }>("/merchant/domains", {
    method: "POST",
    token,
    body: { domain },
  })
}

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
// Domain purchase
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
  domain: Domain
  order?: unknown
  manual_approval: boolean
  instructions: DnsInstruction[]
  note?: string
}

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
