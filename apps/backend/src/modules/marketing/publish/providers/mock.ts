/**
 * Mock publish adapter — a deterministic no-network provider for dev/test and
 * for platforms not yet wired. Configured only when MARKETING_PUBLISH_MOCK=1,
 * so it never masks a real adapter in production. It "publishes" by returning a
 * synthetic external id + URL, letting the whole schedule→claim→publish→status
 * pipeline be exercised end-to-end without credentials.
 */

import { registerProvider } from "../registry"
import type {
  PublishInput,
  PublishProvider,
  PublishResult,
} from "../types"

class MockProvider implements PublishProvider {
  readonly platform = "telegram" as const
  readonly label = "Mock (dev)"
  readonly capabilities = {
    media: "optional" as const,
    maxTextLength: null,
    supportsHashtags: true,
    supportsScheduling: false,
    connect: "webhook_token" as const,
  }

  isConfigured(): boolean {
    return process.env.MARKETING_PUBLISH_MOCK === "1"
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const stamp = `${input.account.id}-${input.content.body?.length ?? 0}`
    return {
      ok: true,
      externalId: `mock_${stamp}`,
      url: `https://mock.local/${input.account.handle ?? "acct"}/${stamp}`,
    }
  }
}

// NOTE: the mock claims the "telegram" slot only as a stand-in when no real
// telegram adapter is registered; the real adapter (registered later in
// index.ts) overrides it because last-registration-wins. Kept intentionally so
// the pipeline is testable out of the box with MARKETING_PUBLISH_MOCK=1.
registerProvider(new MockProvider())
