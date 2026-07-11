import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630132004 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop index if exists "IDX_cms_blog_post_category_blog_post_id";`);
    this.addSql(`drop index if exists "IDX_cms_blog_post_category_blog_category_id";`);
    this.addSql(`drop index if exists "IDX_cms_blog_post_category_deleted_at";`);
    this.addSql(`alter table if exists "cms_blog_post_category" drop constraint if exists "cms_blog_post_category_pkey";`);
    this.addSql(`alter table if exists "cms_blog_post_category" drop column if exists "id", drop column if exists "blog_post_id", drop column if exists "blog_category_id", drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "deleted_at";`);

    this.addSql(`alter table if exists "cms_blog_post_category" add column if not exists "cms_blog_post_id" text not null, add column if not exists "cms_blog_category_id" text not null;`);
    this.addSql(`alter table if exists "cms_blog_post_category" add constraint "cms_blog_post_category_cms_blog_post_id_foreign" foreign key ("cms_blog_post_id") references "cms_blog_post" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "cms_blog_post_category" add constraint "cms_blog_post_category_cms_blog_category_id_foreign" foreign key ("cms_blog_category_id") references "cms_blog_category" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "cms_blog_post_category" add constraint "cms_blog_post_category_pkey" primary key ("cms_blog_post_id", "cms_blog_category_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cms_blog_post_category" drop constraint if exists "cms_blog_post_category_cms_blog_post_id_foreign";`);
    this.addSql(`alter table if exists "cms_blog_post_category" drop constraint if exists "cms_blog_post_category_cms_blog_category_id_foreign";`);

    this.addSql(`alter table if exists "cms_blog_post_category" drop constraint if exists "cms_blog_post_category_pkey";`);
    this.addSql(`alter table if exists "cms_blog_post_category" drop column if exists "cms_blog_post_id", drop column if exists "cms_blog_category_id";`);

    this.addSql(`alter table if exists "cms_blog_post_category" add column if not exists "id" text not null, add column if not exists "blog_post_id" text not null, add column if not exists "blog_category_id" text not null, add column if not exists "created_at" timestamptz not null default now(), add column if not exists "updated_at" timestamptz not null default now(), add column if not exists "deleted_at" timestamptz null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_blog_post_id" ON "cms_blog_post_category" ("blog_post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_blog_category_id" ON "cms_blog_post_category" ("blog_category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_blog_post_category_deleted_at" ON "cms_blog_post_category" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`alter table if exists "cms_blog_post_category" add constraint "cms_blog_post_category_pkey" primary key ("id");`);
  }

}
