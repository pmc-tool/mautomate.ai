import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703065110 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketing_suppression" drop constraint if exists "marketing_suppression_tenant_email_unique";`);
    this.addSql(`alter table if exists "marketing_email_send" drop constraint if exists "marketing_email_send_token_unique";`);
    this.addSql(`create table if not exists "marketing_email_send" ("id" text not null, "tenant_id" text not null, "contact_id" text null, "template_id" text null, "journey_enrollment_id" text null, "campaign_id" text null, "to_email" text not null, "subject" text null, "status" text check ("status" in ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed')) not null default 'queued', "token" text not null, "provider" text null, "external_message_id" text null, "error" text null, "open_count" integer not null default 0, "click_count" integer not null default 0, "sent_at" timestamptz null, "delivered_at" timestamptz null, "opened_at" timestamptz null, "clicked_at" timestamptz null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_email_send_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_send_deleted_at" ON "marketing_email_send" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_send_tenant_id" ON "marketing_email_send" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_email_send_token_unique" ON "marketing_email_send" ("token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_send_tenant_contact" ON "marketing_email_send" ("tenant_id", "contact_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_send_tenant_status" ON "marketing_email_send" ("tenant_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_email_template" ("id" text not null, "tenant_id" text not null, "name" text not null, "subject" text null, "preheader" text null, "html" text null, "kind" text check ("kind" in ('broadcast', 'transactional', 'journey', 'recovery')) not null default 'broadcast', "from_name" text null, "from_email" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_email_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_template_deleted_at" ON "marketing_email_template" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_template_tenant_id" ON "marketing_email_template" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_email_template_tenant_kind" ON "marketing_email_template" ("tenant_id", "kind") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_suppression" ("id" text not null, "tenant_id" text not null, "email" text not null, "reason" text check ("reason" in ('unsubscribe', 'bounce', 'complaint', 'manual')) not null default 'unsubscribe', "source" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_suppression_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_suppression_deleted_at" ON "marketing_suppression" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_suppression_tenant_id" ON "marketing_suppression" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_suppression_tenant_email_unique" ON "marketing_suppression" ("tenant_id", "email") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "marketing_contact" add column if not exists "score" integer not null default 0, add column if not exists "consent_at" timestamptz null, add column if not exists "unsubscribed_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_email_send" cascade;`);

    this.addSql(`drop table if exists "marketing_email_template" cascade;`);

    this.addSql(`drop table if exists "marketing_suppression" cascade;`);

    this.addSql(`alter table if exists "marketing_contact" drop column if exists "score", drop column if exists "consent_at", drop column if exists "unsubscribed_at";`);
  }

}
