import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703100254 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tenant_key" drop constraint if exists "tenant_key_active_unique";`);
    this.addSql(`alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_unique";`);
    this.addSql(`alter table if exists "tenant_config" drop constraint if exists "tenant_config_key_unique";`);
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_slug_unique";`);
    this.addSql(`create table if not exists "provisioning_job" ("id" text not null, "tenant_id" text not null, "transaction_id" text null, "status" text check ("status" in ('pending', 'running', 'completed', 'failed', 'compensating', 'compensated')) not null default 'pending', "current_step" text null, "steps" jsonb null, "attempts" integer not null default 0, "last_error" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "provisioning_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_provisioning_job_deleted_at" ON "provisioning_job" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_provisioning_job_tenant" ON "provisioning_job" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_provisioning_job_txn" ON "provisioning_job" ("transaction_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant" ("id" text not null, "slug" text not null, "name" text not null, "package" text check ("package" in ('free_trial', 'starter', 'growth', 'pro', 'scale')) not null default 'free_trial', "status" text check ("status" in ('provisioning', 'live', 'past_due', 'grace', 'suspended', 'retained', 'purged', 'failed')) not null default 'provisioning', "billing_country" text null, "db_name" text null, "backend_url" text null, "container_ref" text null, "region" text null, "publishable_key" text null, "credit_balance" numeric not null default 0, "trial_ends_at" timestamptz null, "suspended_at" timestamptz null, "retained_until" timestamptz null, "provisioned_at" timestamptz null, "meta" jsonb null, "raw_credit_balance" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_deleted_at" ON "tenant" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_slug_unique" ON "tenant" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_status" ON "tenant" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_config" ("id" text not null, "tenant_id" text not null, "key" text not null, "is_secret" boolean not null default false, "value_sealed" text null, "value_plain" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_config_deleted_at" ON "tenant_config" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_config_key_unique" ON "tenant_config" ("tenant_id", "key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_config_tenant" ON "tenant_config" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_domain" ("id" text not null, "tenant_id" text not null, "domain" text not null, "type" text check ("type" in ('free', 'custom')) not null default 'free', "is_primary" boolean not null default false, "cf_hostname_id" text null, "ssl_status" text check ("ssl_status" in ('pending', 'active', 'failed')) not null default 'pending', "verification_status" text check ("verification_status" in ('pending', 'verified', 'failed')) not null default 'pending', "verification" jsonb null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_domain_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_deleted_at" ON "tenant_domain" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_domain_unique" ON "tenant_domain" ("domain") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_tenant" ON "tenant_domain" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_key" ("id" text not null, "tenant_id" text not null, "wrapped_dek" text not null, "key_version" integer not null default 1, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_key_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_key_deleted_at" ON "tenant_key" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_key_active_unique" ON "tenant_key" ("tenant_id") WHERE deleted_at IS NULL AND active = true;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "provisioning_job" cascade;`);

    this.addSql(`drop table if exists "tenant" cascade;`);

    this.addSql(`drop table if exists "tenant_config" cascade;`);

    this.addSql(`drop table if exists "tenant_domain" cascade;`);

    this.addSql(`drop table if exists "tenant_key" cascade;`);
  }

}
