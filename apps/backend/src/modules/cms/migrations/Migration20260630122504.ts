import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630122504 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_page" add column if not exists "scheduled_at" timestamptz null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_page_scheduled_at" ON "cms_page" ("scheduled_at") WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_cms_page_scheduled_at";`);
    this.addSql(`alter table if exists "cms_page" drop column if exists "scheduled_at";`);
  }

}
