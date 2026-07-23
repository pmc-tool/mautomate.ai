import { Migration } from "@mikro-orm/migrations"

/**
 * Adds the "pending_payment" tenant status: a paid-plan signup whose card has
 * not been captured yet. The store stays offline until the payment webhook
 * flips it live. Idempotent: drops and re-creates the check constraint.
 */
export class Migration20260723120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_status_check";`)
    this.addSql(`alter table if exists "tenant" add constraint "tenant_status_check" check (status in ('provisioning', 'pending_payment', 'live', 'past_due', 'grace', 'suspended', 'retained', 'purged', 'failed'));`)
  }

  async down(): Promise<void> {
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_status_check";`)
    this.addSql(`alter table if exists "tenant" add constraint "tenant_status_check" check (status in ('provisioning', 'live', 'past_due', 'grace', 'suspended', 'retained', 'purged', 'failed'));`)
  }
}
