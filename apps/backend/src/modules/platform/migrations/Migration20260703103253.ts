import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703103253 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "credit_wallet" drop constraint if exists "credit_wallet_tenant_unique";`);
    this.addSql(`alter table if exists "credit_transaction" drop constraint if exists "credit_txn_idem_unique";`);
    this.addSql(`create table if not exists "credit_reservation" ("id" text not null, "tenant_id" text not null, "amount" integer not null, "action" text null, "status" text check ("status" in ('open', 'committed', 'released')) not null default 'open', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "credit_reservation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_reservation_deleted_at" ON "credit_reservation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_reservation_open" ON "credit_reservation" ("tenant_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "credit_transaction" ("id" text not null, "tenant_id" text not null, "type" text check ("type" in ('grant', 'topup', 'reserve', 'commit', 'release', 'refund', 'clawback', 'adjust')) not null, "amount" integer not null, "balance_after" integer null, "reservation_id" text null, "idempotency_key" text null, "action" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "credit_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_transaction_deleted_at" ON "credit_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_credit_txn_idem_unique" ON "credit_transaction" ("tenant_id", "idempotency_key") WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_txn_reservation" ON "credit_transaction" ("reservation_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_txn_tenant" ON "credit_transaction" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "credit_wallet" ("id" text not null, "tenant_id" text not null, "balance" integer not null default 0, "reserved" integer not null default 0, "currency" text not null default 'credit', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "credit_wallet_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_wallet_deleted_at" ON "credit_wallet" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_credit_wallet_tenant_unique" ON "credit_wallet" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "usage_event" ("id" text not null, "tenant_id" text not null, "action" text not null, "units" integer not null default 1, "credits" integer not null default 0, "reservation_id" text null, "vendor_cost_usd" integer null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "usage_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_usage_event_deleted_at" ON "usage_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_usage_event_tenant_action" ON "usage_event" ("tenant_id", "action") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "credit_reservation" cascade;`);

    this.addSql(`drop table if exists "credit_transaction" cascade;`);

    this.addSql(`drop table if exists "credit_wallet" cascade;`);

    this.addSql(`drop table if exists "usage_event" cascade;`);
  }

}
