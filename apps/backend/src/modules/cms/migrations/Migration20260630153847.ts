import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630153847 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cms_setting" drop constraint if exists "cms_setting_key_check";`);

    this.addSql(`alter table if exists "cms_setting" add constraint "cms_setting_key_check" check("key" in ('header', 'topbar', 'footer', 'theme', 'seo_defaults', 'active_theme'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cms_setting" drop constraint if exists "cms_setting_key_check";`);

    this.addSql(`alter table if exists "cms_setting" add constraint "cms_setting_key_check" check("key" in ('header', 'topbar', 'footer', 'theme', 'seo_defaults'));`);
  }

}
