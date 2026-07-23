import { Migration } from "@mikro-orm/migrations"

/** Mobile App white-label feature: mobile_app_order table (build + publish orders). */
export class Migration20260719120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "mobile_app_order" (
      "id" text NOT NULL,
      "tenant_id" text NOT NULL,
      "kind" text NOT NULL,
      "tier" text NULL,
      "regular_price_usd" numeric NULL,
      "expected_amount_usd" numeric NULL,
      "amount_paid_usd" numeric NULL,
      "status" text NOT NULL DEFAULT 'queued',
      "download_url" text NULL,
      "stripe_event_id" text NULL,
      "config_snapshot" jsonb NULL,
      "meta" jsonb NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "mobile_app_order_pkey" PRIMARY KEY ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mobile_app_order_tenant" ON "mobile_app_order" ("tenant_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mobile_app_order_kind" ON "mobile_app_order" ("tenant_id", "kind") WHERE deleted_at IS NULL;`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "mobile_app_order";`)
  }
}
