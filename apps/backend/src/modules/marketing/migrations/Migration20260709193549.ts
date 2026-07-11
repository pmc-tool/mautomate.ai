import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260709193549 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_platform_credential" ("id" text not null, "key" text not null, "value_enc" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_platform_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_platform_credential_deleted_at" ON "marketing_platform_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_platform_credential_key" ON "marketing_platform_credential" ("key") WHERE deleted_at IS NULL;`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_account_platform_external" ON "marketing_social_account" ("platform", "external_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_platform_credential" cascade;`);

    this.addSql(`drop index if exists "IDX_marketing_social_account_platform_external";`);
  }

}
