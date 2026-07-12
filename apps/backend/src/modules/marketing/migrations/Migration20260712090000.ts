import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * A-1a — the data layer behind a real chatbot + a unified, human-takeoverable inbox.
 *
 * Additive only (no column is dropped or renamed):
 *   marketing_conversation  + handler_mode / handoff_reason / chatbot_id, and the
 *                             `voice` channel so completed calls surface in the inbox.
 *   marketing_chatbot       + persona, appearance, feature toggles, training_status.
 *   marketing_chatbot_data  + per-source training status / error.
 *   marketing_knowledge_chunk   (new) embedded chunks for chatbot RAG.
 *   marketing_chatbot_channel   (new) thin bot<->channel binding, NO secrets.
 *   marketing_inbox_note        (new) internal notes on a conversation.
 *   marketing_canned_response   (new) saved replies by shortcut.
 *
 * Enums in this module are text + CHECK constraints (not native postgres enums),
 * so widening the conversation `channel` enum means dropping and re-adding
 * "marketing_conversation_channel_check" with the extra value.
 */
export class Migration20260712090000 extends Migration {

  override async up(): Promise<void> {
    // ---------------------------------------------------------- conversation
    this.addSql(`ALTER TABLE "marketing_conversation" ADD COLUMN IF NOT EXISTS "handler_mode" text not null default 'ai';`);
    this.addSql(`ALTER TABLE "marketing_conversation" ADD COLUMN IF NOT EXISTS "handoff_reason" text null;`);
    this.addSql(`ALTER TABLE "marketing_conversation" ADD COLUMN IF NOT EXISTS "chatbot_id" text null;`);
    this.addSql(`alter table if exists "marketing_conversation" drop constraint if exists "marketing_conversation_handler_mode_check";`);
    this.addSql(`alter table if exists "marketing_conversation" add constraint "marketing_conversation_handler_mode_check" check ("handler_mode" in ('ai', 'queued', 'human'));`);

    this.addSql(`alter table if exists "marketing_conversation" drop constraint if exists "marketing_conversation_channel_check";`);
    this.addSql(`alter table if exists "marketing_conversation" add constraint "marketing_conversation_channel_check" check ("channel" in ('whatsapp', 'messenger', 'telegram', 'instagram', 'web_widget', 'email', 'review', 'voice'));`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_conversation_tenant_handler_mode" ON "marketing_conversation" ("tenant_id", "handler_mode", "last_message_at") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- chatbot
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "instructions" text null;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "dont_go_beyond" boolean not null default false;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "language" text null;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "welcome_message" text null;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "bubble_message" text null;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "avatar" text null;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "color" text not null default '#017BE5';`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "position" text not null default 'right';`);
    this.addSql(`alter table if exists "marketing_chatbot" drop constraint if exists "marketing_chatbot_position_check";`);
    this.addSql(`alter table if exists "marketing_chatbot" add constraint "marketing_chatbot_position_check" check ("position" in ('left', 'right'));`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "show_logo" boolean not null default true;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "show_datetime" boolean not null default true;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "embed_width" integer not null default 420;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "embed_height" integer not null default 745;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "collect_email" boolean not null default true;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "allow_attachments" boolean not null default true;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "allow_emoji" boolean not null default true;`);
    this.addSql(`ALTER TABLE "marketing_chatbot" ADD COLUMN IF NOT EXISTS "training_status" text not null default 'not_trained';`);
    this.addSql(`alter table if exists "marketing_chatbot" drop constraint if exists "marketing_chatbot_training_status_check";`);
    this.addSql(`alter table if exists "marketing_chatbot" add constraint "marketing_chatbot_training_status_check" check ("training_status" in ('not_trained', 'training', 'trained'));`);

    // ---------------------------------------------------------- chatbot_data
    this.addSql(`ALTER TABLE "marketing_chatbot_data" ADD COLUMN IF NOT EXISTS "status" text not null default 'pending';`);
    this.addSql(`ALTER TABLE "marketing_chatbot_data" ADD COLUMN IF NOT EXISTS "error" text null;`);
    this.addSql(`alter table if exists "marketing_chatbot_data" drop constraint if exists "marketing_chatbot_data_status_check";`);
    this.addSql(`alter table if exists "marketing_chatbot_data" add constraint "marketing_chatbot_data_status_check" check ("status" in ('pending', 'embedded', 'failed'));`);

    // ---------------------------------------------------------- knowledge_chunk
    this.addSql(`create table if not exists "marketing_knowledge_chunk" ("id" text not null, "tenant_id" text not null, "owner_id" text not null, "source_id" text not null, "content" text not null, "embedding" text not null, "embedding_model" text null, "dim" integer null, "seq" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_knowledge_chunk_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_knowledge_chunk_deleted_at" ON "marketing_knowledge_chunk" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_knowledge_chunk_tenant_id" ON "marketing_knowledge_chunk" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_knowledge_chunk_tenant_owner" ON "marketing_knowledge_chunk" ("tenant_id", "owner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_knowledge_chunk_source_id" ON "marketing_knowledge_chunk" ("source_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- chatbot_channel
    this.addSql(`create table if not exists "marketing_chatbot_channel" ("id" text not null, "tenant_id" text not null, "chatbot_id" text not null, "channel" text check ("channel" in ('web_widget', 'whatsapp', 'messenger', 'instagram', 'telegram')) not null, "social_account_id" text null, "active" boolean not null default true, "config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_chatbot_channel_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_channel_deleted_at" ON "marketing_chatbot_channel" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_chatbot_channel_tenant_id" ON "marketing_chatbot_channel" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_chatbot_channel_tenant_bot_channel_unique" ON "marketing_chatbot_channel" ("tenant_id", "chatbot_id", "channel") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- inbox_note
    this.addSql(`create table if not exists "marketing_inbox_note" ("id" text not null, "tenant_id" text not null, "conversation_id" text not null, "author_id" text not null, "content" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_inbox_note_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_inbox_note_deleted_at" ON "marketing_inbox_note" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_inbox_note_tenant_id" ON "marketing_inbox_note" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_inbox_note_tenant_conversation" ON "marketing_inbox_note" ("tenant_id", "conversation_id") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------------- canned_response
    this.addSql(`create table if not exists "marketing_canned_response" ("id" text not null, "tenant_id" text not null, "shortcut" text not null, "title" text not null, "content" text not null, "category" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_canned_response_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_canned_response_deleted_at" ON "marketing_canned_response" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_canned_response_tenant_id" ON "marketing_canned_response" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_canned_response_tenant_shortcut_unique" ON "marketing_canned_response" ("tenant_id", "shortcut") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_canned_response" cascade;`);

    this.addSql(`drop table if exists "marketing_inbox_note" cascade;`);

    this.addSql(`drop table if exists "marketing_chatbot_channel" cascade;`);

    this.addSql(`drop table if exists "marketing_knowledge_chunk" cascade;`);

    this.addSql(`alter table if exists "marketing_chatbot_data" drop constraint if exists "marketing_chatbot_data_status_check";`);
    this.addSql(`ALTER TABLE "marketing_chatbot_data" DROP COLUMN IF EXISTS "status";`);
    this.addSql(`ALTER TABLE "marketing_chatbot_data" DROP COLUMN IF EXISTS "error";`);

    this.addSql(`alter table if exists "marketing_chatbot" drop constraint if exists "marketing_chatbot_position_check";`);
    this.addSql(`alter table if exists "marketing_chatbot" drop constraint if exists "marketing_chatbot_training_status_check";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "instructions";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "dont_go_beyond";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "language";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "welcome_message";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "bubble_message";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "avatar";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "color";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "position";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "show_logo";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "show_datetime";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "embed_width";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "embed_height";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "collect_email";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "allow_attachments";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "allow_emoji";`);
    this.addSql(`ALTER TABLE "marketing_chatbot" DROP COLUMN IF EXISTS "training_status";`);

    this.addSql(`drop index if exists "IDX_marketing_conversation_tenant_handler_mode";`);
    this.addSql(`update "marketing_conversation" set "channel" = 'web_widget' where "channel" = 'voice';`);
    this.addSql(`alter table if exists "marketing_conversation" drop constraint if exists "marketing_conversation_channel_check";`);
    this.addSql(`alter table if exists "marketing_conversation" add constraint "marketing_conversation_channel_check" check ("channel" in ('whatsapp', 'messenger', 'telegram', 'instagram', 'web_widget', 'email', 'review'));`);
    this.addSql(`alter table if exists "marketing_conversation" drop constraint if exists "marketing_conversation_handler_mode_check";`);
    this.addSql(`ALTER TABLE "marketing_conversation" DROP COLUMN IF EXISTS "handler_mode";`);
    this.addSql(`ALTER TABLE "marketing_conversation" DROP COLUMN IF EXISTS "handoff_reason";`);
    this.addSql(`ALTER TABLE "marketing_conversation" DROP COLUMN IF EXISTS "chatbot_id";`);
  }

}
