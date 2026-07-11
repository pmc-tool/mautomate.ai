import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630101319 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cms_media_folder" ("id" text not null, "name" text not null, "path" text not null, "parent_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_media_folder_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_folder_parent_id" ON "cms_media_folder" ("parent_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_folder_deleted_at" ON "cms_media_folder" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cms_media" ("id" text not null, "file_id" text not null, "url" text not null, "original_filename" text not null, "filename" text not null, "mime_type" text not null, "size" integer not null, "width" integer null, "height" integer null, "checksum" text null, "alt" jsonb null, "title" jsonb null, "folder_id" text null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_media_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_folder_id" ON "cms_media" ("folder_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_deleted_at" ON "cms_media" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_file_id" ON "cms_media" ("file_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_media_checksum" ON "cms_media" ("checksum") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "cms_media_folder" add constraint "cms_media_folder_parent_id_foreign" foreign key ("parent_id") references "cms_media_folder" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "cms_media" add constraint "cms_media_folder_id_foreign" foreign key ("folder_id") references "cms_media_folder" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cms_media_folder" drop constraint if exists "cms_media_folder_parent_id_foreign";`);

    this.addSql(`alter table if exists "cms_media" drop constraint if exists "cms_media_folder_id_foreign";`);

    this.addSql(`drop table if exists "cms_media_folder" cascade;`);

    this.addSql(`drop table if exists "cms_media" cascade;`);
  }

}
