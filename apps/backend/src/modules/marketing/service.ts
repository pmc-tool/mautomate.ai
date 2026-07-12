import { MedusaService } from "@medusajs/framework/utils"
import MarketingPost from "./models/post"
import MarketingPostTarget from "./models/post-target"
import MarketingPostMedia from "./models/post-media"
import MarketingPostRevision from "./models/post-revision"
import MarketingSchedule from "./models/schedule"
import MarketingCampaign from "./models/campaign"
import MarketingBrandVoice from "./models/brand-voice"
import MarketingSocialAccount from "./models/social-account"
import MarketingSocialCredential from "./models/social-credential"
import MarketingPlatformCredential from "./models/platform-credential"
import MarketingOauthState from "./models/oauth-state"
import MarketingContact from "./models/contact"
import MarketingConversation from "./models/conversation"
import MarketingMessage from "./models/message"
import MarketingWebhookEvent from "./models/webhook-event"
import MarketingStat from "./models/stat"
import MarketingAgent from "./models/agent"
import MarketingAgentVersion from "./models/agent-version"
import MarketingChatbot from "./models/chatbot"
import MarketingChatbotData from "./models/chatbot-data"
import MarketingSeoProject from "./models/seo-project"
import MarketingKeyword from "./models/keyword"
import MarketingContentBrief from "./models/content-brief"
import MarketingBlogArticle from "./models/blog-article"
import MarketingGeneratedImage from "./models/generated-image"
import MarketingVideoProject from "./models/video-project"
import MarketingVideoScene from "./models/video-scene"
import MarketingAgentRole from "./models/agent-role"
import MarketingSetting from "./models/setting"
import MarketingEmailTemplate from "./models/email-template"
import MarketingEmailSend from "./models/email-send"
import MarketingSuppression from "./models/suppression"
import MarketingCartRecovery from "./models/cart-recovery"
import MarketingJourney from "./models/journey"
import MarketingJourneyEnrollment from "./models/journey-enrollment"
import MarketingSegment from "./models/segment"
import MarketingSegmentMember from "./models/segment-member"
import MarketingKnowledgeChunk from "./models/knowledge-chunk"
import MarketingChatbotChannel from "./models/chatbot-channel"
import MarketingInboxNote from "./models/inbox-note"
import MarketingCannedResponse from "./models/canned-response"

/**
 * Marketing module service.
 *
 * Tenant-ready data foundation: generated CRUD for every marketing entity.
 * All models carry `tenant_id`; scoping (tenant_id -> store / sales-channel) is
 * applied later at the API/middleware layer. Single-tenant run uses a default
 * constant tenant.
 *
 * Generated CRUD mirrors the call-center pattern (model key -> methods), e.g.
 *   MarketingPost      -> createMarketingPosts / listMarketingPosts
 *                         / listAndCountMarketingPosts / retrieveMarketingPost
 *                         / updateMarketingPosts / deleteMarketingPosts
 *                         / softDeleteMarketingPosts / restoreMarketingPosts
 *   MarketingAgentRole -> createMarketingAgentRoles / listMarketingAgentRoles
 *                         ... (used by the fail-closed RBAC helper)
 *   MarketingSetting   -> createMarketingSettings / listMarketingSettings
 *                         / updateMarketingSettings ... (durable kill switch)
 */
class MarketingModuleService extends MedusaService({
  MarketingPost,
  MarketingPostTarget,
  MarketingPostMedia,
  MarketingPostRevision,
  MarketingSchedule,
  MarketingCampaign,
  MarketingBrandVoice,
  MarketingSocialAccount,
  MarketingSocialCredential,
  MarketingPlatformCredential,
  MarketingOauthState,
  MarketingContact,
  MarketingConversation,
  MarketingMessage,
  MarketingWebhookEvent,
  MarketingStat,
  MarketingAgent,
  MarketingAgentVersion,
  MarketingChatbot,
  MarketingChatbotData,
  MarketingSeoProject,
  MarketingKeyword,
  MarketingContentBrief,
  MarketingBlogArticle,
  MarketingGeneratedImage,
  MarketingVideoProject,
  MarketingVideoScene,
  MarketingAgentRole,
  MarketingSetting,
  MarketingEmailTemplate,
  MarketingEmailSend,
  MarketingSuppression,
  MarketingCartRecovery,
  MarketingJourney,
  MarketingJourneyEnrollment,
  MarketingSegment,
  MarketingSegmentMember,
  MarketingKnowledgeChunk,
  MarketingChatbotChannel,
  MarketingInboxNote,
  MarketingCannedResponse,
}) {}

export default MarketingModuleService
