import { Migration } from "@mikro-orm/migrations"

/**
 * Push-notification scaffolding: the merchant_device table that stores FCM
 * registration tokens per merchant user. Registered by the mAutomate merchant
 * app after sign-in; consumed by the (gated, off-by-default) push notifier.
 *
 * Purely additive — creating one new table with IF NOT EXISTS guards. Safe to
 * run on the live pooled backend; nothing reads or writes it until the app
 * starts registering devices and PUSH_ENABLED is turned on.
 */
export class Migration20260717130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "merchant_device" (
      "id" text NOT NULL,
      "tenant_id" text NOT NULL,
      "merchant_id" text NOT NULL,
      "token" text NOT NULL,
      "platform" text NOT NULL DEFAULT 'android',
      "app_version" text NULL,
      "device_name" text NULL,
      "last_seen_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "merchant_device_pkey" PRIMARY KEY ("id")
    );`)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_device_token_unique" ON "merchant_device" ("token") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_merchant_device_merchant" ON "merchant_device" ("merchant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_merchant_device_tenant" ON "merchant_device" ("tenant_id") WHERE deleted_at IS NULL;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "merchant_device";`)
  }
}
