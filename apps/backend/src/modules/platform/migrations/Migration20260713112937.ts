import { Migration } from "@mikro-orm/migrations"

/**
 * Money columns were INTEGER — so a $0.039 image cost was silently stored as 0,
 * making the margin dashboard blind. Credits stay integer on purpose (every
 * rate is a whole credit); only the USD cost columns need real decimals.
 */
export class Migration20260713112937 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `alter table if exists "usage_event"
         alter column "vendor_cost_usd" type numeric(14,6)
         using "vendor_cost_usd"::numeric;`
    )
    this.addSql(
      `alter table if exists "price_book_entry"
         alter column "vendor_cost_usd" type numeric(14,6)
         using "vendor_cost_usd"::numeric;`
    )
    this.addSql(
      `alter table if exists "usage_event"
         alter column "units" type numeric(14,2)
         using "units"::numeric;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`alter table if exists "usage_event" alter column "vendor_cost_usd" type integer using round("vendor_cost_usd");`)
    this.addSql(`alter table if exists "price_book_entry" alter column "vendor_cost_usd" type integer using round("vendor_cost_usd");`)
    this.addSql(`alter table if exists "usage_event" alter column "units" type integer using round("units");`)
  }
}
