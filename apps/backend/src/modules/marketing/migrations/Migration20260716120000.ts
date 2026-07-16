import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * ADS-1 — the Advertising panel's data foundation (Phase 1: connect + mirror).
 *
 * Additive only — seven NEW tables, nothing existing is touched:
 *   ads_connection  the merchant's authorized ad-platform identity (sealed tokens)
 *   ads_account     ad accounts discovered under a connection (act_…)
 *   ads_campaign    local mirror of campaigns (+ panel/ai-created from Phase 3)
 *   ads_adset       ad set mirror (populated from Phase 3)
 *   ads_ad          ad mirror (populated from Phase 3)
 *   ads_insight     one row per object per day of real platform performance
 *   ads_action_log  append-only audit trail (merchant / ai / autopilot / system)
 *
 * Enums are text + CHECK constraints (module convention). Metric/money columns
 * are numeric-typed via double precision — never integer (the money-column
 * lesson). All tables carry tenant_id with partial indexes on deleted_at.
 */
export class Migration20260716120000 extends Migration {

  override async up(): Promise<void> {
    // ---------------------------------------------------------- ads_connection
    this.addSql(`create table if not exists "ads_connection" ("id" text not null, "tenant_id" text not null, "platform" text check ("platform" in ('meta', 'google', 'tiktok', 'mock')) not null, "external_user_id" text null, "display_name" text null, "scopes" jsonb null, "access_token_enc" text null, "refresh_token_enc" text null, "token_type" text null, "expires_at" timestamptz null, "status" text check ("status" in ('connected', 'expired', 'revoked', 'error')) not null default 'connected', "connected_by_user_id" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_connection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_connection_deleted_at" ON "ads_connection" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_connection_tenant_id" ON "ads_connection" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_connection_tenant_platform_external_unique" ON "ads_connection" ("tenant_id", "platform", "external_user_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_account
    this.addSql(`create table if not exists "ads_account" ("id" text not null, "tenant_id" text not null, "connection_id" text not null, "platform" text check ("platform" in ('meta', 'google', 'tiktok', 'mock')) not null, "external_id" text not null, "name" text null, "currency" text null, "timezone" text null, "status" text check ("status" in ('active', 'disabled')) not null default 'active', "selected" boolean not null default false, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_account_deleted_at" ON "ads_account" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_account_tenant_id" ON "ads_account" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_account_tenant_platform_external_unique" ON "ads_account" ("tenant_id", "platform", "external_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_account_connection_id" ON "ads_account" ("connection_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_campaign
    this.addSql(`create table if not exists "ads_campaign" ("id" text not null, "tenant_id" text not null, "account_id" text not null, "platform" text check ("platform" in ('meta', 'google', 'tiktok', 'mock')) not null, "external_id" text null, "name" text not null, "objective" text null, "status" text not null default 'other', "external_status" text null, "source" text check ("source" in ('imported', 'panel', 'ai')) not null default 'imported', "daily_budget" double precision null, "lifetime_budget" double precision null, "currency" text null, "start_at" timestamptz null, "end_at" timestamptz null, "spec" jsonb null, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_campaign_deleted_at" ON "ads_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_campaign_tenant_id" ON "ads_campaign" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_campaign_tenant_platform_external_unique" ON "ads_campaign" ("tenant_id", "platform", "external_id") WHERE deleted_at IS NULL AND external_id IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_campaign_account_id" ON "ads_campaign" ("account_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_adset
    this.addSql(`create table if not exists "ads_adset" ("id" text not null, "tenant_id" text not null, "campaign_id" text not null, "external_id" text null, "name" text null, "status" text not null default 'other', "external_status" text null, "daily_budget" double precision null, "targeting" jsonb null, "optimization_goal" text null, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_adset_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_adset_deleted_at" ON "ads_adset" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_adset_tenant_id" ON "ads_adset" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_adset_campaign_id" ON "ads_adset" ("campaign_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_ad
    this.addSql(`create table if not exists "ads_ad" ("id" text not null, "tenant_id" text not null, "adset_id" text null, "campaign_id" text null, "external_id" text null, "name" text null, "status" text not null default 'other', "external_status" text null, "creative" jsonb null, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_ad_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_ad_deleted_at" ON "ads_ad" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_ad_tenant_id" ON "ads_ad" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_ad_campaign_id" ON "ads_ad" ("campaign_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_insight
    this.addSql(`create table if not exists "ads_insight" ("id" text not null, "tenant_id" text not null, "account_id" text not null, "level" text check ("level" in ('account', 'campaign', 'adset', 'ad')) not null, "external_id" text not null, "date" timestamptz not null, "currency" text null, "spend" double precision not null default 0, "impressions" double precision not null default 0, "clicks" double precision not null default 0, "ctr" double precision null, "conversions" double precision not null default 0, "conversion_value" double precision not null default 0, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_insight_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_insight_deleted_at" ON "ads_insight" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_insight_tenant_id" ON "ads_insight" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ads_insight_tenant_level_external_date_unique" ON "ads_insight" ("tenant_id", "level", "external_id", "date") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_insight_tenant_date" ON "ads_insight" ("tenant_id", "date") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- ads_action_log
    this.addSql(`create table if not exists "ads_action_log" ("id" text not null, "tenant_id" text not null, "actor" text check ("actor" in ('merchant', 'ai', 'autopilot', 'system')) not null, "action" text not null, "level" text null, "object_id" text null, "external_id" text null, "reason" text null, "before" jsonb null, "after" jsonb null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_action_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_action_log_deleted_at" ON "ads_action_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_action_log_tenant_id" ON "ads_action_log" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_action_log_tenant_object" ON "ads_action_log" ("tenant_id", "object_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ads_action_log" cascade;`);
    this.addSql(`drop table if exists "ads_insight" cascade;`);
    this.addSql(`drop table if exists "ads_ad" cascade;`);
    this.addSql(`drop table if exists "ads_adset" cascade;`);
    this.addSql(`drop table if exists "ads_campaign" cascade;`);
    this.addSql(`drop table if exists "ads_account" cascade;`);
    this.addSql(`drop table if exists "ads_connection" cascade;`);
  }

}
