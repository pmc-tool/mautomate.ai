import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds call_center_knowledge (agent training material). Scoped to only the new
 * table — the other call_center_* tables already exist in this database, so a
 * full baseline would fail on re-adding existing FK constraints.
 */
export class Migration20260707105529 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "call_center_knowledge" ("id" text not null, "tenant_id" text not null, "agent_id" text not null, "name" text not null, "source_type" text check ("source_type" in ('faq', 'text', 'url', 'file', 'product_catalog')) not null default 'text', "content" text null, "url" text null, "embedding_ref" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "call_center_knowledge_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_call_center_knowledge_deleted_at" ON "call_center_knowledge" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_call_center_knowledge_tenant_id" ON "call_center_knowledge" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_call_center_knowledge_agent_id" ON "call_center_knowledge" ("agent_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "call_center_knowledge" cascade;`);
  }

}
