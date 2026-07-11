import { Migration } from "@medusajs/framework/mikro-orm/migrations";
export class Migration20260711160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cms_template" ("id" text not null, "tenant_id" text null, "name" text not null, "category" text not null default 'Sections', "scope" text not null default 'section', "data" jsonb not null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_template_tenant" ON "cms_template" ("tenant_id") WHERE deleted_at IS NULL;`);
  }
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cms_template" cascade;`);
  }
}
