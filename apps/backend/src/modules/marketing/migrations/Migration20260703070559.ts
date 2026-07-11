import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703070559 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketing_cart_recovery" drop constraint if exists "marketing_cart_recovery_cart_unique";`);
    this.addSql(`create table if not exists "marketing_cart_recovery" ("id" text not null, "tenant_id" text not null, "cart_id" text not null, "contact_id" text null, "email" text not null, "customer_id" text null, "step" integer not null default 0, "status" text check ("status" in ('active', 'processing', 'recovered', 'completed', 'canceled', 'failed')) not null default 'active', "next_run_at" timestamptz null, "attempts" integer not null default 0, "max_attempts" integer not null default 3, "discount_code" text null, "last_email_send_id" text null, "cart_total" integer null, "currency_code" text null, "recovered_at" timestamptz null, "error" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_cart_recovery_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_cart_recovery_deleted_at" ON "marketing_cart_recovery" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_cart_recovery_tenant_id" ON "marketing_cart_recovery" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_cart_recovery_cart_unique" ON "marketing_cart_recovery" ("tenant_id", "cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_cart_recovery_tenant_status_next" ON "marketing_cart_recovery" ("tenant_id", "status", "next_run_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_cart_recovery" cascade;`);
  }

}
