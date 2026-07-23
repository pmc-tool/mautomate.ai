import { Migration } from "@mikro-orm/migrations"

/** Merchant referral program: referral_code on merchant + merchant_referral table. */
export class Migration20260718100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "merchant" ADD COLUMN IF NOT EXISTS "referral_code" text NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_referral_code_unique" ON "merchant" ("referral_code") WHERE deleted_at IS NULL AND referral_code IS NOT NULL;`)

    this.addSql(`CREATE TABLE IF NOT EXISTS "merchant_referral" (
      "id" text NOT NULL,
      "referrer_tenant_id" text NOT NULL,
      "referrer_merchant_id" text NOT NULL,
      "referred_tenant_id" text NOT NULL,
      "code_used" text NULL,
      "status" text NOT NULL DEFAULT 'signed_up',
      "referee_bonus_credits" integer NOT NULL DEFAULT 0,
      "reward_credits" integer NOT NULL DEFAULT 0,
      "rewarded_at" timestamptz NULL,
      "meta" jsonb NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "merchant_referral_pkey" PRIMARY KEY ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_referral_referred_unique" ON "merchant_referral" ("referred_tenant_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merchant_referral_referrer" ON "merchant_referral" ("referrer_tenant_id") WHERE deleted_at IS NULL;`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "merchant_referral";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_merchant_referral_code_unique";`)
    this.addSql(`ALTER TABLE "merchant" DROP COLUMN IF EXISTS "referral_code";`)
  }
}
