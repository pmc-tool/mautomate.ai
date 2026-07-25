import { Migration } from "@mikro-orm/migrations"

/**
 * Allow the `theme_settings` cms_setting key — the merchant's saved values
 * for the active theme's theme.json settings schema (locale-invariant, like
 * active_theme). Shape: { value: { [themeHandle]: { [settingId]: value } } }.
 * Consumed by the storefront Liquid `settings` merge and checkout branding.
 */
export class Migration20260725120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `alter table if exists "cms_setting" drop constraint if exists "cms_setting_key_check";`
    )
    this.addSql(
      `alter table if exists "cms_setting" add constraint "cms_setting_key_check" check("key" in ('header', 'topbar', 'footer', 'theme', 'seo_defaults', 'active_theme', 'theme_settings'));`
    )
  }

  async down(): Promise<void> {
    this.addSql(
      `alter table if exists "cms_setting" drop constraint if exists "cms_setting_key_check";`
    )
    this.addSql(
      `alter table if exists "cms_setting" add constraint "cms_setting_key_check" check("key" in ('header', 'topbar', 'footer', 'theme', 'seo_defaults', 'active_theme'));`
    )
  }
}
