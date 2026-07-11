import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260709182618 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "call_center_phone_number" drop constraint if exists "cc_phone_e164_unique";`);
    this.addSql(`create table if not exists "call_center_phone_number" ("id" text not null, "tenant_id" text not null, "e164" text not null, "agent_id" text null, "provider" text check ("provider" in ('twilio')) not null default 'twilio', "label" text null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "call_center_phone_number_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_call_center_phone_number_deleted_at" ON "call_center_phone_number" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cc_phone_e164_unique" ON "call_center_phone_number" ("e164") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cc_phone_tenant_id" ON "call_center_phone_number" ("tenant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "call_center_phone_number" cascade;`);
  }

}
