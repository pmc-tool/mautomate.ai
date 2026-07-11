import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630131053 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_blog_post_translation" drop constraint if exists "cms_blog_post_translation_post_locale_unique";`);
    this.addSql(`alter table if exists "cms_blog_post" drop constraint if exists "cms_blog_post_slug_unique";`);
    this.addSql(`alter table if exists "cms_blog_category" drop constraint if exists "cms_blog_category_slug_unique";`);
    this.addSql(`alter table if exists "cms_author" drop constraint if exists "cms_author_slug_unique";`);
    this.addSql(`create table if not exists "cms_author" ("id" text not null, "name" text not null, "slug" text not null, "bio" text null, "avatar" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_author_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_author_deleted_at" ON "cms_author" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_author_slug_unique" ON "cms_author" ("slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_blog_category" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_blog_category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_category_deleted_at" ON "cms_blog_category" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_blog_category_slug_unique" ON "cms_blog_category" ("slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_blog_post" ("id" text not null, "slug" text not null, "title" text not null, "excerpt" text null, "content" text null, "cover_image" text null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "published_at" timestamptz null, "scheduled_at" timestamptz null, "seo_title" text null, "seo_description" text null, "og_image" text null, "reading_time" integer null, "author_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_blog_post_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_author_id" ON "cms_blog_post" ("author_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_deleted_at" ON "cms_blog_post" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_blog_post_slug_unique" ON "cms_blog_post" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_status" ON "cms_blog_post" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_published_at" ON "cms_blog_post" ("published_at") WHERE deleted_at IS NULL AND published_at IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_scheduled_at" ON "cms_blog_post" ("scheduled_at") WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL;`);

    this.addSql(`create table if not exists "cms_blog_post_category" ("id" text not null, "blog_post_id" text not null, "blog_category_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_blog_post_category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_blog_post_id" ON "cms_blog_post_category" ("blog_post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_blog_category_id" ON "cms_blog_post_category" ("blog_category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_deleted_at" ON "cms_blog_post_category" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_blog_post_translation" ("id" text not null, "locale" text not null, "title" text null, "excerpt" text null, "content" text null, "seo_title" text null, "seo_description" text null, "og_image" text null, "post_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_blog_post_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_translation_post_id" ON "cms_blog_post_translation" ("post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_translation_deleted_at" ON "cms_blog_post_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_blog_post_translation_post_locale_unique" ON "cms_blog_post_translation" ("post_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "cms_blog_post" add constraint "cms_blog_post_author_id_foreign" foreign key ("author_id") references "cms_author" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "cms_blog_post_translation" add constraint "cms_blog_post_translation_post_id_foreign" foreign key ("post_id") references "cms_blog_post" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cms_blog_post" drop constraint if exists "cms_blog_post_author_id_foreign";`);

    this.addSql(`alter table if exists "cms_blog_post_translation" drop constraint if exists "cms_blog_post_translation_post_id_foreign";`);

    this.addSql(`drop table if exists "cms_author" cascade;`);

    this.addSql(`drop table if exists "cms_blog_category" cascade;`);

    this.addSql(`drop table if exists "cms_blog_post" cascade;`);

    this.addSql(`drop table if exists "cms_blog_post_category" cascade;`);

    this.addSql(`drop table if exists "cms_blog_post_translation" cascade;`);
  }

}
