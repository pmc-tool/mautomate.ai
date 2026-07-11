import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260702225914 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketing_webhook_event" drop constraint if exists "marketing_webhook_event_external_event_id_unique";`);
    this.addSql(`alter table if exists "marketing_social_account" drop constraint if exists "marketing_social_account_tenant_platform_external_unique";`);
    this.addSql(`alter table if exists "marketing_setting" drop constraint if exists "marketing_setting_tenant_key_unique";`);
    this.addSql(`alter table if exists "marketing_post_revision" drop constraint if exists "marketing_post_revision_tenant_post_version_unique";`);
    this.addSql(`alter table if exists "marketing_oauth_state" drop constraint if exists "marketing_oauth_state_state_unique";`);
    this.addSql(`alter table if exists "marketing_message" drop constraint if exists "marketing_message_external_message_id_unique";`);
    this.addSql(`alter table if exists "marketing_conversation" drop constraint if exists "marketing_conversation_tenant_channel_thread_unique";`);
    this.addSql(`alter table if exists "marketing_chatbot" drop constraint if exists "marketing_chatbot_public_key_unique";`);
    this.addSql(`alter table if exists "marketing_agent_role" drop constraint if exists "marketing_agent_role_tenant_user_unique";`);
    this.addSql(`create table if not exists "marketing_agent" ("id" text not null, "tenant_id" text not null, "name" text not null, "kind" text check ("kind" in ('content', 'social', 'inbox', 'seo')) not null default 'content', "instructions" text null, "model" text null, "brand_voice_id" text null, "playbook" jsonb null, "tools" jsonb null, "current_version_id" text null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_agent_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_deleted_at" ON "marketing_agent" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_tenant_id" ON "marketing_agent" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_agent_role" ("id" text not null, "tenant_id" text not null, "user_id" text not null, "role" text check ("role" in ('admin', 'manager', 'agent')) not null default 'agent', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_agent_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_role_deleted_at" ON "marketing_agent_role" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_role_tenant_id" ON "marketing_agent_role" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_agent_role_tenant_user_unique" ON "marketing_agent_role" ("tenant_id", "user_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_agent_version" ("id" text not null, "tenant_id" text not null, "version" integer not null, "definition" jsonb not null, "published" boolean not null default false, "agent_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_agent_version_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_version_agent_id" ON "marketing_agent_version" ("agent_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_version_deleted_at" ON "marketing_agent_version" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_agent_version_tenant_id" ON "marketing_agent_version" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_blog_article" ("id" text not null, "tenant_id" text not null, "cms_blog_post_id" text null, "brief_id" text null, "title" text null, "status" text check ("status" in ('draft', 'review', 'published')) not null default 'draft', "seo_score" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_blog_article_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_blog_article_deleted_at" ON "marketing_blog_article" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_blog_article_tenant_id" ON "marketing_blog_article" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_brand_voice" ("id" text not null, "tenant_id" text not null, "name" text not null, "tone" jsonb null, "do_rules" jsonb null, "dont_rules" jsonb null, "sample_copy" text null, "language" text not null default 'en', "is_default" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_brand_voice_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_brand_voice_deleted_at" ON "marketing_brand_voice" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_brand_voice_tenant_id" ON "marketing_brand_voice" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_campaign" ("id" text not null, "tenant_id" text not null, "name" text not null, "objective" text null, "status" text check ("status" in ('draft', 'active', 'paused', 'completed')) not null default 'draft', "starts_at" timestamptz null, "ends_at" timestamptz null, "product_ids" jsonb null, "channel_mix" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_deleted_at" ON "marketing_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_tenant_id" ON "marketing_campaign" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_chatbot" ("id" text not null, "tenant_id" text not null, "name" text not null, "greeting" text null, "agent_id" text null, "channel_config" jsonb null, "public_key" text null, "reply_mode" text check ("reply_mode" in ('draft', 'auto')) not null default 'draft', "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_chatbot_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_deleted_at" ON "marketing_chatbot" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_tenant_id" ON "marketing_chatbot" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_chatbot_public_key_unique" ON "marketing_chatbot" ("public_key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_chatbot_data" ("id" text not null, "tenant_id" text not null, "kind" text check ("kind" in ('faq', 'url', 'product_catalog', 'file', 'blog')) not null, "content" text null, "source" text null, "embedding_ref" text null, "chatbot_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_chatbot_data_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_data_chatbot_id" ON "marketing_chatbot_data" ("chatbot_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_data_deleted_at" ON "marketing_chatbot_data" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_data_tenant_id" ON "marketing_chatbot_data" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_contact" ("id" text not null, "tenant_id" text not null, "display_name" text null, "avatar_url" text null, "primary_channel" text null, "customer_id" text null, "phone" text null, "email" text null, "tags" jsonb null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_contact_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_contact_deleted_at" ON "marketing_contact" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_contact_tenant_id" ON "marketing_contact" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_contact_tenant_customer" ON "marketing_contact" ("tenant_id", "customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_content_brief" ("id" text not null, "tenant_id" text not null, "seo_project_id" text null, "keyword_id" text null, "outline" jsonb null, "status" text check ("status" in ('draft', 'ready', 'used')) not null default 'draft', "generated_by_agent_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_content_brief_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_content_brief_deleted_at" ON "marketing_content_brief" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_content_brief_tenant_id" ON "marketing_content_brief" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_conversation" ("id" text not null, "tenant_id" text not null, "contact_id" text null, "channel" text check ("channel" in ('whatsapp', 'messenger', 'telegram', 'instagram', 'web_widget', 'email', 'review')) not null, "external_thread_id" text null, "status" text check ("status" in ('open', 'snoozed', 'closed')) not null default 'open', "assigned_user_id" text null, "agent_id" text null, "last_message_at" timestamptz null, "unread_count" integer not null default 0, "starred" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_conversation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_conversation_deleted_at" ON "marketing_conversation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_conversation_tenant_id" ON "marketing_conversation" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_conversation_tenant_status_last_message" ON "marketing_conversation" ("tenant_id", "status", "last_message_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_conversation_tenant_channel_thread_unique" ON "marketing_conversation" ("tenant_id", "channel", "external_thread_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_generated_image" ("id" text not null, "tenant_id" text not null, "prompt" text null, "provider" text null, "file_id" text null, "url" text null, "product_id" text null, "params" jsonb null, "agent_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_generated_image_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_generated_image_deleted_at" ON "marketing_generated_image" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_generated_image_tenant_id" ON "marketing_generated_image" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_keyword" ("id" text not null, "tenant_id" text not null, "seo_project_id" text null, "term" text not null, "intent" text null, "volume" integer null, "difficulty" integer null, "status" text check ("status" in ('tracked', 'targeted', 'ranking')) not null default 'tracked', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_keyword_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_keyword_deleted_at" ON "marketing_keyword" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_keyword_tenant_id" ON "marketing_keyword" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_keyword_tenant_project" ON "marketing_keyword" ("tenant_id", "seo_project_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_message" ("id" text not null, "tenant_id" text not null, "conversation_id" text not null, "direction" text check ("direction" in ('inbound', 'outbound')) not null, "author" text check ("author" in ('contact', 'agent', 'ai', 'system')) not null, "body" text null, "media" jsonb null, "external_message_id" text null, "delivery_status" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_message_deleted_at" ON "marketing_message" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_message_tenant_id" ON "marketing_message" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_message_tenant_conversation_sent" ON "marketing_message" ("tenant_id", "conversation_id", "sent_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_message_external_message_id_unique" ON "marketing_message" ("external_message_id") WHERE external_message_id IS NOT NULL AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_oauth_state" ("id" text not null, "tenant_id" text not null, "state" text not null, "platform" text not null, "user_id" text null, "code_verifier_enc" text null, "redirect_uri" text null, "expires_at" timestamptz null, "consumed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_oauth_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_oauth_state_deleted_at" ON "marketing_oauth_state" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_oauth_state_state_unique" ON "marketing_oauth_state" ("state") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_oauth_state_tenant_expires" ON "marketing_oauth_state" ("tenant_id", "expires_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_post" ("id" text not null, "tenant_id" text not null, "status" text check ("status" in ('draft', 'needs_approval', 'scheduled', 'publishing', 'published', 'partially_published', 'failed')) not null default 'draft', "title" text null, "body" text null, "hashtags" jsonb null, "link_url" text null, "product_ids" jsonb null, "campaign_id" text null, "brand_voice_id" text null, "agent_id" text null, "created_by_user_id" text null, "source" text check ("source" in ('manual', 'agent', 'product_widget', 'automation')) not null default 'manual', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_post_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_deleted_at" ON "marketing_post" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_tenant_id" ON "marketing_post" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_tenant_status" ON "marketing_post" ("tenant_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_post_media" ("id" text not null, "tenant_id" text not null, "kind" text check ("kind" in ('image', 'video')) not null, "file_id" text null, "url" text null, "alt" text null, "width" integer null, "height" integer null, "duration" integer null, "position" integer not null default 0, "post_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_post_media_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_media_post_id" ON "marketing_post_media" ("post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_media_deleted_at" ON "marketing_post_media" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_media_tenant_id" ON "marketing_post_media" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_post_revision" ("id" text not null, "tenant_id" text not null, "version" integer not null, "snapshot" jsonb null, "created_by_user_id" text null, "post_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_post_revision_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_revision_post_id" ON "marketing_post_revision" ("post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_revision_deleted_at" ON "marketing_post_revision" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_revision_tenant_id" ON "marketing_post_revision" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_post_revision_tenant_post_version_unique" ON "marketing_post_revision" ("tenant_id", "post_id", "version") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_post_target" ("id" text not null, "tenant_id" text not null, "platform" text not null, "social_account_id" text null, "status" text check ("status" in ('pending', 'scheduled', 'publishing', 'published', 'failed')) not null default 'pending', "override_body" text null, "override_hashtags" jsonb null, "scheduled_at" timestamptz null, "published_at" timestamptz null, "external_post_id" text null, "external_url" text null, "attempts" integer not null default 0, "max_attempts" integer not null default 3, "next_retry_at" timestamptz null, "error" text null, "post_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_post_target_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_target_post_id" ON "marketing_post_target" ("post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_target_deleted_at" ON "marketing_post_target" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_target_tenant_id" ON "marketing_post_target" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_post_target_claim_sweep" ON "marketing_post_target" ("tenant_id", "status", "scheduled_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_schedule" ("id" text not null, "tenant_id" text not null, "name" text not null, "timezone" text not null default 'UTC', "slots" jsonb null, "platform_filter" jsonb null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_schedule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_schedule_deleted_at" ON "marketing_schedule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_schedule_tenant_id" ON "marketing_schedule" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_seo_project" ("id" text not null, "tenant_id" text not null, "name" text not null, "domain" text null, "target_locale" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_seo_project_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_seo_project_deleted_at" ON "marketing_seo_project" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_seo_project_tenant_id" ON "marketing_seo_project" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_setting" ("id" text not null, "tenant_id" text not null, "key" text not null, "value" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_setting_deleted_at" ON "marketing_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_setting_tenant_key_unique" ON "marketing_setting" ("tenant_id", "key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_social_account" ("id" text not null, "tenant_id" text not null, "platform" text check ("platform" in ('facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'x', 'wordpress', 'pinterest', 'threads', 'telegram')) not null, "external_id" text null, "handle" text null, "display_name" text null, "avatar_url" text null, "scopes" jsonb null, "status" text check ("status" in ('connected', 'expired', 'revoked', 'error')) not null default 'connected', "connected_by_user_id" text null, "meta" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_social_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_account_deleted_at" ON "marketing_social_account" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_account_tenant_id" ON "marketing_social_account" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_account_tenant_platform_status" ON "marketing_social_account" ("tenant_id", "platform", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_social_account_tenant_platform_external_unique" ON "marketing_social_account" ("tenant_id", "platform", "external_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_social_credential" ("id" text not null, "tenant_id" text not null, "social_account_id" text not null, "access_token_enc" text null, "refresh_token_enc" text null, "token_type" text null, "expires_at" timestamptz null, "sealed_alg" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_social_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_credential_deleted_at" ON "marketing_social_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_credential_tenant_id" ON "marketing_social_credential" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_social_credential_tenant_account" ON "marketing_social_credential" ("tenant_id", "social_account_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_stat" ("id" text not null, "tenant_id" text not null, "subject_type" text check ("subject_type" in ('post_target', 'conversation', 'campaign', 'agent', 'post')) not null, "subject_id" text not null, "platform" text null, "metric" text check ("metric" in ('impressions', 'reach', 'likes', 'comments', 'shares', 'clicks', 'replies', 'conversions', 'revenue')) not null, "value" integer not null default 0, "captured_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_stat_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_stat_deleted_at" ON "marketing_stat" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_stat_tenant_id" ON "marketing_stat" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_stat_tenant_subject_captured" ON "marketing_stat" ("tenant_id", "subject_type", "subject_id", "captured_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_video_project" ("id" text not null, "tenant_id" text not null, "title" text null, "status" text check ("status" in ('draft', 'rendering', 'ready', 'failed')) not null default 'draft', "aspect_ratio" text null, "provider" text null, "output_file_id" text null, "params" jsonb null, "product_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_video_project_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_project_deleted_at" ON "marketing_video_project" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_project_tenant_id" ON "marketing_video_project" ("tenant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_video_scene" ("id" text not null, "tenant_id" text not null, "position" integer not null default 0, "script" text null, "image_file_id" text null, "voiceover_file_id" text null, "duration" integer null, "project_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_video_scene_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_scene_project_id" ON "marketing_video_scene" ("project_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_scene_deleted_at" ON "marketing_video_scene" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_scene_tenant_id" ON "marketing_video_scene" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_video_scene_tenant_project_position" ON "marketing_video_scene" ("tenant_id", "project_id", "position") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_webhook_event" ("id" text not null, "tenant_id" text not null, "channel" text not null, "external_event_id" text not null, "payload" jsonb null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_webhook_event_deleted_at" ON "marketing_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_webhook_event_tenant_id" ON "marketing_webhook_event" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_webhook_event_external_event_id_unique" ON "marketing_webhook_event" ("external_event_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "marketing_agent_version" add constraint "marketing_agent_version_agent_id_foreign" foreign key ("agent_id") references "marketing_agent" ("id") on update cascade;`);

    this.addSql(`alter table if exists "marketing_chatbot_data" add constraint "marketing_chatbot_data_chatbot_id_foreign" foreign key ("chatbot_id") references "marketing_chatbot" ("id") on update cascade;`);

    this.addSql(`alter table if exists "marketing_post_media" add constraint "marketing_post_media_post_id_foreign" foreign key ("post_id") references "marketing_post" ("id") on update cascade;`);

    this.addSql(`alter table if exists "marketing_post_revision" add constraint "marketing_post_revision_post_id_foreign" foreign key ("post_id") references "marketing_post" ("id") on update cascade;`);

    this.addSql(`alter table if exists "marketing_post_target" add constraint "marketing_post_target_post_id_foreign" foreign key ("post_id") references "marketing_post" ("id") on update cascade;`);

    this.addSql(`alter table if exists "marketing_video_scene" add constraint "marketing_video_scene_project_id_foreign" foreign key ("project_id") references "marketing_video_project" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "marketing_agent_version" drop constraint if exists "marketing_agent_version_agent_id_foreign";`);

    this.addSql(`alter table if exists "marketing_chatbot_data" drop constraint if exists "marketing_chatbot_data_chatbot_id_foreign";`);

    this.addSql(`alter table if exists "marketing_post_media" drop constraint if exists "marketing_post_media_post_id_foreign";`);

    this.addSql(`alter table if exists "marketing_post_revision" drop constraint if exists "marketing_post_revision_post_id_foreign";`);

    this.addSql(`alter table if exists "marketing_post_target" drop constraint if exists "marketing_post_target_post_id_foreign";`);

    this.addSql(`alter table if exists "marketing_video_scene" drop constraint if exists "marketing_video_scene_project_id_foreign";`);

    this.addSql(`drop table if exists "marketing_agent" cascade;`);

    this.addSql(`drop table if exists "marketing_agent_role" cascade;`);

    this.addSql(`drop table if exists "marketing_agent_version" cascade;`);

    this.addSql(`drop table if exists "marketing_blog_article" cascade;`);

    this.addSql(`drop table if exists "marketing_brand_voice" cascade;`);

    this.addSql(`drop table if exists "marketing_campaign" cascade;`);

    this.addSql(`drop table if exists "marketing_chatbot" cascade;`);

    this.addSql(`drop table if exists "marketing_chatbot_data" cascade;`);

    this.addSql(`drop table if exists "marketing_contact" cascade;`);

    this.addSql(`drop table if exists "marketing_content_brief" cascade;`);

    this.addSql(`drop table if exists "marketing_conversation" cascade;`);

    this.addSql(`drop table if exists "marketing_generated_image" cascade;`);

    this.addSql(`drop table if exists "marketing_keyword" cascade;`);

    this.addSql(`drop table if exists "marketing_message" cascade;`);

    this.addSql(`drop table if exists "marketing_oauth_state" cascade;`);

    this.addSql(`drop table if exists "marketing_post" cascade;`);

    this.addSql(`drop table if exists "marketing_post_media" cascade;`);

    this.addSql(`drop table if exists "marketing_post_revision" cascade;`);

    this.addSql(`drop table if exists "marketing_post_target" cascade;`);

    this.addSql(`drop table if exists "marketing_schedule" cascade;`);

    this.addSql(`drop table if exists "marketing_seo_project" cascade;`);

    this.addSql(`drop table if exists "marketing_setting" cascade;`);

    this.addSql(`drop table if exists "marketing_social_account" cascade;`);

    this.addSql(`drop table if exists "marketing_social_credential" cascade;`);

    this.addSql(`drop table if exists "marketing_stat" cascade;`);

    this.addSql(`drop table if exists "marketing_video_project" cascade;`);

    this.addSql(`drop table if exists "marketing_video_scene" cascade;`);

    this.addSql(`drop table if exists "marketing_webhook_event" cascade;`);
  }

}
