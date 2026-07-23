import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Phone-number buy flow: allow provider 'vonage', and record the carrier-side
 * id + country for numbers purchased through the platform (needed to release
 * the DID at the carrier on delete; Vonage buy/cancel also require country).
 */
export class Migration20260717060000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `alter table if exists "call_center_phone_number" drop constraint if exists "call_center_phone_number_provider_check";`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" add constraint "call_center_phone_number_provider_check" check ("provider" in ('twilio', 'vonage'));`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" add column if not exists "provider_number_id" text null;`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" add column if not exists "country" text null;`
    )
  }

  async down(): Promise<void> {
    this.addSql(
      `alter table if exists "call_center_phone_number" drop column if exists "provider_number_id";`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" drop column if exists "country";`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" drop constraint if exists "call_center_phone_number_provider_check";`
    )
    this.addSql(
      `alter table if exists "call_center_phone_number" add constraint "call_center_phone_number_provider_check" check ("provider" in ('twilio'));`
    )
  }
}
