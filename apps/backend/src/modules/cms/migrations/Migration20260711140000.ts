import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260711140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cms_page_draft" ("id" text not null, "tenant_id" text null, "slug" text not null, "locale" text not null default 'en', "data" jsonb not null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_page_draft_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_page_draft_tenant_slug_locale" ON "cms_page_draft" ("tenant_id", "slug", "locale") WHERE deleted_at IS NULL;`);
  }
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cms_page_draft" cascade;`);
  }
}
