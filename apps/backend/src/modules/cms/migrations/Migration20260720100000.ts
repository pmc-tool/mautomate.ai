import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Phase 4C (ARCH-UX U5) — presets ride the cms_template store.
 *
 * - `scope` gains the value "preset". The column is plain `text` with NO
 *   check constraint (see Migration20260711160000) — the ["page","section",
 *   "preset"] enum is enforced at the ORM/model layer only, so no column
 *   alter is needed for the new value.
 * - `widget_type` (nullable text): per-widget preset key, mirrors
 *   `data.blockType`. NULL = preset applies to any widget type.
 * - Composite partial index (tenant_id, scope): the GET ?scope= filter and
 *   the per-widget apply dropdown both list one tenant's rows of one scope.
 *
 * Everything is IF NOT EXISTS so re-running (or a prior manual apply of the
 * same SQL) is a no-op. Additive only: existing rows keep scope untouched
 * and get widget_type NULL.
 */
export class Migration20260720100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_template" add column if not exists "widget_type" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cms_template_tenant_scope" ON "cms_template" ("tenant_id", "scope") WHERE deleted_at IS NULL;`);
  }
  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_cms_template_tenant_scope";`);
    this.addSql(`alter table if exists "cms_template" drop column if exists "widget_type";`);
  }
}
