import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds `key` to marketing_email_template so a row can act as a per-tenant
 * OVERRIDE of a fixed catalog template (order_confirmation, welcome, ...).
 * One override per (tenant_id, key).
 */
export class Migration20260711120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "marketing_email_template" ADD COLUMN IF NOT EXISTS "key" text NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_email_template_tenant_key" ON "marketing_email_template" ("tenant_id", "key") WHERE deleted_at IS NULL AND "key" IS NOT NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_marketing_email_template_tenant_key";`);
    this.addSql(`ALTER TABLE "marketing_email_template" DROP COLUMN IF EXISTS "key";`);
  }

}
