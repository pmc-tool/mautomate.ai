import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630110013 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_snapshot" drop constraint if exists "cms_snapshot_version_unique";`);
    this.addSql(`alter table if exists "cms_snapshot" drop constraint if exists "cms_snapshot_live_unique";`);
    this.addSql(`alter table if exists "cms_section_translation" drop constraint if exists "cms_section_translation_section_locale_unique";`);
    this.addSql(`alter table if exists "cms_page_translation" drop constraint if exists "cms_page_translation_page_locale_unique";`);
    this.addSql(`alter table if exists "cms_page" drop constraint if exists "cms_page_slug_unique";`);
    this.addSql(`create table if not exists "cms_page" ("id" text not null, "slug" text not null, "title" text not null, "status" text check ("status" in ('draft', 'active', 'archived')) not null default 'draft', "is_home" boolean not null default false, "default_locale" text not null default 'en', "fallback_locale" text not null default 'en', "seo_title" text null, "seo_description" text null, "seo_keywords" text null, "og_image" text null, "canonical_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_page_deleted_at" ON "cms_page" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_page_slug_unique" ON "cms_page" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_page_status" ON "cms_page" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_page_translation" ("id" text not null, "locale" text not null, "title" text null, "seo_title" text null, "seo_description" text null, "seo_keywords" text null, "og_image" text null, "page_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_page_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_page_translation_page_id" ON "cms_page_translation" ("page_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_page_translation_deleted_at" ON "cms_page_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_page_translation_page_locale_unique" ON "cms_page_translation" ("page_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_section" ("id" text not null, "type" text not null, "rank" integer not null default 0, "enabled" boolean not null default true, "label" text null, "data" jsonb not null, "page_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_section_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_section_page_id" ON "cms_section" ("page_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_section_deleted_at" ON "cms_section" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_section_page_rank" ON "cms_section" ("page_id", "rank") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_section_translation" ("id" text not null, "locale" text not null, "data" jsonb not null, "section_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_section_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_section_translation_section_id" ON "cms_section_translation" ("section_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_section_translation_deleted_at" ON "cms_section_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_section_translation_section_locale_unique" ON "cms_section_translation" ("section_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_snapshot" ("id" text not null, "entity_type" text check ("entity_type" in ('page', 'global')) not null, "entity_id" text not null, "slug" text not null, "locale" text not null, "version" integer not null default 1, "is_live" boolean not null default false, "data" jsonb not null, "published_by" text null, "published_at" timestamptz null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_snapshot_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_snapshot_deleted_at" ON "cms_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_snapshot_live_unique" ON "cms_snapshot" ("entity_type", "slug", "locale") WHERE is_live = true AND deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_snapshot_version_unique" ON "cms_snapshot" ("entity_type", "slug", "locale", "version") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "cms_page_translation" add constraint "cms_page_translation_page_id_foreign" foreign key ("page_id") references "cms_page" ("id") on update cascade;`);

    this.addSql(`alter table if exists "cms_section" add constraint "cms_section_page_id_foreign" foreign key ("page_id") references "cms_page" ("id") on update cascade;`);

    this.addSql(`alter table if exists "cms_section_translation" add constraint "cms_section_translation_section_id_foreign" foreign key ("section_id") references "cms_section" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cms_page_translation" drop constraint if exists "cms_page_translation_page_id_foreign";`);

    this.addSql(`alter table if exists "cms_section" drop constraint if exists "cms_section_page_id_foreign";`);

    this.addSql(`alter table if exists "cms_section_translation" drop constraint if exists "cms_section_translation_section_id_foreign";`);

    this.addSql(`drop table if exists "cms_page" cascade;`);

    this.addSql(`drop table if exists "cms_page_translation" cascade;`);

    this.addSql(`drop table if exists "cms_section" cascade;`);

    this.addSql(`drop table if exists "cms_section_translation" cascade;`);

    this.addSql(`drop table if exists "cms_snapshot" cascade;`);
  }

}
