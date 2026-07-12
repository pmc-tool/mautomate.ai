import { model } from "@medusajs/framework/utils"

/**
 * marketing_inbox_note — an internal note on a conversation.
 *
 * Never sent to the contact: notes are the agents' private side-channel on a
 * thread (context for a handoff, a reminder, an escalation summary). Kept out of
 * marketing_message on purpose so nothing can ever accidentally deliver one.
 * `author_id` is the user who wrote it.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; the (tenant_id, conversation_id)
 * index backs reading a thread's notes.
 */
const MarketingInboxNote = model
  .define("marketing_inbox_note", {
    id: model.id({ prefix: "mnote" }).primaryKey(),
    tenant_id: model.text(),
    conversation_id: model.text(),
    author_id: model.text(),
    content: model.text(),
  })
  .indexes([
    {
      name: "IDX_marketing_inbox_note_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_inbox_note_tenant_conversation",
      on: ["tenant_id", "conversation_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingInboxNote
