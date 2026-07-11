import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703071543 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_journey" ("id" text not null, "tenant_id" text not null, "name" text not null, "description" text null, "trigger_event" text not null, "trigger_config" jsonb null, "segment_id" text null, "segment_filter" jsonb null, "steps" jsonb null, "status" text check ("status" in ('draft', 'active', 'paused', 'archived')) not null default 'draft', "allow_reenroll" boolean not null default false, "stats" jsonb null, "brand_voice_id" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_journey_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_deleted_at" ON "marketing_journey" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_tenant_id" ON "marketing_journey" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_tenant_trigger_status" ON "marketing_journey" ("tenant_id", "trigger_event", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_journey_enrollment" ("id" text not null, "tenant_id" text not null, "journey_id" text not null, "contact_id" text null, "email" text null, "customer_id" text null, "step_index" integer not null default 0, "status" text check ("status" in ('active', 'waiting', 'processing', 'completed', 'canceled', 'failed')) not null default 'active', "next_run_at" timestamptz null, "attempts" integer not null default 0, "max_attempts" integer not null default 3, "context" jsonb null, "error" text null, "entered_at" timestamptz null, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_journey_enrollment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_enrollment_deleted_at" ON "marketing_journey_enrollment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_enrollment_tenant_id" ON "marketing_journey_enrollment" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_enrollment_tenant_status_next" ON "marketing_journey_enrollment" ("tenant_id", "status", "next_run_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_journey_enrollment_journey_contact" ON "marketing_journey_enrollment" ("tenant_id", "journey_id", "contact_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_journey" cascade;`);

    this.addSql(`drop table if exists "marketing_journey_enrollment" cascade;`);
  }

}
