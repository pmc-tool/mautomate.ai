# Shopper App — Store Catalog / Cart API contract (Wave 1)

How the native shopper app talks to the commerce backend. The **CMS block tree**
(page layout) comes from `GET /store/cms/app/pages/:slug` (see
`SHOPPER_BLOCK_CATALOG.md`); the **live catalog + cart + customer** data comes
from Medusa's standard Store API, documented here.

- **Base URL:** the store's API origin — in production `https://api.mautomate.ai`
  (VM-internal: `http://127.0.0.1:9500`). All paths below are relative to it.
- **Backend:** Medusa v2, pooled multi-tenant. One shared backend serves every
  store; isolation is per **sales channel** (see below).

---

## 1. Per-tenant scoping via the publishable API key  ← the critical piece

Every store request MUST send the store's **publishable API key**:

```
x-publishable-api-key: pk_xxxxxxxx…
```

This single header does two jobs:

1. **CMS tenant resolution.** `cmsTenantId(req)` maps the pak → its owning
   `tenant` (`platform.listTenants({ publishable_key })`) so `/store/cms/*`
   returns THIS store's pages/settings and nothing else. (Fallbacks
   `x-tenant-pak` / `x-tenant-id` exist for the storefront proxy; the app should
   just send the pak.)

2. **Catalog sales-channel scoping.** Medusa links the publishable key to exactly
   one **sales channel**; `/store/products` (and other catalog endpoints)
   automatically filter to that channel's products. A store only ever sees its
   own catalog.

Verified mapping (real store "Dear Wish"):

```
pk_b09e956577…  (token on api_key)
   └─ api_key apk_01KX1CTX2VCN4KWVBB443VYA24  "dhaka-bangladesh storefront"
        └─ publishable_api_key_sales_channel link
             └─ sales_channel sc_01KX1CTX208Z64WZ3PP6J7RZDE  "Dear Wish Store"
```

**The app never sends a tenant id or sales-channel id.** It holds only the
store's publishable key; the backend derives tenant + sales channel from it
server-side. Each store's app build (or per-store config) is provisioned with its
own pak. Fail-closed: a missing/invalid pak is rejected by Medusa's store
middleware (400/401) before any handler runs; an unresolved CMS tenant 404s.

Where to get a store's pak: `tenant.publishable_key` (control-plane), or the
`GET /tenant-config` route which resolves a store from its Host and returns its
public config.

### Region + currency (pricing)

Pooled backend ⇒ `/store/regions` returns EVERY tenant's region, so the app can't
pick currency by country alone. Each tenant pins its region:

- `GET /tenant-config` returns `region_id` and `currency_code` for the store
  (from `tenant.meta.region_id` / `tenant.meta.currency_code`). Example (Dear
  Wish): `region_id = reg_01KX5PMDF7BD6130ZTPNWZS2KX`, `currency_code = usd`.
- Pass `region_id` to price-aware catalog calls so variant prices come back in
  the store's currency: `GET /store/products?region_id=…`.

---

## 2. Catalog

All catalog calls require the `x-publishable-api-key` header. Add
`region_id=<store region>` whenever you need prices.

### Products
- **List:** `GET /store/products`
  - Common query: `limit`, `offset`, `q` (search), `order` (`created_at` /
    `-created_at` / `variants.calculated_price` …), `region_id`,
    `fields` (e.g. `*variants.calculated_price,*images,*categories`).
  - Filter by binding (used by the `product_tabs` block):
    `category_id[]=…`, `collection_id[]=…`, `id[]=…` (manual list — preserve
    order client-side), `tag_id[]=…`.
- **Detail:** `GET /store/products/:id` (or `?handle=…` on the list route).
  - Request `fields=*variants.calculated_price,*variants.options,*images,*options,*categories`
    to get prices, variants, option matrix, and gallery in one call.
- Prices live on `variant.calculated_price` (needs `region_id`).

### Categories
- `GET /store/product-categories` — list (supports `parent_category_id`,
  `include_descendants_tree`, `fields`, `limit`).
- `GET /store/product-categories/:id` — detail.
- Used to expand the header `__dynamic_categories__` menu sentinel and to resolve
  `category_showcase` / `product_tabs` category bindings.

### Collections
- `GET /store/collections` — list.
- `GET /store/collections/:id` — detail.
- Resolves `product_tabs` `collection` bindings.

---

## 3. Cart

Standard Medusa cart flow. The cart is tied to the sales channel derived from the
pak, and to a `region_id`.

- **Create:** `POST /store/carts`  body `{ region_id, items?: [{ variant_id, quantity }], … }`
- **Get:** `GET /store/carts/:id`
- **Update:** `POST /store/carts/:id`  (`email`, `shipping_address`, `billing_address`, `region_id`, `promo_codes`)
- **Line items:**
  - add `POST /store/carts/:id/line-items` `{ variant_id, quantity }`
  - update `POST /store/carts/:id/line-items/:line_id` `{ quantity }`
  - remove `DELETE /store/carts/:id/line-items/:line_id`
- **Shipping / payment (checkout, later phases):**
  - `GET /store/shipping-options?cart_id=…`
  - `POST /store/carts/:id/shipping-methods` `{ option_id }`
  - `POST /store/payment-collections` + `POST /store/payment-collections/:id/payment-sessions`
  - **Complete:** `POST /store/carts/:id/complete` → returns the `order`.

Persist the `cart.id` locally (per store) to resume the cart across launches.

---

## 4. Customer auth (for account / order-history phases)

Medusa v2 auth. Two steps: get a token from the auth module, then use it as a
Bearer token on `/store/customers/*`.

- **Register:** `POST /auth/customer/emailpass/register` `{ email, password }` → `{ token }`
  then `POST /store/customers` `{ email, first_name, last_name }` with
  `Authorization: Bearer <token>` to create the customer profile.
- **Login:** `POST /auth/customer/emailpass` `{ email, password }` → `{ token }`.
- **Authenticated calls:** send BOTH headers:
  - `Authorization: Bearer <token>`
  - `x-publishable-api-key: pk_…`  (still required on every /store call)
- **Me:** `GET /store/customers/me`
- **Orders:** `GET /store/orders`, `GET /store/orders/:id`
- **Associate cart with customer:** update the cart with the customer's `email`
  (and be authenticated) before `complete`.

> Google/social login and password reset are later phases; emailpass is the Wave
> baseline.

---

## 5. Request header cheat-sheet

| Call type | Headers |
|-----------|---------|
| CMS page / settings | `x-publishable-api-key` |
| Catalog (list/detail) | `x-publishable-api-key` (+ `region_id` query for prices) |
| Cart | `x-publishable-api-key` |
| Customer-scoped | `x-publishable-api-key` + `Authorization: Bearer <token>` |
| Locale (CMS, optional) | `x-medusa-locale: bn` **or** `?lang=bn` (Medusa strips `?locale=`) |

## 6. Endpoint index

| Purpose | Method + path |
|---------|---------------|
| **App page (block tree + tokens + branding)** | `GET /store/cms/app/pages/:slug` |
| CMS page (web, `{page}` only) | `GET /store/cms/pages/:slug` |
| CMS global settings/chrome | `GET /store/cms/settings` |
| Store public config (region, currency, logo) | `GET /tenant-config` |
| Product list / detail | `GET /store/products` · `GET /store/products/:id` |
| Categories | `GET /store/product-categories[/:id]` |
| Collections | `GET /store/collections[/:id]` |
| Cart | `POST /store/carts` · `GET|POST /store/carts/:id` · line-items |
| Complete order | `POST /store/carts/:id/complete` |
| Customer login / register | `POST /auth/customer/emailpass[/register]` |
| Customer profile / orders | `GET /store/customers/me` · `GET /store/orders` |
