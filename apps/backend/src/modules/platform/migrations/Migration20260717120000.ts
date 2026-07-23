import { Migration } from "@mikro-orm/migrations"

/** Partner program: payout method on partner + referral/commission/payout tables. */
export class Migration20260717120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "payout_method" text NULL;`)

    this.addSql(`CREATE TABLE IF NOT EXISTS "partner_referral" (
      "id" text NOT NULL,
      "partner_id" text NOT NULL,
      "tenant_id" text NOT NULL,
      "code_used" text NULL,
      "meta" jsonb NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "partner_referral_pkey" PRIMARY KEY ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_partner_referral_tenant_unique" ON "partner_referral" ("tenant_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partner_referral_partner" ON "partner_referral" ("partner_id") WHERE deleted_at IS NULL;`)

    this.addSql(`CREATE TABLE IF NOT EXISTS "partner_commission" (
      "id" text NOT NULL,
      "partner_id" text NOT NULL,
      "tenant_id" text NOT NULL,
      "source" text NOT NULL,
      "source_ref" text NULL,
      "base_cents" integer NOT NULL DEFAULT 0,
      "pct" integer NOT NULL DEFAULT 0,
      "amount_cents" integer NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'pending',
      "payout_id" text NULL,
      "meta" jsonb NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "partner_commission_pkey" PRIMARY KEY ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_partner_commission_source_unique" ON "partner_commission" ("source_ref") WHERE deleted_at IS NULL AND source_ref IS NOT NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partner_commission_partner" ON "partner_commission" ("partner_id") WHERE deleted_at IS NULL;`)

    this.addSql(`CREATE TABLE IF NOT EXISTS "partner_payout" (
      "id" text NOT NULL,
      "partner_id" text NOT NULL,
      "amount_cents" integer NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'requested',
      "method" text NULL,
      "note" text NULL,
      "paid_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "partner_payout_pkey" PRIMARY KEY ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partner_payout_partner" ON "partner_payout" ("partner_id") WHERE deleted_at IS NULL;`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "partner_payout";`)
    this.addSql(`DROP TABLE IF EXISTS "partner_commission";`)
    this.addSql(`DROP TABLE IF EXISTS "partner_referral";`)
    this.addSql(`ALTER TABLE "partner" DROP COLUMN IF EXISTS "payout_method";`)
  }
}
