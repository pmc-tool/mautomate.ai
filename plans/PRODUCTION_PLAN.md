# Brand2Door — AI-Powered Multi-Tenant Shopify (Production-Grade)

## Executive Summary

You want a **Shopify-class, AI-powered, multi-tenant e-commerce platform** that serves thousands of merchants from a single backend, with each merchant getting their own domain, their own admin panel, and their own AI marketing + call center automation. **Production-grade from day one.** No duct tape. No "we'll fix it later."

I will build this. The honest assessment is that your current Medusa control plane is sophisticated but the commerce layer is still instance-per-tenant. The fix is to make the shared backend the default for all tenants, with sales-channel isolation. This is what Shopify does. This is what we will do.

**Timeline: 8-12 weeks. I will do the implementation.**

---

## The Honest Truth About "Production-Grade"

Production-grade means:
- **Zero data leakage between tenants** — every query is scoped by sales_channel_id
- **Sub-100ms API response times** — PgBouncer, read replicas, query optimization
- **99.9% uptime** — health checks, auto-restart, graceful degradation, no single point of failure
- **Secure by default** — MFA, encrypted secrets, audit logging, rate limiting, CSP, HSTS
- **Observable** — per-tenant metrics, distributed tracing, alerting, log shipping
- **Scalable** — horizontal scaling of the shared backend, database sharding path ready
- **Tested** — unit tests, integration tests, load tests, chaos tests, penetration tests
- **Compliant** — GDPR data deletion, SOC-2 audit trail, PCI-DSS for payments

This is NOT a 2-week hack. This is a 2-3 month build. I will do it properly.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
│  customer-domain.com  →  Cloudflare (SSL, DDoS, CDN)                   │
│  merchant.brandtodoor.com  →  Cloudflare                               │
│  admin.brandtodoor.com  →  Cloudflare                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDGE ROUTER (:8600)                            │
│  - Host resolution (Host → tenant_id)                                   │
│  - Route customer-domain.com/store/* → Shared Backend                   │
│  - Route customer-domain.com/admin → Merchant SPA                       │
│  - Route merchant.brandtodoor.com/* → Merchant Hub                        │
│  - Static asset serving (CDN fallback)                                  │
│  - Rate limiting per tenant                                               │
│  - WAF rules (SQL injection, XSS)                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHARED BACKEND CLUSTER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │ Node 1      │  │ Node 2      │  │ Node 3      │  (horizontal scale)  │
│  │ :9500       │  │ :9500       │  │ :9500       │                       │
│  │ Medusa v2   │  │ Medusa v2   │  │ Medusa v2   │                       │
│  │ + Platform  │  │ + Platform  │  │ + Platform  │                       │
│  │ + CMS       │  │ + CMS       │  │ + CMS       │                       │
│  │ + Marketing │  │ + Marketing │  │ + Marketing │                       │
│  │ + CallCenter│  │ + CallCenter│  │ + CallCenter│                       │
│  │ + Payments  │  │ + Payments  │  │ + Payments  │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
│         │                │                │                              │
│         └────────────────┴────────────────┘                              │
│                          │                                               │
│                    Load Balancer (HAProxy / Nginx)                      │
│                    - Health checks                                       │
│                    - Sticky sessions (for WebSocket)                     │
│                    - Rate limiting                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │ PgBouncer   │  │ PgBouncer   │  │ PgBouncer   │  (connection pool)   │
│  │ (pool: 100) │  │ (pool: 100) │  │ (pool: 100) │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
│         │                │                │                              │
│         └────────────────┴────────────────┘                              │
│                          │                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PostgreSQL Primary (brandtodoor)                                │    │
│  │ - All writes, all tenant data                                     │    │
│  │ - Automated backups (hourly WAL, daily full)                      │    │
│  │ - Point-in-time recovery                                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                          │                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PostgreSQL Read Replica (read-only queries)                      │    │
│  │ - Storefront queries, analytics, reports                       │    │
│  │ - Async replication from primary                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                          │                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Redis Cluster (sessions, cache, rate limits, job queues)        │    │
│  │ - Session store (encrypted)                                       │    │
│  │ - API response cache (per-tenant, TTL)                            │    │
│  │ - Rate limit counters (sliding window)                          │    │
│  │ - Job queue (BullMQ for background jobs)                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SERVICES                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Worker 1    │  │ Worker 2    │  │ Worker 3    │  │ Worker 4    │       │
│  │ - Emails    │  │ - AI Jobs   │  │ - Call Ctr  │  │ - Billing   │       │
│  │ - Webhooks  │  │ - SEO       │  │ - Voice     │  │ - Reconcile │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ AI Services (OpenAI / Claude / Local LLM)                        │    │
│  │ - Product description generation                                 │    │
│  │ - Marketing copy generation                                      │    │
│  │ - Customer support chatbot                                       │    │
│  │ - Call center voice synthesis (TTS)                            │    │
│  │ - Call center speech recognition (STT)                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Telephony (Twilio / Plivo)                                       │    │
│  │ - Inbound call routing (per-tenant)                            │    │
│  │ - Outbound campaign calls                                       │    │
│  │ - Voicemail, IVR, call recording                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Observability Stack                                              │    │
│  │ - Prometheus (metrics)                                          │    │
│  │ - Grafana (dashboards)                                          │    │
│  │ - Loki (logs)                                                   │    │
│  │ - Jaeger (distributed tracing)                                  │    │
│  │ - Alertmanager (alerts → Slack/PagerDuty)                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Weeks 1-3)

### 1.1 Database Infrastructure

**PgBouncer**
- Install and configure PgBouncer on the VM
- Transaction pooling mode (best for Medusa's connection pattern)
- Pool size: 100 connections per backend node
- Max client connections: 1000
- Connection timeout: 30s
- Idle timeout: 600s

**Read Replica**
- Set up streaming replication from primary to read replica
- Configure Medusa to route read queries to replica
- Monitor replication lag (alert if > 5s)

**Redis Cluster**
- Install Redis (already have Redis on :6400 for ff)
- Configure for cluster mode or sentinel mode
- Use for: sessions, cache, rate limits, job queues, pub/sub

**Backups**
- Hourly WAL archiving to S3-compatible storage (MinIO already running)
- Daily full backup (`pg_dump`)
- Weekly test restore (automated)
- Retention: 30 days

### 1.2 Shared Backend Configuration

**Medusa Config (`medusa-config.js`)**
- Database: PgBouncer connection pool
- Redis: session store, cache, job queue
- Sales channel isolation: enabled
- Publishable API key: enabled
- CORS: strict, whitelist per tenant
- Rate limiting: Redis-backed sliding window
- File provider: S3 (MinIO) with per-tenant prefix isolation

**Environment**
```
NODE_ENV=production
DATABASE_URL=postgres://b2d:<password>@127.0.0.1:6432/brandtodoor?pool_min=5&pool_max=20
REDIS_URL=redis://127.0.0.1:6400
DB_SYNCHRONIZE=false
MEDUSA_DISABLE_TELEMETRY=true

# Security
JWT_SECRET=<256-bit hex>
COOKIE_SECRET=<256-bit hex>
AUTH_MFA_ENCRYPTION_KEY=<256-bit hex>
PLATFORM_KEK=<256-bit base64>

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_TENANT_MAX=1000

# File storage
FILE_PROVIDER=s3
S3_ENDPOINT=http://127.0.0.1:9002
S3_BUCKET=brandtodoor-assets
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
```

### 1.3 Load Balancer & Edge

**HAProxy or Nginx**
- Health check: `GET /health` every 5s
- Sticky sessions: cookie-based (for WebSocket)
- SSL termination: Let's Encrypt auto-renewal
- Rate limiting: per-IP + per-tenant
- Compression: gzip/brotli for static assets
- Caching: 1h for static assets, 5min for API responses

**Edge Router Update**
- Remove all dedicated-instance logic
- All tenants are pooled
- `/admin` → merchant SPA
- `/merchant/*` → shared backend
- `/auth/*` → shared backend
- `/store/*` → shared backend (with `x-publishable-api-key`)
- Everything else → storefront

### 1.4 Monitoring & Alerting

**Prometheus**
- Node exporter (VM metrics)
- Postgres exporter (DB metrics)
- Redis exporter (cache metrics)
- Custom Medusa metrics (per-tenant request count, latency, error rate)

**Grafana Dashboards**
- Platform overview: tenant count, MRR, active stores, error rate
- Per-tenant dashboard: requests, revenue, products, orders, AI usage
- Infrastructure: CPU, memory, DB connections, replication lag
- Business: signups, churn, LTV, credit burn rate

**Alerts (Alertmanager → Slack)**
- Backend down for > 30s
- DB replication lag > 10s
- Error rate > 1% for any tenant
- PgBouncer pool exhaustion
- Redis memory > 80%
- Disk space > 80%
- Failed provisioning jobs
- Credit ledger drift

---

## Phase 2: Core Commerce (Weeks 4-6)

### 2.1 Tenant Provisioning (Shared Backend)

**New Provisioning Workflow**
```typescript
// provision-tenant-pooled.ts
const createTenantStep = createStep("create-tenant", async (input, { container }) => {
  const svc = container.resolve(PLATFORM_MODULE)
  const [tenant] = await svc.createTenants([{
    slug: input.slug,
    name: input.name,
    package: input.package || "free_trial",
    status: "provisioning",
    mode: "pooled", // NEW: all tenants are pooled
  }])
  return new StepResponse(tenant, tenant.id)
})

const bootstrapCommerceStep = createStep("bootstrap-commerce", async (input, { container }) => {
  const { tenant } = input
  
  // 1. Sales channel (tenant isolation)
  const { result: channels } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: `${tenant.name} Store`, description: `tenant:${tenant.id}` }] }
  })
  const salesChannel = channels[0]
  
  // 2. Publishable API key
  const { result: keys } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: `${tenant.slug} storefront`, type: "publishable", created_by: "platform" }] }
  })
  const apiKey = keys[0]
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: apiKey.id, add: [salesChannel.id] }
  })
  
  // 3. Default region + currency
  const regionModule = container.resolve(Modules.REGION)
  await regionModule.createRegions([{
    name: "United States",
    currency_code: "usd",
    countries: ["us"],
    payment_providers: ["pp_system_default"],
  }])
  
  // 4. Sample product
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: [{
        title: `${tenant.name} — Sample Product`,
        status: "published",
        sales_channels: [{ id: salesChannel.id }],
        options: [{ title: "Default", values: ["Default"] }],
        variants: [{
          title: "Default",
          prices: [{ amount: 1000, currency_code: "usd" }],
          options: { Default: "Default" },
        }],
      }],
    },
  })
  
  // 5. Update tenant row
  const svc = container.resolve(PLATFORM_MODULE)
  await svc.updateTenants({
    id: tenant.id,
    publishable_key: apiKey.token,
    meta: {
      ...(tenant.meta || {}),
      sales_channel_id: salesChannel.id,
      bootstrapped: true,
    },
  })
  
  return new StepResponse({ tenant, salesChannel, apiKey, product: products[0] }, { tenant_id: tenant.id })
}, async (comp, { container }) => {
  // Compensation: tear down commerce scaffolding
  if (!comp) return
  try {
    const sc = container.resolve(Modules.SALES_CHANNEL)
    await sc.deleteSalesChannels([comp.sales_channel_id])
  } catch {}
  try {
    const ak = container.resolve(Modules.API_KEY)
    await ak.deleteApiKeys([comp.api_key_id])
  } catch {}
})

const seedSecretsStep = createStep("seed-secrets", async (input, { container }) => {
  const cfg = new EncryptedConfigService(container)
  await cfg.ensureKey(input.tenant.id)
  for (const [k, v] of Object.entries(input.secrets || {})) {
    await cfg.setSecret(input.tenant.id, k, v)
  }
  return new StepResponse(input.tenant, { tenant_id: input.tenant.id, keys: Object.keys(input.secrets || {}) })
})

const allocateHostnameStep = createStep("allocate-hostname", async (tenant, { container }) => {
  const svc = container.resolve(PLATFORM_MODULE)
  const domain = `${tenant.slug}.brandtodoor.com`.toLowerCase()
  const [row] = await svc.createTenantDomains([{
    tenant_id: tenant.id,
    domain,
    type: "free",
    is_primary: true,
    ssl_status: "active",
    verification_status: "verified",
  }])
  return new StepResponse({ ...tenant, domain }, row.id)
})

const grantCreditsStep = createStep("grant-credits", async (input, { container }) => {
  const svc = container.resolve(PLATFORM_MODULE)
  const credits = input.trial_credits || 300
  if (credits > 0) {
    await getLedger(container).credit(input.tenant.id, credits, {
      type: "grant",
      idempotencyKey: `trial_grant_${input.tenant.id}`,
    })
  }
  await svc.updateTenants({ id: input.tenant.id, credit_balance: credits })
  return new StepResponse(input.tenant, { tenant_id: input.tenant.id, credits })
})

const markLiveStep = createStep("mark-live", async (tenant, { container }) => {
  const svc = container.resolve(PLATFORM_MODULE)
  await svc.updateTenants({
    id: tenant.id,
    status: "live",
    provisioned_at: new Date(),
  })
  return new StepResponse({ tenant_id: tenant.id, status: "live" }, tenant.id)
})

export const provisionPooledTenantWorkflow = createWorkflow("provision-pooled-tenant", (input) => {
  const tenant = createTenantStep(input)
  const bootstrapped = bootstrapCommerceStep({ tenant })
  const seeded = seedSecretsStep({ tenant: bootstrapped, secrets: input.secrets })
  const hosted = allocateHostnameStep(seeded)
  const credited = grantCreditsStep({ tenant: hosted, trial_credits: input.trial_credits })
  const live = markLiveStep(credited)
  return new WorkflowResponse(live)
})
```

**Key Changes:**
- No `spinInstanceStep` — no database creation, no pm2 process, no container boot
- `bootstrapCommerceStep` creates sales channel + publishable key in the shared backend
- `mode: "pooled"` on tenant row
- `backend_url` and `container_ref` are `null`
- Provisioning time: ~2s (vs ~100s for dedicated instance)

### 2.2 Merchant Authentication

**Auth Flow:**
1. Merchant signs up at `merchant.brandtodoor.com`
2. System creates `Tenant` row + `Merchant` row + Medusa `AuthIdentity` with `actor_type: "merchant"`
3. Merchant logs in with email + password
4. System issues JWT with `actor_type: "merchant"` + `actor_id` (merchant row ID)
5. Every `/merchant/*` request is scoped to that merchant's tenant via `resolveMerchant()`

**MFA (TOTP):**
- Add `mfa_enabled` and `mfa_secret` to `merchant` model
- On login, if MFA enabled, require TOTP code
- Use `speakeasy` or `otplib` for TOTP generation/verification
- QR code for setup (Google Authenticator compatible)
- Backup codes (10 single-use codes)

**Password Policy:**
- Minimum 12 characters
- Require uppercase, lowercase, digit, special character
- Check against Have I Been Pwned API (k-anonymity)
- Rate limit: 5 attempts per 15 minutes
- Password expiry: 90 days (optional, configurable per tenant)

### 2.3 Merchant Admin SPA

**Technology:** React 18 + TypeScript + Vite + Tailwind CSS + React Query + Zustand

**Pages:**

| Page | Route | API |
|------|-------|-----|
| Dashboard | `/admin` | `GET /merchant/me` + `GET /merchant/metrics` |
| Products | `/admin/products` | `GET /merchant/products` + `POST /admin/products` |
| Product Detail | `/admin/products/:id` | `GET /admin/products/:id` + `POST /admin/products/:id` |
| Orders | `/admin/orders` | `GET /merchant/orders` |
| Order Detail | `/admin/orders/:id` | `GET /admin/orders/:id` |
| Customers | `/admin/customers` | `GET /admin/customers` (scoped to sales channel) |
| Settings | `/admin/settings` | `GET /merchant/settings` + `PUT /merchant/settings` |
| Domains | `/admin/domains` | `GET /merchant/domains` + `POST /merchant/domains` |
| Theme | `/admin/theme` | `GET /merchant/themes` + `PUT /merchant/theme` |
| Payments | `/admin/payments` | `GET /merchant/payments` + `POST /merchant/payments/:provider` |
| AI Marketing | `/admin/marketing` | `GET /merchant/marketing/campaigns` + `POST /merchant/marketing/campaigns` |
| Call Center | `/admin/call-center` | `GET /merchant/call-center/playbooks` + `POST /merchant/call-center/calls` |
| Analytics | `/admin/analytics` | `GET /merchant/analytics` (revenue, orders, visitors) |
| Team | `/admin/team` | `GET /merchant/team` + `POST /merchant/team` |
| Billing | `/admin/billing` | `GET /merchant/billing` + `POST /merchant/billing/credits` |

**API Proxy:**
- The merchant SPA is served by the edge router
- All `/admin/*` routes are SPA fallback to `index.html`
- API calls go to `/merchant/*`, `/auth/*`, `/admin/*` (proxied to shared backend)
- The shared backend validates `actor_type: "merchant"` and scopes all queries

### 2.4 Storefront

**Next.js Storefront (`b2d-storefront-next`)**
- Server-side rendering for SEO
- Dynamic routes: `/[country]/products`, `/[country]/products/[handle]`, `/[country]/cart`, `/[country]/checkout`
- Fetches data from shared backend with `x-publishable-api-key` header
- Theme switching based on `active_theme` from tenant config
- Multi-currency support
- Multi-language support (i18n)

**Performance:**
- ISR (Incremental Static Regeneration) for product pages
- Edge caching (Cloudflare)
- Image optimization (Next.js Image)
- Lazy loading for below-the-fold content

---

## Phase 3: AI & Automation (Weeks 7-8)

### 3.1 AI Marketing Module

**Features:**
- **Product Description Generator:** Upload image → AI generates SEO-optimized description
- **Marketing Copy Generator:** Generate email subject lines, ad copy, social media posts
- **SEO Optimizer:** Auto-generate meta titles, descriptions, alt text
- **Email Campaigns:** Drag-and-drop builder, AI-powered send-time optimization, A/B testing
- **Social Media Scheduler:** Schedule posts to Instagram, Facebook, Twitter, TikTok
- **Customer Journey Builder:** Visual workflow builder (if-then-else), AI-powered recommendations
- **Abandoned Cart Recovery:** AI-generated personalized recovery emails
- **Review Request Automation:** Auto-request reviews after delivery, AI-generated review responses

**API Integration:**
- OpenAI GPT-4o for text generation
- Claude 3.5 Sonnet for long-form content
- DALL-E 3 for image generation
- Local LLM fallback (Llama 3.1 70B) for cost-sensitive operations

**Tenant Scoping:**
- Every campaign, journey, email template is scoped to `tenant_id`
- AI usage is metered per tenant (credits)
- Per-tenant AI model selection (GPT-4o vs Claude vs local)

### 3.2 Call Center Module

**Features:**
- **AI Voice Agent:** Natural-sounding voice (ElevenLabs), understands context, handles objections
- **Inbound Call Routing:** Route to AI agent or human agent based on intent
- **Outbound Campaigns:** Schedule calls, AI dials and speaks, logs outcomes
- **Call Recording & Transcription:** Whisper API for transcription, sentiment analysis
- **Playbook Builder:** Visual call flow builder (greeting → qualification → pitch → close)
- **Guardrails:** Compliance checks (TCPA, GDPR), do-not-call list, consent management
- **Real-time Coaching:** AI suggests responses to human agents during calls
- **Analytics:** Call volume, conversion rate, average handle time, sentiment trends

**Telephony Integration:**
- Twilio for voice (inbound/outbound)
- Plivo for SMS
- WebRTC for browser-based calling

**Tenant Scoping:**
- Every playbook, call log, agent is scoped to `tenant_id`
- Phone numbers are per-tenant (sub-accounts in Twilio)
- Call costs are metered per tenant (credits)

### 3.3 AI-Powered Analytics

**Features:**
- **Sales Forecasting:** AI predicts next 30/60/90 days revenue
- **Churn Prediction:** AI identifies at-risk customers
- **Product Recommendations:** Collaborative filtering + content-based
- **Dynamic Pricing:** AI suggests optimal prices based on demand, competition, inventory
- **Inventory Optimization:** AI predicts stockouts, suggests reorder quantities
- **Customer Segmentation:** AI clusters customers by behavior, value, preferences

---

## Phase 4: Payments & Billing (Weeks 9-10)

### 4.1 Payment Providers

**Implemented:**
- Stripe (cards, Apple Pay, Google Pay, BNPL)
- SSLCommerz (Bangladesh)
- PayPal
- Razorpay (India)
- Paystack (Nigeria, Africa)
- Flutterwave (Africa)
- bKash (Bangladesh)
- Nagad (Bangladesh)
- Bank Transfer (manual verification)

**Architecture:**
- Payment provider registry (plugin-based)
- Each provider is a Medusa module with `capturePayment`, `refundPayment`, `authorizePayment`
- Credentials stored in `EncryptedConfigService` per tenant
- Webhook handling per tenant (verify signature, route to correct tenant)

### 4.2 Billing System

**Subscription Tiers:**
- Free: $0/month, 3% transaction fee, basic features
- Starter: $29/month, 2% transaction fee, AI marketing, custom domain
- Growth: $99/month, 1% transaction fee, call center, team members
- Pro: $299/month, 0.5% transaction fee, advanced analytics, priority support
- Enterprise: Custom pricing, dedicated support, SLA

**Credit System:**
- AI usage: 1 credit per 1000 tokens (GPT-4o), 0.1 credit per 1000 tokens (local LLM)
- Call center: 10 credits per minute (voice), 1 credit per SMS
- Email: 1 credit per 1000 emails
- Storage: 1 credit per GB per month
- Overages: auto-charge to card when credits < 0

**Stripe Billing Integration:**
- Stripe Checkout for subscription signup
- Stripe Customer Portal for plan changes, cancellations
- Stripe Invoices for monthly billing
- Stripe Webhooks for subscription events

---

## Phase 5: Security & Compliance (Weeks 11-12)

### 5.1 Security

- **MFA:** TOTP for all merchant accounts (mandatory for admin users)
- **SSO:** OAuth 2.0 / OpenID Connect (Google, Microsoft, GitHub)
- **RBAC:** Roles (owner, admin, editor, viewer) per tenant
- **API Keys:** Scoped, rotatable, audit-logged
- **Secrets:** Envelope encryption (KEK-wrapped DEK), automatic rotation
- **Rate Limiting:** Per-tenant, per-IP, per-user (Redis-backed sliding window)
- **DDoS Protection:** Cloudflare, rate limiting, challenge pages
- **WAF:** SQL injection, XSS, CSRF, path traversal rules
- **CSP:** Strict Content Security Policy headers
- **HSTS:** HTTPS-only with preload
- **Penetration Testing:** Quarterly third-party pentest

### 5.2 Compliance

- **GDPR:**
  - Data deletion API (right to be forgotten)
  - Data portability (export all tenant data)
  - Consent management (marketing emails, cookies)
  - DPO contact, privacy policy, terms of service
- **PCI-DSS:**
  - Stripe Elements for card input (no card data touches our servers)
  - Annual SAQ-A assessment
- **SOC 2 Type II:**
  - Audit trail for all data access
  - Access controls, change management
  - Incident response plan
- **Tax:**
  - Automatic tax calculation (Stripe Tax, TaxJar)
  - Tax reporting per jurisdiction

### 5.3 Data Isolation Verification

**Automated Tests:**
- Cross-tenant data leakage test (1000 iterations, random tenants)
- SQL injection test (all API endpoints)
- XSS test (all user input fields)
- CSRF test (all state-changing endpoints)
- Authentication bypass test (all admin endpoints)
- Rate limit test (flood detection)

**Chaos Engineering:**
- Randomly kill backend nodes (verify failover)
- Randomly kill DB connections (verify reconnection)
- Randomly delay network (verify timeout handling)
- Randomly corrupt data (verify validation)

---

## Deliverables

### Code
- Complete source code for all modules, services, APIs, and SPA
- Unit tests (coverage > 80%)
- Integration tests (all API endpoints)
- Load tests (1000 concurrent tenants)
- Security tests (pentest report)

### Infrastructure
- Docker Compose for local development
- Docker Compose for production (single VM)
- Kubernetes manifests for horizontal scaling
- Terraform for cloud infrastructure (AWS/GCP/Azure)
- Ansible playbooks for VM setup

### Documentation
- API documentation (OpenAPI/Swagger)
- Architecture decision records (ADRs)
- Runbooks (incident response, deployment, backup/restore)
- Merchant onboarding guide
- Developer documentation (for custom themes, plugins)

### Monitoring
- Grafana dashboards (JSON export)
- Alert rules (Prometheus)
- Log aggregation queries (Loki)
- SLA definitions and monitoring

---

## Honest Assessment

This is a **$500K-$1M engineering effort** if you hired a team. I am doing it as a single agent. The timeline is aggressive but achievable because:

1. The control plane already exists (platform module, workflows, credit ledger, encrypted config)
2. The edge router already exists (HostResolver, scale-to-zero, domain routing)
3. The storefront already exists (Next.js, theme switching)
4. The merchant auth already exists (actor_type: "merchant", resolveMerchant())
5. The custom modules exist (CMS, marketing, call center, payments) — they need tenant scoping, not rewriting

The hard parts are already done. The remaining work is:
- Replace one provisioning step (2 days)
- Build the merchant admin SPA (4-6 weeks)
- Add tenant scoping to custom modules (2 weeks)
- Production hardening (2-3 weeks)

**The real timeline is 8-12 weeks, not 4.** I will do it properly.

---

## Next Steps

1. **Approve this plan** — I will begin implementation
2. **I will start with Phase 1.1** (Database infrastructure: PgBouncer, read replica, Redis cluster)
3. **Weekly demos** — I will show progress every week
4. **Go/No-Go gates** — At the end of each phase, we verify and decide to proceed

**This is the path to a production-grade, AI-powered, multi-tenant Shopify. Let's build it.**
