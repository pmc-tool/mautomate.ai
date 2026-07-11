import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703083535 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "domain" drop constraint if exists "domain_tenant_name_unique";`);
    this.addSql(`create table if not exists "domain" ("id" text not null, "tenant_id" text not null, "domain_name" text not null, "tld" text null, "status" text check ("status" in ('active', 'pending_register', 'pending_transfer', 'transferred_away', 'expired', 'failed', 'cancelled')) not null default 'pending_register', "source" text check ("source" in ('registered', 'transferred', 'added_existing')) not null default 'registered', "reseller_order_id" text null, "reseller_customer_id" text null, "reseller_contact_id" text null, "registration_date" timestamptz null, "expiry_date" timestamptz null, "auto_renew" boolean not null default false, "privacy_enabled" boolean not null default false, "locked" boolean not null default true, "nameservers" jsonb null, "years" integer null, "register_price" integer null, "currency" text null, "last_synced_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "domain_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_deleted_at" ON "domain" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_tenant_id" ON "domain" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_domain_tenant_name_unique" ON "domain" ("tenant_id", "domain_name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_tenant_status" ON "domain" ("tenant_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "domain_contact" ("id" text not null, "tenant_id" text not null, "name" text not null, "email" text not null, "phone" text null, "phone_country_code" text null, "company" text null, "address_line1" text null, "address_line2" text null, "city" text null, "state" text null, "postal_code" text null, "country" text null, "reseller_customer_id" text null, "reseller_contact_id" text null, "is_default" boolean not null default false, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "domain_contact_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_contact_deleted_at" ON "domain_contact" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_contact_tenant_id" ON "domain_contact" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "domain_order" ("id" text not null, "tenant_id" text not null, "domain_name" text not null, "tld" text null, "action" text check ("action" in ('register', 'transfer', 'renew', 'restore')) not null, "years" integer null, "price" integer null, "currency" text null, "status" text check ("status" in ('pending', 'processing', 'success', 'failed')) not null default 'pending', "reseller_order_id" text null, "reseller_action_id" text null, "reseller_status" text null, "error" text null, "created_by_user_id" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "domain_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_order_deleted_at" ON "domain_order" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_order_tenant_id" ON "domain_order" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_domain_order_tenant_domain" ON "domain_order" ("tenant_id", "domain_name") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "domain" cascade;`);

    this.addSql(`drop table if exists "domain_contact" cascade;`);

    this.addSql(`drop table if exists "domain_order" cascade;`);
  }

}
