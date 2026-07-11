/**
 * Marketing content-engine loader + adapter.
 *
 * The AI content engine lives in the marketing module itself
 * (`src/modules/marketing/content/content-service`). These admin routes only
 * orchestrate it — they never own it. It is loaded lazily via `require` behind
 * a thin facade so the routes stay decoupled from the engine's build lifecycle.
 *
 * The routes speak snake_case (matching request bodies and DB columns); the
 * engine's functions take `(container, input)` with camelCase inputs. This
 * facade is the ONE place that translation happens, so a casing drift can never
 * silently pass a wrong-cased key (which tsc cannot catch across `require`).
 */

type Scope = any

export type GeneratePostInput = {
  post_id?: string
  tenant_id: string
  prompt?: string
  product_ids?: string[]
  platforms?: string[]
  brand_voice_id?: string
  tone?: string
  length?: string
  created_by_user_id?: string | null
}

export type GenerateTextInput = {
  tenant_id: string
  prompt: string
  brand_voice_id?: string
  product_ids?: string[]
  action?: string
  target_language?: string
}

export type ReworkPostInput = {
  post_id: string
  tenant_id: string
  instruction: string
  created_by_user_id?: string | null
}

export type TailorInput = {
  post_id: string
  tenant_id: string
  platform: string
  instruction?: string
  created_by_user_id?: string | null
}

export type RestoreRevisionInput = {
  post_id: string
  tenant_id: string
  version: number
  created_by_user_id?: string | null
}

type ContentEngine = {
  generatePost: (scope: Scope, input: GeneratePostInput) => Promise<any>
  generateText: (scope: Scope, input: GenerateTextInput) => Promise<string>
  reworkPost: (scope: Scope, input: ReworkPostInput) => Promise<any>
  tailorForPlatform: (scope: Scope, input: TailorInput) => Promise<any>
  restoreRevision: (scope: Scope, input: RestoreRevisionInput) => Promise<any>
}

/** The raw camelCase engine module, loaded lazily. */
type RawEngine = {
  generatePost: (container: any, input: any) => Promise<any>
  generateText: (container: any, input: any) => Promise<string>
  reworkPost: (container: any, input: any) => Promise<any>
  tailorForPlatform: (container: any, input: any) => Promise<any>
  restoreRevision: (container: any, input: any) => Promise<any>
}

let cachedRaw: RawEngine | null = null

const loadRaw = (): RawEngine => {
  if (!cachedRaw) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedRaw = require("../../../modules/marketing/content/content-service") as RawEngine
  }
  return cachedRaw
}

/**
 * The adapter. Each method maps the route-facing snake_case input onto the
 * engine's camelCase contract, then delegates to the lazily-required module.
 */
const adapter: ContentEngine = {
  generatePost: (scope, input) =>
    loadRaw().generatePost(scope, {
      postId: input.post_id,
      tenantId: input.tenant_id,
      prompt: input.prompt ?? "",
      productIds: input.product_ids,
      platforms: input.platforms ?? [],
      brandVoiceId: input.brand_voice_id,
      tone: input.tone,
      length: input.length,
      userId: input.created_by_user_id ?? undefined,
    }),
  generateText: (scope, input) =>
    loadRaw().generateText(scope, {
      tenantId: input.tenant_id,
      prompt: input.prompt,
      brandVoiceId: input.brand_voice_id,
      productIds: input.product_ids,
      action: input.action,
      targetLanguage: input.target_language,
    }),
  reworkPost: (scope, input) =>
    loadRaw().reworkPost(scope, {
      tenantId: input.tenant_id,
      postId: input.post_id,
      instruction: input.instruction,
      userId: input.created_by_user_id ?? undefined,
    }),
  tailorForPlatform: (scope, input) =>
    loadRaw().tailorForPlatform(scope, {
      tenantId: input.tenant_id,
      postId: input.post_id,
      platform: input.platform,
      instruction: input.instruction,
      userId: input.created_by_user_id ?? undefined,
    }),
  restoreRevision: (scope, input) =>
    loadRaw().restoreRevision(scope, {
      tenantId: input.tenant_id,
      postId: input.post_id,
      version: input.version,
      userId: input.created_by_user_id ?? undefined,
    }),
}

export const getContentEngine = (): ContentEngine => adapter
