import { Migration } from "@mikro-orm/migrations"

/**
 * Multi-store M0: merchant_store ownership link table + backfill.
 *
 * Every existing merchant gets exactly one row from its historical
 * merchant.tenant_id, so the 1:1 world is represented losslessly and the
 * feature can ship dark. Idempotent: create-if-missing + upsert-style
 * backfill (ON CONFLICT DO NOTHING against the unique live index).
 */
export class Migration20260727100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "merchant_store" (
        "id" text not null,
        "merchant_id" text not null,
        "tenant_id" text not null,
        "role" text not null default 'owner',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "merchant_store_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "IDX_merchant_store_unique"
        on "merchant_store" ("merchant_id", "tenant_id")
        where "deleted_at" is null;
    `)
    this.addSql(`
      create index if not exists "IDX_merchant_store_merchant"
        on "merchant_store" ("merchant_id") where "deleted_at" is null;
    `)
    this.addSql(`
      create index if not exists "IDX_merchant_store_tenant"
        on "merchant_store" ("tenant_id") where "deleted_at" is null;
    `)
    this.addSql(`
      insert into "merchant_store" ("id", "merchant_id", "tenant_id", "role")
      select 'mstore_' || substr(md5(m.id || m.tenant_id), 1, 20), m.id, m.tenant_id, 'owner'
        from "merchant" m
       where m.deleted_at is null
         and not exists (
           select 1 from "merchant_store" ms
            where ms.merchant_id = m.id
              and ms.tenant_id = m.tenant_id
              and ms.deleted_at is null
         );
    `)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "merchant_store";`)
  }
}
