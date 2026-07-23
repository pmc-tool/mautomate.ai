// DTOs for the shop Setup wizard, mirroring the web client's `SetupStatus`,
// `SetupTask`, `SetupDraft`, `SetupBusiness` and `SetupSnapshot`
// (apps/storefront/src/lib/merchant-admin/api.ts). freezed + json_serializable
// so parsing, equality and copyWith are generated. Field names are snake_case
// on the wire, camelCase in Dart via @JsonKey.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern (same
// convention as the Orders + Products DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "setup_models.freezed.dart";
part "setup_models.g.dart";

// The verified-completeness engine returns whole-number percentages, but coerce
// defensively so a stray double never breaks parsing.
int _toInt(Object? v) =>
    v is int ? v : (v is num ? v.round() : int.tryParse("$v") ?? 0);

/// A single item on the verified setup checklist — mirrors the web `SetupTask`.
///
/// `done` is REAL: the tick comes from the server checking the store's actual
/// products / shipping / payment, never from "clicked Next".
@freezed
class SetupTask with _$SetupTask {
  const factory SetupTask({
    @Default("") String key,
    @Default("") String label,
    @Default("") String why,
    @Default(false) bool required,
    @Default(false) bool done,
    @JsonKey(name: "cta_href") @Default("") String ctaHref,
    @JsonKey(name: "blocker_detail") String? blockerDetail,
  }) = _SetupTask;

  factory SetupTask.fromJson(Map<String, dynamic> json) =>
      _$SetupTaskFromJson(json);
}

/// GET /merchant/setup/status — the verified completeness picture shared with
/// the overview widget. Mirrors the web `SetupStatus`.
@freezed
class SetupStatus with _$SetupStatus {
  const factory SetupStatus({
    @Default(<SetupTask>[]) List<SetupTask> tasks,
    @JsonKey(fromJson: _toInt) @Default(0) int percent,
    @JsonKey(name: "required_percent", fromJson: _toInt)
    @Default(0)
    int requiredPercent,
    @JsonKey(name: "ready_to_sell") @Default(false) bool readyToSell,
    @JsonKey(name: "missing_required")
    @Default(<String>[])
    List<String> missingRequired,
    @JsonKey(name: "shipping_countries")
    @Default(<String>[])
    List<String> shippingCountries,
    @JsonKey(name: "store_country") @Default("us") String storeCountry,
    @JsonKey(name: "pending_domain") String? pendingDomain,
    @Default(false) bool products,
    @Default(false) bool shipping,
    @Default(false) bool payment,
    @Default(false) bool domain,
  }) = _SetupStatus;

  factory SetupStatus.fromJson(Map<String, dynamic> json) =>
      _$SetupStatusFromJson(json);
}

/// The resumable wizard draft — which step, what was answered — persisted to the
/// server on every save so leaving and coming back resumes exactly here.
/// Mirrors the web `SetupDraft`.
@freezed
class SetupDraft with _$SetupDraft {
  const factory SetupDraft({
    @JsonKey(name: "current_step", includeIfNull: false) String? currentStep,
    @Default(<String>[]) List<String> completed,
    @Default(<String>[]) List<String> skipped,
    @Default(<String, dynamic>{}) Map<String, dynamic> answers,
    @JsonKey(includeIfNull: false) bool? dismissed,
    @JsonKey(name: "started_at", includeIfNull: false) String? startedAt,
    @JsonKey(name: "completed_at", includeIfNull: false) String? completedAt,
  }) = _SetupDraft;

  factory SetupDraft.fromJson(Map<String, dynamic> json) =>
      _$SetupDraftFromJson(json);
}

/// The captured business fields — mirrors the web `SetupBusiness`.
@freezed
class SetupBusiness with _$SetupBusiness {
  const factory SetupBusiness({
    @JsonKey(includeIfNull: false) String? type,
    @JsonKey(includeIfNull: false) String? category,
    @JsonKey(includeIfNull: false) String? description,
  }) = _SetupBusiness;

  factory SetupBusiness.fromJson(Map<String, dynamic> json) =>
      _$SetupBusinessFromJson(json);
}

/// GET /merchant/setup — the draft + captured business fields + the embedded
/// verified [status]. Mirrors the web `SetupSnapshot & { status }`.
///
/// [status] is nullable because PATCH /merchant/setup returns the snapshot
/// WITHOUT the status block; the controller re-reads GET /merchant/setup after
/// a mutation to refresh the verified picture.
@freezed
class SetupSnapshot with _$SetupSnapshot {
  const factory SetupSnapshot({
    @Default("") String name,
    @JsonKey(name: "default_country") String? defaultCountry,
    @JsonKey(name: "currency_code") @Default("usd") String currencyCode,
    @JsonKey(name: "supported_currencies")
    @Default(<String>[])
    List<String> supportedCurrencies,
    @Default(SetupBusiness()) SetupBusiness business,
    @JsonKey(name: "logo_url") String? logoUrl,
    @Default(SetupDraft()) SetupDraft setup,
    SetupStatus? status,
  }) = _SetupSnapshot;

  factory SetupSnapshot.fromJson(Map<String, dynamic> json) =>
      _$SetupSnapshotFromJson(json);
}
