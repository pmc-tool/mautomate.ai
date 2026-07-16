import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * ADS-3 — autopilot (Phase 5). One NEW table:
 *   ads_rule  condition -> action rules the autopilot sweep evaluates.
 * Settings (enabled / monthly cap / last-charged day) live in the existing
 * marketing_setting key/value store; firings land in ads_action_log.
 */
export class Migration20260716200000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ads_rule" ("id" text not null, "tenant_id" text not null, "name" text not null, "enabled" boolean not null default true, "campaign_id" text null, "metric" text check ("metric" in ('spend', 'cpa', 'ctr', 'clicks', 'conversions')) not null, "op" text check ("op" in ('gt', 'lt')) not null, "value" double precision not null, "window_days" double precision not null default 3, "min_spend" double precision not null default 0, "action" text check ("action" in ('pause_campaign', 'notify')) not null, "cooldown_hours" double precision not null default 24, "last_fired_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ads_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_rule_deleted_at" ON "ads_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ads_rule_tenant_id" ON "ads_rule" ("tenant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ads_rule" cascade;`);
  }

}
