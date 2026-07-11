import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703072816 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketing_segment_member" drop constraint if exists "marketing_segment_member_seg_contact_unique";`);
    this.addSql(`create table if not exists "marketing_segment" ("id" text not null, "tenant_id" text not null, "name" text not null, "description" text null, "kind" text check ("kind" in ('dynamic', 'static')) not null default 'dynamic', "filter" jsonb null, "member_count" integer not null default 0, "last_evaluated_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_segment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_segment_deleted_at" ON "marketing_segment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_segment_tenant_id" ON "marketing_segment" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_segment_member" ("id" text not null, "tenant_id" text not null, "segment_id" text not null, "contact_id" text not null, "source" text check ("source" in ('dynamic', 'manual')) not null default 'dynamic', "added_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_segment_member_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_segment_member_deleted_at" ON "marketing_segment_member" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_segment_member_tenant_id" ON "marketing_segment_member" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_segment_member_seg_contact_unique" ON "marketing_segment_member" ("tenant_id", "segment_id", "contact_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_segment_member_segment" ON "marketing_segment_member" ("tenant_id", "segment_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_segment" cascade;`);

    this.addSql(`drop table if exists "marketing_segment_member" cascade;`);
  }

}
