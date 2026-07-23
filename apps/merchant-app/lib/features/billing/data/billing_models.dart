// DTOs for the merchant Billing feature, mirroring the web client's
// `BillingOverview`, `BillingPlan`, `BillingUsageRow`, `BillingPack` and
// `CreditsResponse` (apps/storefront/src/lib/merchant-admin/api.ts) and the
// backend GET /merchant/billing/overview + GET /merchant/credits payloads.
// freezed + json_serializable generate parsing, equality and copyWith.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "billing_models.freezed.dart";
part "billing_models.g.dart";

/// A subscription tier — mirrors the web `BillingPlan`.
@freezed
class BillingPlan with _$BillingPlan {
  const factory BillingPlan({
    @Default("") String key,
    @Default("") String name,
    @JsonKey(name: "price_usd") @Default(0) num priceUsd,
    @JsonKey(name: "included_credits") @Default(0) num includedCredits,
    @JsonKey(name: "products_limit") num? productsLimit,
    @JsonKey(name: "seats_limit") num? seatsLimit,
    @JsonKey(name: "domains_limit") num? domainsLimit,
  }) = _BillingPlan;

  factory BillingPlan.fromJson(Map<String, dynamic> json) =>
      _$BillingPlanFromJson(json);
}

/// A per-feature usage row for the current cycle.
@freezed
class BillingUsageRow with _$BillingUsageRow {
  const factory BillingUsageRow({
    @Default("") String action,
    @Default("") String label,
    @Default(0) num units,
    @Default(0) num credits,
  }) = _BillingUsageRow;

  factory BillingUsageRow.fromJson(Map<String, dynamic> json) =>
      _$BillingUsageRowFromJson(json);
}

/// A purchasable credit pack.
@freezed
class BillingPack with _$BillingPack {
  const factory BillingPack({
    @Default(0) int credits,
    @JsonKey(name: "amount_usd") @Default(0) num amountUsd,
    @JsonKey(name: "bonus_pct") @Default(0) num bonusPct,
  }) = _BillingPack;

  factory BillingPack.fromJson(Map<String, dynamic> json) =>
      _$BillingPackFromJson(json);
}

/// The two credit buckets: plan credits expire at period end, purchased never
/// do.
@freezed
class CreditBuckets with _$CreditBuckets {
  const factory CreditBuckets({
    @Default(0) num total,
    @Default(0) num expiring,
    @Default(0) num purchased,
    @JsonKey(name: "next_expiry") String? nextExpiry,
  }) = _CreditBuckets;

  factory CreditBuckets.fromJson(Map<String, dynamic> json) =>
      _$CreditBucketsFromJson(json);
}

/// The authoritative wallet balance.
@freezed
class Wallet with _$Wallet {
  const factory Wallet({
    @Default(0) num balance,
    @Default(0) num reserved,
  }) = _Wallet;

  factory Wallet.fromJson(Map<String, dynamic> json) => _$WalletFromJson(json);
}

/// The monthly included-credit allowance and how much of it is used this cycle.
@freezed
class Allowance with _$Allowance {
  const factory Allowance({
    @Default(0) num included,
    @JsonKey(name: "used_this_cycle") @Default(0) num usedThisCycle,
    @JsonKey(name: "cycle_start") String? cycleStart,
  }) = _Allowance;

  factory Allowance.fromJson(Map<String, dynamic> json) =>
      _$AllowanceFromJson(json);
}

/// Whether a live payment gateway is configured (drives honest degraded copy).
@freezed
class GatewayInfo with _$GatewayInfo {
  const factory GatewayInfo({
    @Default(false) bool configured,
    String? name,
  }) = _GatewayInfo;

  factory GatewayInfo.fromJson(Map<String, dynamic> json) =>
      _$GatewayInfoFromJson(json);
}

/// GET /merchant/billing/overview — the whole Billing page payload.
@freezed
class BillingOverview with _$BillingOverview {
  const factory BillingOverview({
    @JsonKey(name: "credit_usd") @Default(0.01) num creditUsd,
    @JsonKey(name: "plan_status") @Default("") String planStatus,
    @JsonKey(name: "trial_ends_at") String? trialEndsAt,
    CreditBuckets? credits,
    @Default(Wallet()) Wallet wallet,
    @JsonKey(name: "current_plan") BillingPlan? currentPlan,
    @Default(<BillingPlan>[]) List<BillingPlan> plans,
    @Default(Allowance()) Allowance allowance,
    @Default(<BillingUsageRow>[]) List<BillingUsageRow> usage,
    @Default(<BillingPack>[]) List<BillingPack> packs,
    @Default(GatewayInfo()) GatewayInfo gateway,
  }) = _BillingOverview;

  factory BillingOverview.fromJson(Map<String, dynamic> json) =>
      _$BillingOverviewFromJson(json);
}

/// A single credit-history row — mirrors the web `CreditsResponse.transactions`.
@freezed
class CreditTransaction with _$CreditTransaction {
  const factory CreditTransaction({
    @Default("") String id,
    String? kind,
    String? label,
    String? type,
    @Default(0) num amount,
    @JsonKey(name: "created_at") @Default("") String createdAt,
  }) = _CreditTransaction;

  factory CreditTransaction.fromJson(Map<String, dynamic> json) =>
      _$CreditTransactionFromJson(json);
}

/// GET /merchant/credits — the credit wallet + paginated ledger history.
@freezed
class CreditsHistory with _$CreditsHistory {
  const factory CreditsHistory({
    @Default(0) num balance,
    @Default(<CreditTransaction>[]) List<CreditTransaction> transactions,
    @Default(0) int count,
    @JsonKey(name: "has_more") @Default(false) bool hasMore,
    @Default(0) int limit,
    @Default(0) int offset,
  }) = _CreditsHistory;

  factory CreditsHistory.fromJson(Map<String, dynamic> json) =>
      _$CreditsHistoryFromJson(json);
}

/// The outcome of a checkout-initiating action (buy pack / change plan).
///
/// When [checkoutUrl] is present the merchant must complete payment in a
/// browser; when it is null the action either applied immediately (plan change)
/// or the gateway isn't live yet — [message] carries the honest explanation.
class CheckoutOutcome {
  const CheckoutOutcome({this.checkoutUrl, this.message});

  final String? checkoutUrl;
  final String? message;

  bool get hasCheckout => checkoutUrl != null && checkoutUrl!.isNotEmpty;
}
