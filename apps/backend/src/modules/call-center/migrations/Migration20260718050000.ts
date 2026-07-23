import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Transfer-to-human: the live ring-the-team request rows. */
export class Migration20260718050000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "call_center_transfer" (
        "id" text not null,
        "tenant_id" text not null,
        "call_id" text not null,
        "status" text check ("status" in ('ringing', 'answered', 'declined', 'missed', 'canceled')) not null default 'ringing',
        "channel" text check ("channel" in ('web', 'phone')) not null default 'web',
        "room_url" text null,
        "room_name" text null,
        "caller_number" text null,
        "answered_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "call_center_transfer_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "IDX_cc_transfer_tenant_status" on "call_center_transfer" ("tenant_id", "status") where "deleted_at" is null;`
    )
    this.addSql(
      `create index if not exists "IDX_cc_transfer_call" on "call_center_transfer" ("call_id") where "deleted_at" is null;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "call_center_transfer" cascade;`)
  }
}
