// DTOs for the merchant Orders feature, mirroring the web client's `Order`,
// `OrderDetail` and their nested shapes (apps/storefront/src/lib/merchant-admin/
// api.ts). freezed + json_serializable so parsing, equality and copyWith are
// generated. Field names are snake_case on the wire, camelCase in Dart via
// @JsonKey.
//
// Run codegen after editing:
//   flutter pub run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern — the
// annotation is forwarded to the generated field, so the warning is a false
// positive (same convention as the Products + Jarvis DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "order_models.freezed.dart";
part "order_models.g.dart";

// The backend occasionally sends a per-store order number as a string
// (order.metadata.store_order_no); coerce to int so display is uniform.
int _toInt(Object? v) =>
    v is int ? v : (v is num ? v.toInt() : int.tryParse("$v") ?? 0);

/// A row in the orders list — mirrors the web `Order` type
/// (GET /merchant/orders -> { orders, count }).
@freezed
class OrderSummary with _$OrderSummary {
  const factory OrderSummary({
    @Default("") String id,
    @JsonKey(name: "display_id", fromJson: _toInt) @Default(0) int displayId,
    @Default("") String status,
    @JsonKey(name: "payment_status") String? paymentStatus,
    @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    @Default(0) num total,
    @JsonKey(name: "currency_code") @Default("usd") String currencyCode,
    String? email,
    @JsonKey(name: "customer_name") String? customerName,
    @JsonKey(name: "country_code") String? countryCode,
    @JsonKey(name: "item_count") int? itemCount,
  }) = _OrderSummary;

  factory OrderSummary.fromJson(Map<String, dynamic> json) =>
      _$OrderSummaryFromJson(json);
}

/// GET /merchant/orders -> { orders, count }.
@freezed
class OrdersListResponse with _$OrdersListResponse {
  const factory OrdersListResponse({
    @Default(<OrderSummary>[]) List<OrderSummary> orders,
    @Default(0) int count,
  }) = _OrdersListResponse;

  factory OrdersListResponse.fromJson(Map<String, dynamic> json) =>
      _$OrdersListResponseFromJson(json);
}

@freezed
class OrderItemDetail with _$OrderItemDetail {
  const factory OrderItemDetail({
    @Default(0) num quantity,
    @JsonKey(name: "fulfilled_quantity") @Default(0) num fulfilledQuantity,
    @JsonKey(name: "shipped_quantity") @Default(0) num shippedQuantity,
    @JsonKey(name: "delivered_quantity") @Default(0) num deliveredQuantity,
    @JsonKey(name: "return_requested_quantity")
    @Default(0)
    num returnRequestedQuantity,
    @JsonKey(name: "return_received_quantity")
    @Default(0)
    num returnReceivedQuantity,
  }) = _OrderItemDetail;

  factory OrderItemDetail.fromJson(Map<String, dynamic> json) =>
      _$OrderItemDetailFromJson(json);
}

@freezed
class OrderItem with _$OrderItem {
  const factory OrderItem({
    @Default("") String id,
    @Default("") String title,
    String? subtitle,
    @JsonKey(name: "product_title") String? productTitle,
    @JsonKey(name: "variant_title") String? variantTitle,
    String? sku,
    @JsonKey(name: "product_id") String? productId,
    @Default(0) num quantity,
    @JsonKey(name: "unit_price") @Default(0) num unitPrice,
    @Default(0) num subtotal,
    @Default(0) num total,
    @JsonKey(name: "tax_total") @Default(0) num taxTotal,
    @JsonKey(name: "discount_total") @Default(0) num discountTotal,
    @JsonKey(name: "original_total") @Default(0) num originalTotal,
    String? thumbnail,
    OrderItemDetail? detail,
  }) = _OrderItem;

  factory OrderItem.fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);
}

@freezed
class OrderCustomer with _$OrderCustomer {
  const factory OrderCustomer({
    @Default("") String id,
    @Default("") String email,
    @JsonKey(name: "first_name") String? firstName,
    @JsonKey(name: "last_name") String? lastName,
    String? phone,
    @JsonKey(name: "company_name") String? companyName,
    @JsonKey(name: "has_account") bool? hasAccount,
    @JsonKey(name: "order_count") num? orderCount,
  }) = _OrderCustomer;

  factory OrderCustomer.fromJson(Map<String, dynamic> json) =>
      _$OrderCustomerFromJson(json);
}

@freezed
class OrderAddress with _$OrderAddress {
  const factory OrderAddress({
    @JsonKey(name: "first_name") String? firstName,
    @JsonKey(name: "last_name") String? lastName,
    @JsonKey(name: "address_1") String? address1,
    @JsonKey(name: "address_2") String? address2,
    String? city,
    String? province,
    @JsonKey(name: "postal_code") String? postalCode,
    @JsonKey(name: "country_code") String? countryCode,
    String? phone,
  }) = _OrderAddress;

  factory OrderAddress.fromJson(Map<String, dynamic> json) =>
      _$OrderAddressFromJson(json);
}

@freezed
class PaymentCapture with _$PaymentCapture {
  const factory PaymentCapture({
    @Default("") String id,
    @Default(0) num amount,
  }) = _PaymentCapture;

  factory PaymentCapture.fromJson(Map<String, dynamic> json) =>
      _$PaymentCaptureFromJson(json);
}

@freezed
class OrderRefund with _$OrderRefund {
  const factory OrderRefund({
    @Default("") String id,
    @Default(0) num amount,
    @JsonKey(name: "created_at") String? createdAt,
    String? note,
    String? reason,
  }) = _OrderRefund;

  factory OrderRefund.fromJson(Map<String, dynamic> json) =>
      _$OrderRefundFromJson(json);
}

@freezed
class OrderPayment with _$OrderPayment {
  const factory OrderPayment({
    @Default("") String id,
    @Default(0) num amount,
    @JsonKey(name: "currency_code") String? currencyCode,
    @JsonKey(name: "provider_id") String? providerId,
    @JsonKey(name: "created_at") String? createdAt,
    @JsonKey(name: "captured_at") String? capturedAt,
    @JsonKey(name: "canceled_at") String? canceledAt,
    @JsonKey(name: "captured_amount") @Default(0) num capturedAmount,
    @JsonKey(name: "refunded_amount") @Default(0) num refundedAmount,
    @Default(<PaymentCapture>[]) List<PaymentCapture> captures,
    @Default(<OrderRefund>[]) List<OrderRefund> refunds,
  }) = _OrderPayment;

  factory OrderPayment.fromJson(Map<String, dynamic> json) =>
      _$OrderPaymentFromJson(json);
}

@freezed
class FulfillmentItem with _$FulfillmentItem {
  const factory FulfillmentItem({
    @Default("") String title,
    @Default(0) num quantity,
    @JsonKey(name: "line_item_id") @Default("") String lineItemId,
  }) = _FulfillmentItem;

  factory FulfillmentItem.fromJson(Map<String, dynamic> json) =>
      _$FulfillmentItemFromJson(json);
}

@freezed
class FulfillmentLabel with _$FulfillmentLabel {
  const factory FulfillmentLabel({
    @JsonKey(name: "tracking_number") String? trackingNumber,
    @JsonKey(name: "tracking_url") String? trackingUrl,
  }) = _FulfillmentLabel;

  factory FulfillmentLabel.fromJson(Map<String, dynamic> json) =>
      _$FulfillmentLabelFromJson(json);
}

@freezed
class OrderFulfillment with _$OrderFulfillment {
  const factory OrderFulfillment({
    @Default("") String id,
    @JsonKey(name: "created_at") String? createdAt,
    @JsonKey(name: "packed_at") String? packedAt,
    @JsonKey(name: "shipped_at") String? shippedAt,
    @JsonKey(name: "delivered_at") String? deliveredAt,
    @JsonKey(name: "canceled_at") String? canceledAt,
    @JsonKey(name: "provider_id") String? providerId,
    @JsonKey(name: "location_id") String? locationId,
    @JsonKey(name: "shipping_option_name") String? shippingOptionName,
    @Default(<FulfillmentItem>[]) List<FulfillmentItem> items,
    @Default(<FulfillmentLabel>[]) List<FulfillmentLabel> labels,
  }) = _OrderFulfillment;

  factory OrderFulfillment.fromJson(Map<String, dynamic> json) =>
      _$OrderFulfillmentFromJson(json);
}

@freezed
class OrderShippingMethod with _$OrderShippingMethod {
  const factory OrderShippingMethod({
    @Default("") String id,
    @Default("") String name,
    @Default(0) num amount,
    @Default(0) num total,
    @Default(0) num subtotal,
    @JsonKey(name: "tax_total") @Default(0) num taxTotal,
  }) = _OrderShippingMethod;

  factory OrderShippingMethod.fromJson(Map<String, dynamic> json) =>
      _$OrderShippingMethodFromJson(json);
}

@freezed
class OrderSalesChannel with _$OrderSalesChannel {
  const factory OrderSalesChannel({
    @Default("") String id,
    @Default("") String name,
  }) = _OrderSalesChannel;

  factory OrderSalesChannel.fromJson(Map<String, dynamic> json) =>
      _$OrderSalesChannelFromJson(json);
}

/// GET /merchant/orders/:id -> { order }. Mirrors the web `OrderDetail`.
@freezed
class OrderDetail with _$OrderDetail {
  const factory OrderDetail({
    @Default("") String id,
    @JsonKey(name: "display_id", fromJson: _toInt) @Default(0) int displayId,
    @Default("") String status,
    @JsonKey(name: "payment_status") @Default("") String paymentStatus,
    @JsonKey(name: "fulfillment_status") @Default("") String fulfillmentStatus,
    String? email,
    @JsonKey(name: "currency_code") @Default("usd") String currencyCode,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    @JsonKey(name: "canceled_at") String? canceledAt,
    @Default(0) num total,
    @Default(0) num subtotal,
    @JsonKey(name: "item_subtotal") @Default(0) num itemSubtotal,
    @JsonKey(name: "item_total") @Default(0) num itemTotal,
    @JsonKey(name: "shipping_total") @Default(0) num shippingTotal,
    @JsonKey(name: "tax_total") @Default(0) num taxTotal,
    @JsonKey(name: "discount_total") @Default(0) num discountTotal,
    @JsonKey(name: "paid_total") @Default(0) num paidTotal,
    @JsonKey(name: "refunded_total") @Default(0) num refundedTotal,
    @Default(0) num outstanding,
    @JsonKey(name: "original_total") @Default(0) num originalTotal,
    @JsonKey(name: "sales_channel") OrderSalesChannel? salesChannel,
    OrderCustomer? customer,
    @JsonKey(name: "shipping_address") OrderAddress? shippingAddress,
    @JsonKey(name: "billing_address") OrderAddress? billingAddress,
    @JsonKey(name: "shipping_methods")
    @Default(<OrderShippingMethod>[])
    List<OrderShippingMethod> shippingMethods,
    @Default(<OrderItem>[]) List<OrderItem> items,
    @Default(<OrderPayment>[]) List<OrderPayment> payments,
    @Default(<OrderFulfillment>[]) List<OrderFulfillment> fulfillments,
  }) = _OrderDetail;

  factory OrderDetail.fromJson(Map<String, dynamic> json) =>
      _$OrderDetailFromJson(json);
}
