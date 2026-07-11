import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704115357 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "blog_post" drop constraint if exists "blog_slug_unique";`);
    this.addSql(`create table if not exists "blog_post" ("id" text not null, "slug" text not null, "title" text not null, "excerpt" text null, "body" text not null default '', "status" text check ("status" in ('draft', 'published')) not null default 'draft', "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_post_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_deleted_at" ON "blog_post" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_slug_unique" ON "blog_post" ("slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "partner" ("id" text not null, "name" text not null, "email" text null, "company" text null, "tier" text check ("tier" in ('bronze', 'silver', 'gold')) not null default 'bronze', "commission_pct" integer not null default 20, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "referral_code" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "partner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partner_deleted_at" ON "partner" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partner_status" ON "partner" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "support_ticket" ("id" text not null, "name" text null, "email" text null, "subject" text null, "message" text not null, "tenant_id" text null, "source" text check ("source" in ('contact', 'support')) not null default 'contact', "status" text check ("status" in ('open', 'closed')) not null default 'open', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "support_ticket_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_support_ticket_deleted_at" ON "support_ticket" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ticket_status" ON "support_ticket" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "blog_post" cascade;`);

    this.addSql(`drop table if exists "partner" cascade;`);

    this.addSql(`drop table if exists "support_ticket" cascade;`);
  }

}
