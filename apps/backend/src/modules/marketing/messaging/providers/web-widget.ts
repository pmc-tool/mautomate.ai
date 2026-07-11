/**
 * Web widget channel adapter. The on-site chat widget ingests inbound messages
 * through the dedicated `/marketing-chat` API (which validates a conversation
 * token upstream), not through the generic webhook pipeline. Agent replies are
 * persisted and the widget polls for them, so there is no external send.
 */

import { registerMessagingProvider } from "../registry"
import type {
  InboundMessage,
  MessagingCapabilities,
  MessagingChannel,
  MessagingProvider,
  OutboundMessage,
  SendResult,
  WebhookContext,
} from "../types"

class WebWidgetProvider implements MessagingProvider {
  readonly channel: MessagingChannel = "web_widget"
  readonly label = "Web Widget"
  readonly capabilities: MessagingCapabilities = {
    requiresAppConfig: false,
    maxTextLength: 4000,
    supportsMedia: true,
    inboundAuth: "session",
  }

  isConfigured(): boolean {
    return true
  }

  verifyWebhook(_ctx: WebhookContext): boolean {
    // The /marketing-chat route validates the conversation token upstream.
    return true
  }

  verifyChallenge(_ctx: WebhookContext): string | null {
    return null
  }

  parseInbound(_ctx: WebhookContext): InboundMessage[] {
    // Web widget ingests via the dedicated chat API, not this adapter.
    return []
  }

  async sendMessage(_input: OutboundMessage): Promise<SendResult> {
    // No-op: agent replies are persisted and the widget polls them.
    return { ok: true, deliveryStatus: "stored" }
  }
}

registerMessagingProvider(new WebWidgetProvider())
