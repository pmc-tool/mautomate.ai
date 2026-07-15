import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

/**
 * Redis Sentinel configuration for event bus + workflow engine.
 * The master is discovered automatically; failover is handled by ioredis.
 */
const redisSentinelConfig = process.env.REDIS_PASSWORD
  ? ({
      sentinels: [
        { host: "127.0.0.1", port: 26479 },
        { host: "127.0.0.1", port: 26480 },
        { host: "127.0.0.1", port: 26481 },
      ],
      name: process.env.REDIS_MASTER_NAME ?? "b2d-master",
      password: process.env.REDIS_PASSWORD,
      sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD ?? process.env.REDIS_PASSWORD,
    } as any)
  : undefined

/**
 * File Module provider switch (phase-0-architecture.md §7.1).
 *
 * Dev default = @medusajs/file-local (writes apps/backend/static/, serves
 * http://localhost:9000/static/...). Prod = @medusajs/file-s3, toggled by env
 * ONLY — no S3 creds are hardcoded here.
 *
 * Required env to switch to S3 (set FILE_PROVIDER=s3, or NODE_ENV=production):
 *   FILE_PROVIDER         "s3" | "local"  (explicit override; defaults to s3 in prod, local otherwise)
 *   S3_FILE_URL           public base URL of the bucket/CDN (becomes cms_media.url prefix)
 *   S3_REGION             e.g. us-east-1
 *   S3_BUCKET             bucket name
 *   S3_ACCESS_KEY_ID      IAM access key
 *   S3_SECRET_ACCESS_KEY  IAM secret
 *   S3_ENDPOINT           (optional) custom endpoint for R2 / Spaces / MinIO
 *   S3_PREFIX             (optional) key prefix; defaults to "cms/"
 *
 * Dev override (optional): MEDUSA_BACKEND_URL (defaults http://localhost:9000)
 * controls the public host the file-local provider prefixes onto /static URLs.
 */
const isS3 =
  (process.env.FILE_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "s3" : "local")) === "s3"

const fileProvider = isS3
  ? {
      resolve: "@medusajs/file-s3",
      id: "s3",
      options: {
        file_url: process.env.S3_FILE_URL,
        region: process.env.S3_REGION,
        bucket: process.env.S3_BUCKET,
        access_key_id: process.env.S3_ACCESS_KEY_ID,
        secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
        endpoint: process.env.S3_ENDPOINT,
        prefix: process.env.S3_PREFIX ?? "cms/",
        // acl intentionally omitted -> works with BucketOwnerEnforced buckets.
        cache_control: "public, max-age=31536000, immutable",
      },
    }
  : {
      resolve: "@medusajs/file-local",
      id: "local",
      options: {
        upload_dir: "static",
        backend_url: `${
          process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
        }/static`,
      },
    }

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Schema-per-tenant density: when DB_SCHEMA is set (injected per tenant
    // instance), this instance's tables + connection search_path live in that
    // Postgres schema of a SHARED database — many stores per cluster instead of
    // a whole database each. Unset (control plane / legacy db-per-tenant) => the
    // Medusa default of "public", so existing instances are unaffected.
    databaseSchema: process.env.DB_SCHEMA || undefined,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  admin: {
    // SAME-ORIGIN admin backend. Every tenant shares ONE admin build, so no
    // single baked absolute URL can be correct — each store's admin must talk to
    // whatever host served it (<slug>.brandtodoor.com -> edge -> its OWN
    // instance). "/" makes the dashboard use relative, same-origin API calls, so
    // one build works for every tenant. Override with ADMIN_BACKEND_URL if a
    // specific instance ever needs an absolute backend.
    backendUrl: process.env.ADMIN_BACKEND_URL ?? "/",
    disable: true,
  },
  modules: [
    {
      resolve: "./src/modules/contact",
    },
    {
      resolve: "./src/modules/cms",
    },
    {
      resolve: "./src/modules/theme",
    },
    {
      resolve: "./src/modules/call-center",
    },
    {
      resolve: "./src/modules/marketing",
    },
    {
      resolve: "./src/modules/domains",
    },
    {
      // Brand2Door control plane (tenants, domains, provisioning jobs, the
      // per-tenant encrypted config/secret store). Inert until the platform
      // rails are used; adds only CRUD tables on migrate.
      resolve: "./src/modules/platform",
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [fileProvider],
      },
    },
    {
      // Multi-tenant "Payment Gateway Setup". Every provider is registered with
      // EMPTY options and reads the tenant's own (bring-your-own) credentials
      // at runtime from the encrypted vault, so every tenant instance boots even
      // with no gateway configured. Runtime ids are `pp_<id>_<id>` (e.g.
      // pp_stripe_stripe). stripe + sslcommerz are fully implemented; the rest
      // are registered scaffolds (their pp_ ids exist so they can be enabled and
      // collect credentials) pending certification. See src/modules/payments.
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          { resolve: "./src/modules/payments/providers/stripe", id: "stripe" },
          { resolve: "./src/modules/payments/providers/sslcommerz", id: "sslcommerz" },
          { resolve: "./src/modules/payments/providers/paypal", id: "paypal" },
          { resolve: "./src/modules/payments/providers/bkash", id: "bkash" },
          { resolve: "./src/modules/payments/providers/nagad", id: "nagad" },
          { resolve: "./src/modules/payments/providers/razorpay", id: "razorpay" },
          { resolve: "./src/modules/payments/providers/paystack", id: "paystack" },
          { resolve: "./src/modules/payments/providers/flutterwave", id: "flutterwave" },
          { resolve: "./src/modules/payments/providers/mercadopago", id: "mercadopago" },
          { resolve: "./src/modules/payments/providers/xendit", id: "xendit" },
          { resolve: "./src/modules/payments/providers/midtrans", id: "midtrans" },
        ],
      },
    },
    // Redis Sentinel-backed event bus + workflow engine.
    // event-bus-redis dist is patched so worker.run() is not awaited in
    // onApplicationStart (BullMQ run() only resolves when the worker closes).
    ...(redisSentinelConfig
      ? [
          {
            key: Modules.EVENT_BUS,
            resolve: "@medusajs/event-bus-redis",
            options: { redisUrl: redisSentinelConfig },
          },
          {
            key: Modules.WORKFLOW_ENGINE,
            resolve: "@medusajs/workflow-engine-redis",
            options: { redis: { redisUrl: redisSentinelConfig } },
          },
        ]
      : []),
  ],
})
