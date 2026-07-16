import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * ADS-2 — signals layer (Phase 2: pixel + Conversions API + product catalog).
 *
 * Additive only — two NEW tables:
 *   ads_pixel    the tenant's tracking pixel/dataset (public pixel id + CAPI
 *                heartbeat counters; CAPI auth uses the connection's sealed token)
 *   ads_catalog  the tenant's remote product catalog (Meta Commerce catalog id
 *                + honest pushed/skipped sync bookkeeping)
 *
 * Same conventions as ADS-1: text + CHECK enums, jsonb, numeric counters as
 * double precision, tenant_id partial indexes.
 */
export class Migration20260716150000 extends Migration {

  override async up(): Promise<void> {
    // ---------------------------------------------------------- ads_pixel
    this.addSql(`create table if not exists "ads_pixel" ("id" text not null, "tenant_id" text not null, "connection_id" text null, "account_id" text null, "platform" text check ("platform" in ('meta', 'google', 'tiktok', 'mock')) not null, "external_id" text not null, "name" text null, "capi_token_enc" text null, "test_event_code" text null, "status" text check ("status" in ('active', 'disabled')) not null default 'active', "events_sent" double precision not null default 0, "last_event_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_pixel_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_pixel_deleted_at" ON "ads_pixel" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_pixel_tenant_id" ON "ads_pixel" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_pixel_tenant_platform_external_unique" ON "ads_pixel" ("tenant_id", "platform", "external_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_catalog
    this.addSql(`create table if not exists "ads_catalog" ("id" text not null, "tenant_id" text not null, "connection_id" text null, "platform" text check ("platform" in ('meta', 'google', 'tiktok', 'mock')) not null, "external_id" text not null, "business_id" text null, "name" text null, "status" text check ("status" in ('active', 'error')) not null default 'active', "item_count" double precision not null default 0, "skipped_count" double precision not null default 0, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_catalog_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_catalog_deleted_at" ON "ads_catalog" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_catalog_tenant_id" ON "ads_catalog" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_catalog_tenant_platform_external_unique" ON "ads_catalog" ("tenant_id", "platform", "external_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ads_catalog" cascade;`);
    this.addSql(`drop table if exists "ads_pixel" cascade;`);
  }

}
