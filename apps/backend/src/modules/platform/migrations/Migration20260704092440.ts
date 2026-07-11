import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704092440 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "price_book_entry" drop constraint if exists "price_book_action_unique";`);
    this.addSql(`alter table if exists "platform_package" drop constraint if exists "platform_package_key_unique";`);
    this.addSql(`create table if not exists "platform_package" ("id" text not null, "key" text not null, "name" text not null, "price_usd" integer not null default 0, "included_credits" integer not null default 0, "fixed_infra_usd" integer not null default 0, "products_limit" integer null, "seats_limit" integer null, "domains_limit" integer null, "features" jsonb null, "active" boolean not null default true, "sort" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "platform_package_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_platform_package_deleted_at" ON "platform_package" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_package_key_unique" ON "platform_package" ("key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "price_book_entry" ("id" text not null, "action" text not null, "label" text null, "credits" integer not null default 0, "vendor_cost_usd" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "price_book_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_book_entry_deleted_at" ON "price_book_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_book_action_unique" ON "price_book_entry" ("action") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "platform_package" cascade;`);

    this.addSql(`drop table if exists "price_book_entry" cascade;`);
  }

}
