// DTOs for the Call Center feature, mirroring the web client's
// `CallCenterDashboard`, `CallCenterCall`, `CallDetail`, `CallCenterAnalytics`,
// `CallAgent` and `CallPhoneNumber` shapes
// (apps/storefront/src/lib/merchant-admin/api.ts) field-for-field.
//
// freezed + json_serializable generate parsing, equality and copyWith. Wire
// names are snake_case; Dart is camelCase via @JsonKey.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern (same
// convention as the Orders + Products DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "call_center_models.freezed.dart";
part "call_center_models.g.dart";

/// Today's call tally on the overview dashboard — `calls_today` in the web
/// `CallCenterDashboard`.
@freezed
class CallsToday with _$CallsToday {
  const factory CallsToday({
    @Default(0) int total,
    @JsonKey(name: "by_status")
    @Default(<String, num>{})
    Map<String, num> byStatus,
  }) = _CallsToday;

  factory CallsToday.fromJson(Map<String, dynamic> json) =>
      _$CallsTodayFromJson(json);
}

/// GET /merchant/call-center -> the overview dashboard.
@freezed
class CallCenterDashboard with _$CallCenterDashboard {
  const factory CallCenterDashboard({
    @JsonKey(name: "tenant_id") @Default("") String tenantId,
    @JsonKey(name: "calls_today")
    @Default(CallsToday())
    CallsToday callsToday,
    @JsonKey(name: "total_minutes") @Default(0) num totalMinutes,
    @JsonKey(name: "total_cost") @Default(0) num totalCost,
    @JsonKey(name: "tasks_scheduled") @Default(0) int tasksScheduled,
    @JsonKey(name: "campaigns_running") @Default(0) int campaignsRunning,
  }) = _CallCenterDashboard;

  factory CallCenterDashboard.fromJson(Map<String, dynamic> json) =>
      _$CallCenterDashboardFromJson(json);
}

/// A single AI voice agent — the web `CallAgent`
/// (GET /merchant/call-center/agents -> { agents, count }).
@freezed
class CallAgent with _$CallAgent {
  const factory CallAgent({
    @Default("") String id,
    @Default("") String name,
    @JsonKey(name: "use_case") @Default("") String useCase,
    @Default("") String status,
    @JsonKey(name: "current_version_id") String? currentVersionId,
  }) = _CallAgent;

  factory CallAgent.fromJson(Map<String, dynamic> json) =>
      _$CallAgentFromJson(json);
}

/// A phone number mapped to the store — the web `CallPhoneNumber`
/// (GET /merchant/call-center/phone-numbers).
@freezed
class CallPhoneNumber with _$CallPhoneNumber {
  const factory CallPhoneNumber({
    @Default("") String id,
    @Default("") String e164,
    @Default("") String provider,
    @JsonKey(name: "provider_number_id") String? providerNumberId,
    String? country,
    @JsonKey(name: "agent_id") String? agentId,
    String? label,
    @Default(true) bool active,
    @JsonKey(name: "created_at") String? createdAt,
  }) = _CallPhoneNumber;

  factory CallPhoneNumber.fromJson(Map<String, dynamic> json) =>
      _$CallPhoneNumberFromJson(json);
}

/// One turn of a call transcript.
@freezed
class CallTranscriptTurn with _$CallTranscriptTurn {
  const factory CallTranscriptTurn({
    @Default("") String role,
    @Default("") String content,
  }) = _CallTranscriptTurn;

  factory CallTranscriptTurn.fromJson(Map<String, dynamic> json) =>
      _$CallTranscriptTurnFromJson(json);
}

/// A row in the call log — the web `CallCenterCall`
/// (GET /merchant/call-center/calls -> { calls, count, ... }).
@freezed
class CallCenterCall with _$CallCenterCall {
  const factory CallCenterCall({
    @Default("") String id,
    @Default("") String status,
    @Default("outbound") String direction,
    @JsonKey(name: "from_number") String? fromNumber,
    @JsonKey(name: "to_number") String? toNumber,
    @JsonKey(name: "order_id") String? orderId,
    @JsonKey(name: "campaign_id") String? campaignId,
    String? disposition,
    String? sentiment,
    @JsonKey(name: "cost_total") num? costTotal,
    @JsonKey(name: "started_at") String? startedAt,
    @JsonKey(name: "ended_at") String? endedAt,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    String? summary,
    List<CallTranscriptTurn>? transcript,
    @JsonKey(name: "recording_url") String? recordingUrl,
    String? locale,
  }) = _CallCenterCall;

  factory CallCenterCall.fromJson(Map<String, dynamic> json) =>
      _$CallCenterCallFromJson(json);
}

/// An outcome logged against a call — the web `CallDisposition`.
@freezed
class CallDisposition with _$CallDisposition {
  const factory CallDisposition({
    @Default("") String id,
    @Default("") String outcome,
    String? reason,
    String? notes,
    @JsonKey(name: "set_by") String? setBy,
    @JsonKey(name: "created_at") @Default("") String createdAt,
  }) = _CallDisposition;

  factory CallDisposition.fromJson(Map<String, dynamic> json) =>
      _$CallDispositionFromJson(json);
}

/// The agent a call was handled by (subset returned on the detail).
@freezed
class CallAgentRef with _$CallAgentRef {
  const factory CallAgentRef({
    @Default("") String id,
    @Default("") String name,
  }) = _CallAgentRef;

  factory CallAgentRef.fromJson(Map<String, dynamic> json) =>
      _$CallAgentRefFromJson(json);
}

/// The order a call related to (subset returned on the detail).
@freezed
class CallOrderRef with _$CallOrderRef {
  const factory CallOrderRef({
    @Default("") String id,
    @JsonKey(name: "display_id") @Default(0) int displayId,
  }) = _CallOrderRef;

  factory CallOrderRef.fromJson(Map<String, dynamic> json) =>
      _$CallOrderRefFromJson(json);
}

/// GET /merchant/call-center/calls/:id -> the full call detail.
@freezed
class CallDetail with _$CallDetail {
  const factory CallDetail({
    @JsonKey(name: "call") required CallCenterCall callData,
    @Default(<CallDisposition>[]) List<CallDisposition> dispositions,
    CallAgentRef? agent,
    CallOrderRef? order,
    @JsonKey(name: "has_recording") @Default(false) bool hasRecording,
  }) = _CallDetail;

  factory CallDetail.fromJson(Map<String, dynamic> json) =>
      _$CallDetailFromJson(json);
}

/// The summary block of the analytics response.
@freezed
class CallAnalyticsSummary with _$CallAnalyticsSummary {
  const factory CallAnalyticsSummary({
    @Default(0) int total,
    @JsonKey(name: "connect_rate") @Default(0) num connectRate,
    @JsonKey(name: "containment_rate") @Default(0) num containmentRate,
    @JsonKey(name: "avg_handle_time") @Default(0) num avgHandleTime,
    @JsonKey(name: "total_cost") @Default(0) num totalCost,
  }) = _CallAnalyticsSummary;

  factory CallAnalyticsSummary.fromJson(Map<String, dynamic> json) =>
      _$CallAnalyticsSummaryFromJson(json);
}

/// One point of the "calls by day" series.
@freezed
class CallDayPoint with _$CallDayPoint {
  const factory CallDayPoint({
    @Default("") String date,
    @Default(0) int count,
    @Default(0) num cost,
  }) = _CallDayPoint;

  factory CallDayPoint.fromJson(Map<String, dynamic> json) =>
      _$CallDayPointFromJson(json);
}

/// GET /merchant/call-center/analytics -> the analytics summary.
@freezed
class CallCenterAnalytics with _$CallCenterAnalytics {
  const factory CallCenterAnalytics({
    @Default(CallAnalyticsSummary()) CallAnalyticsSummary summary,
    @Default(<String, num>{}) Map<String, num> outcomes,
    @JsonKey(name: "by_status")
    @Default(<String, num>{})
    Map<String, num> byStatus,
    @JsonKey(name: "by_day")
    @Default(<CallDayPoint>[])
    List<CallDayPoint> byDay,
    @Default(<String, num>{}) Map<String, num> sentiment,
    @JsonKey(name: "kpis_note") @Default("") String kpisNote,
  }) = _CallCenterAnalytics;

  factory CallCenterAnalytics.fromJson(Map<String, dynamic> json) =>
      _$CallCenterAnalyticsFromJson(json);
}

/// GET /merchant/call-center/phone-numbers -> the numbers + provider readiness.
@freezed
class PhoneNumbersResult with _$PhoneNumbersResult {
  const factory PhoneNumbersResult({
    @JsonKey(name: "phone_numbers")
    @Default(<CallPhoneNumber>[])
    List<CallPhoneNumber> phoneNumbers,
    @Default(<String, bool>{}) Map<String, bool> providers,
    @JsonKey(name: "monthly_credits") @Default(0) num monthlyCredits,
  }) = _PhoneNumbersResult;

  factory PhoneNumbersResult.fromJson(Map<String, dynamic> json) =>
      _$PhoneNumbersResultFromJson(json);
}
