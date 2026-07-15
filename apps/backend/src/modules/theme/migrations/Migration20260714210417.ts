import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260714210417 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "theme_version" drop constraint if exists "theme_version_unique";`);
    this.addSql(`create table if not exists "theme" ("id" text not null, "handle" text not null, "name" text not null, "author" text null, "description" text null, "current_version" text null, "visibility" text not null default 'public', "status" text not null default 'draft', "uploaded_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "theme_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_theme_deleted_at" ON "theme" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_theme_handle" ON "theme" ("handle") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "theme_file" ("id" text not null, "theme_version_id" text not null, "path" text not null, "kind" text not null default 'text', "content" text not null, "content_type" text null, "size_bytes" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "theme_file_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_theme_file_deleted_at" ON "theme_file" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_theme_file_version_path" ON "theme_file" ("theme_version_id", "path") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "theme_version" ("id" text not null, "theme_id" text not null, "version" text not null, "manifest" jsonb not null, "warnings" jsonb null, "preview" text null, "size_bytes" integer not null default 0, "file_count" integer not null default 0, "uploaded_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "theme_version_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_theme_version_deleted_at" ON "theme_version" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_theme_version_unique" ON "theme_version" ("theme_id", "version") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "theme" cascade;`);

    this.addSql(`drop table if exists "theme_file" cascade;`);

    this.addSql(`drop table if exists "theme_version" cascade;`);
  }

}
