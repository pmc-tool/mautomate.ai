import { Migration } from "@mikro-orm/migrations"

/**
 * Multi-store M3: allow the "transfer_out" credit-transaction type (the
 * between-own-stores purchased-credit transfer). Discovered live: the CHECK
 * constraint rejected the row mid-transfer. Idempotent drop-and-recreate.
 */
export class Migration20260727110000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`alter table if exists "credit_transaction" drop constraint if exists "credit_transaction_type_check";`)
    this.addSql(`alter table if exists "credit_transaction" add constraint "credit_transaction_type_check" check (type = any (array['grant','topup','reserve','commit','release','refund','clawback','adjust','transfer_out']));`)
  }

  async down(): Promise<void> {
    this.addSql(`alter table if exists "credit_transaction" drop constraint if exists "credit_transaction_type_check";`)
    this.addSql(`alter table if exists "credit_transaction" add constraint "credit_transaction_type_check" check (type = any (array['grant','topup','reserve','commit','release','refund','clawback','adjust']));`)
  }
}
