// Freezed DTOs for the Home dashboard, mirroring the merchant backend JSON the
// web dashboard consumes (apps/storefront/src/lib/merchant-admin/api.ts).
//
// Only the fields the Home surface needs are modelled; unknown JSON keys are
// ignored. Every field defaults so a partial/misshaped payload never throws.
//
// Run codegen after editing:
//   flutter pub run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern — the
// annotation is forwarded to the generated field, so the warning is a false
// positive here.
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "home_dtos.freezed.dart";
part "home_dtos.g.dart";

/// A row from GET /merchant/orders (`Order` in the web client). Totals are in
/// MAJOR currency units already — the web overview formats `order.total`
/// directly, so [MoneyText] is used with `minorUnits: false`.
@freezed
class HomeOrder with _$HomeOrder {
  const factory HomeOrder({
    @Default("") String id,
    @JsonKey(name: "display_id") @Default(0) int displayId,
    @Default("") String status,
    @JsonKey(name: "payment_status") String? paymentStatus,
    @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
    @JsonKey(name: "created_at") String? createdAt,
    @Default(0) num total,
    @JsonKey(name: "currency_code") @Default("USD") String currencyCode,
    String? email,
    @JsonKey(name: "customer_name") String? customerName,
    @JsonKey(name: "item_count") int? itemCount,
  }) = _HomeOrder;

  factory HomeOrder.fromJson(Map<String, dynamic> json) =>
      _$HomeOrderFromJson(json);
}

/// A row from GET /merchant/products (`Product` in the web client).
@freezed
class HomeProduct with _$HomeProduct {
  const factory HomeProduct({
    @Default("") String id,
    @Default("") String title,
    @Default("") String status,
    String? thumbnail,
    @JsonKey(name: "currency_code") String? currencyCode,
    num? price,
    num? stock,
    Map<String, dynamic>? metadata,
  }) = _HomeProduct;

  factory HomeProduct.fromJson(Map<String, dynamic> json) =>
      _$HomeProductFromJson(json);
}

/// One task from GET /merchant/setup/status (`SetupTask` in the web client).
/// `required` is a Dart contextual keyword, so it is exposed as [isRequired].
@freezed
class SetupTaskDto with _$SetupTaskDto {
  const factory SetupTaskDto({
    @Default("") String key,
    @Default("") String label,
    @Default("") String why,
    @JsonKey(name: "required") @Default(false) bool isRequired,
    @Default(false) bool done,
    @JsonKey(name: "blocker_detail") String? blockerDetail,
  }) = _SetupTaskDto;

  factory SetupTaskDto.fromJson(Map<String, dynamic> json) =>
      _$SetupTaskDtoFromJson(json);
}

/// GET /merchant/setup/status — the verified store-readiness picture shared
/// with the web overview's setup widget (`SetupStatus`).
@freezed
class SetupStatusDto with _$SetupStatusDto {
  const factory SetupStatusDto({
    @Default(<SetupTaskDto>[]) List<SetupTaskDto> tasks,
    @Default(0) int percent,
    @JsonKey(name: "ready_to_sell") @Default(true) bool readyToSell,
    @JsonKey(name: "missing_required")
    @Default(<String>[])
    List<String> missingRequired,
  }) = _SetupStatusDto;

  factory SetupStatusDto.fromJson(Map<String, dynamic> json) =>
      _$SetupStatusDtoFromJson(json);
}

/// The per-view badge counts nested in GET /merchant/marketing/conversations/counts.
@freezed
class InboxViewCounts with _$InboxViewCounts {
  const factory InboxViewCounts({
    @JsonKey(name: "needs_you") @Default(0) int needsYou,
    @Default(0) int unread,
    @Default(0) int open,
  }) = _InboxViewCounts;

  factory InboxViewCounts.fromJson(Map<String, dynamic> json) =>
      _$InboxViewCountsFromJson(json);
}

/// GET /merchant/marketing/conversations/counts (`InboxCounts`). Only the
/// `views` block is modelled — `needs_you` is the "hand to a human" signal.
@freezed
class InboxCountsDto with _$InboxCountsDto {
  const factory InboxCountsDto({
    @Default(InboxViewCounts()) InboxViewCounts views,
  }) = _InboxCountsDto;

  factory InboxCountsDto.fromJson(Map<String, dynamic> json) =>
      _$InboxCountsDtoFromJson(json);
}
