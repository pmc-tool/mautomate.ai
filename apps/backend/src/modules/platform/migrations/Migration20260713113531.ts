import { Migration } from "@mikro-orm/migrations"

/**
 * credit_lot — credits tracked by WHERE THEY CAME FROM and WHETHER THEY EXPIRE.
 * Existing wallet balances are backfilled as a single "legacy" lot with NO
 * expiry: nobody's credits disappear because we changed the schema.
 */
export class Migration20260713113531 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "credit_lot" (
        "id" text not null,
        "tenant_id" text not null,
        "source" text check ("source" in ('plan','topup','trial','grant','legacy')) not null default 'grant',
        "amount" integer not null default 0,
        "remaining" integer not null default 0,
        "expires_at" timestamptz null,
        "meta" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "credit_lot_pkey" primary key ("id")
      );`)
    this.addSql(`create index if not exists "IDX_credit_lot_tenant_remaining"
      on "credit_lot" ("tenant_id","remaining") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_credit_lot_expires_at"
      on "credit_lot" ("expires_at") where "deleted_at" is null and "expires_at" is not null;`)
    // Backfill: whatever each wallet holds today becomes one never-expiring lot.
    this.addSql(`
      insert into "credit_lot" ("id","tenant_id","source","amount","remaining","expires_at","meta")
      select 'clot_legacy_' || replace(w."tenant_id",'ten_',''), w."tenant_id", 'legacy',
             w."balance", w."balance", null,
             '{"backfill":true}'::jsonb
        from "credit_wallet" w
       where w."balance" > 0
         and w."deleted_at" is null
         and not exists (select 1 from "credit_lot" l where l."tenant_id" = w."tenant_id");`)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "credit_lot" cascade;`)
  }
}
