import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260706063534 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "merchant" add column if not exists "mfa_enabled" boolean not null default false, add column if not exists "mfa_secret_encrypted" text null, add column if not exists "mfa_backup_codes_hash" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "merchant" drop column if exists "mfa_enabled", drop column if exists "mfa_secret_encrypted", drop column if exists "mfa_backup_codes_hash";`);
  }

}
