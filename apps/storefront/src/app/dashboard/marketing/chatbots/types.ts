import type { MarketingChatbot } from "@lib/merchant-admin/api"

/**
 * The wizard's working copy of a chatbot. It is the editable subset of
 * MarketingChatbot: what the merchant changes locally (so the live preview can
 * re-render on every keystroke) and what the autosave PUTs back on step change.
 * Server-owned fields (id, public_key, training_status, timestamps) are read
 * from the loaded chatbot, never from the draft.
 */
export type ChatbotDraft = {
  name: string
  greeting: string | null
  bubble_message: string | null
  welcome_message: string | null
  instructions: string | null
  dont_go_beyond: boolean
  language: string | null
  reply_mode: "draft" | "auto"
  active: boolean
  avatar: string | null
  color: string
  position: "left" | "right"
  show_logo: boolean
  show_datetime: boolean
  collect_email: boolean
  allow_attachments: boolean
  allow_emoji: boolean
  embed_width: number
  embed_height: number
}

export function toDraft(bot: MarketingChatbot): ChatbotDraft {
  return {
    name: bot.name ?? "",
    greeting: bot.greeting ?? null,
    bubble_message: bot.bubble_message ?? null,
    welcome_message: bot.welcome_message ?? null,
    instructions: bot.instructions ?? null,
    dont_go_beyond: bot.dont_go_beyond === true,
    language: bot.language ?? null,
    reply_mode: bot.reply_mode === "auto" ? "auto" : "draft",
    active: bot.active !== false,
    avatar: bot.avatar ?? null,
    color: bot.color || "#017BE5",
    position: bot.position === "left" ? "left" : "right",
    show_logo: bot.show_logo !== false,
    show_datetime: bot.show_datetime !== false,
    collect_email: bot.collect_email !== false,
    allow_attachments: bot.allow_attachments !== false,
    allow_emoji: bot.allow_emoji !== false,
    embed_width: Number(bot.embed_width) || 420,
    embed_height: Number(bot.embed_height) || 745,
  }
}

/** Languages the bot can be pinned to. Empty value = detect from the customer. */
export const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto (match the customer)" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Italian", label: "Italian" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Dutch", label: "Dutch" },
  { value: "Danish", label: "Danish" },
  { value: "Swedish", label: "Swedish" },
  { value: "Polish", label: "Polish" },
  { value: "Turkish", label: "Turkish" },
  { value: "Arabic", label: "Arabic" },
  { value: "Hindi", label: "Hindi" },
  { value: "Bengali", label: "Bengali" },
  { value: "Chinese", label: "Chinese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
]
