import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630134105 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_user_role" drop constraint if exists "cms_user_role_user_id_unique";`);
    this.addSql(`create table if not exists "cms_user_role" ("id" text not null, "user_id" text not null, "role" text check ("role" in ('admin', 'editor', 'viewer')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_user_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_user_role_deleted_at" ON "cms_user_role" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_user_role_user_id_unique" ON "cms_user_role" ("user_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cms_user_role" cascade;`);
  }

}
