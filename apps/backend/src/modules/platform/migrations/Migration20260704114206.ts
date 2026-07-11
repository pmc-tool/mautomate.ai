import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704114206 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "storefront_theme" drop constraint if exists "storefront_theme_key_unique";`);
    this.addSql(`create table if not exists "storefront_theme" ("id" text not null, "key" text not null, "name" text not null, "description" text null, "accent_color" text not null default '#0e7490', "active" boolean not null default true, "sort" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_theme_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_storefront_theme_deleted_at" ON "storefront_theme" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_theme_key_unique" ON "storefront_theme" ("key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "storefront_theme" cascade;`);
  }

}
