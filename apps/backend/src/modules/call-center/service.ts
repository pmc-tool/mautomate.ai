import { MedusaService } from "@medusajs/framework/utils"
import Call from "./models/call"
import CallTask from "./models/call-task"
import CallAttempt from "./models/call-attempt"
import Campaign from "./models/campaign"
import Playbook from "./models/playbook"
import PlaybookVersion from "./models/playbook-version"
import Disposition from "./models/disposition"
import AgentRole from "./models/agent-role"
import Consent from "./models/consent"
import ConsentLog from "./models/consent-log"
import Callback from "./models/callback"
import RecordingAccessLog from "./models/recording-access-log"
import CallCenterSetting from "./models/setting"
import CallCenterKnowledge from "./models/call-center-knowledge"
import CallCenterKnowledgeChunk from "./models/call-center-knowledge-chunk"
import CallCenterPhoneNumber from "./models/call-center-phone-number"

/**
 * Call-center module service.
 *
 * Tenant-ready data foundation: generated CRUD for every call-center entity.
 * All models carry `tenant_id`; scoping (tenant_id -> store / sales-channel) is
 * applied later at the API/middleware layer. Single-tenant run uses a default
 * constant tenant.
 *
 * Generated CRUD (model key -> methods, mirroring the contact/cms pattern):
 *   Call               -> createCalls / listCalls / listAndCountCalls
 *                         / retrieveCall / updateCalls / deleteCalls
 *                         / softDeleteCalls / restoreCalls
 *   CallTask           -> createCallTasks / listCallTasks / ...
 *   CallAttempt        -> createCallAttempts / listCallAttempts / ...
 *   Campaign           -> createCampaigns / listCampaigns / ...
 *   Playbook           -> createPlaybooks / listPlaybooks / ...
 *   PlaybookVersion    -> createPlaybookVersions / listPlaybookVersions / ...
 *   Disposition        -> createDispositions / listDispositions / ...
 *   AgentRole          -> createAgentRoles / listAgentRoles / ...
 *   Consent            -> createConsents / listConsents / ...
 *   ConsentLog         -> createConsentLogs / listConsentLogs / ...
 *   Callback           -> createCallbacks / listCallbacks / ...
 *   RecordingAccessLog -> createRecordingAccessLogs / listRecordingAccessLogs / ...
 *   CallCenterSetting  -> createCallCenterSettings / listCallCenterSettings / ...
 *   KnowledgeEntry     -> createKnowledgeEntries / listKnowledgeEntries
 *                         / listAndCountKnowledgeEntries
 *                         / retrieveKnowledgeEntry / updateKnowledgeEntries
 *                         / deleteKnowledgeEntries / ...
 *                         (call_center_knowledge — agent training material)
 */
class CallCenterModuleService extends MedusaService({
  Call,
  CallTask,
  CallAttempt,
  Campaign,
  Playbook,
  PlaybookVersion,
  Disposition,
  AgentRole,
  Consent,
  ConsentLog,
  Callback,
  RecordingAccessLog,
  CallCenterSetting,
  KnowledgeEntry: CallCenterKnowledge,
  KnowledgeChunk: CallCenterKnowledgeChunk,
  PhoneNumber: CallCenterPhoneNumber,
}) {}

export default CallCenterModuleService
