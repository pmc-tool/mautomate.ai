import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630095113 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_setting" drop constraint if exists "cms_setting_key_unique";`);
    this.addSql(`create table if not exists "cms_audit_log" ("id" text not null, "actor_id" text not null, "actor_email" text null, "action" text not null, "entity_type" text null, "entity_key" text null, "before" jsonb null, "after" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_audit_log_deleted_at" ON "cms_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_audit_log_entity_key" ON "cms_audit_log" ("entity_key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_setting" ("id" text not null, "key" text check ("key" in ('header', 'topbar', 'footer', 'theme', 'seo_defaults')) not null, "data" jsonb not null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_setting_deleted_at" ON "cms_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_setting_key_unique" ON "cms_setting" ("key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cms_audit_log" cascade;`);

    this.addSql(`drop table if exists "cms_setting" cascade;`);
  }

}
