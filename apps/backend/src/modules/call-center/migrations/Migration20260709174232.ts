import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260709174232 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "call_center_knowledge_chunk" ("id" text not null, "tenant_id" text not null, "agent_id" text not null, "knowledge_id" text not null, "content" text not null, "embedding" text not null, "embedding_model" text null, "dim" integer null, "seq" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "call_center_knowledge_chunk_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_call_center_knowledge_chunk_deleted_at" ON "call_center_knowledge_chunk" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cc_knowledge_chunk_tenant_id" ON "call_center_knowledge_chunk" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cc_knowledge_chunk_agent_id" ON "call_center_knowledge_chunk" ("agent_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cc_knowledge_chunk_knowledge_id" ON "call_center_knowledge_chunk" ("knowledge_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "call_center_knowledge_chunk" cascade;`);
  }

}
