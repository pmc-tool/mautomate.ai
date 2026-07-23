// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$OrderSummaryImpl _$$OrderSummaryImplFromJson(Map<String, dynamic> json) =>
    _$OrderSummaryImpl(
      id: json['id'] as String? ?? "",
      displayId: json['display_id'] == null ? 0 : _toInt(json['display_id']),
      status: json['status'] as String? ?? "",
      paymentStatus: json['payment_status'] as String?,
      fulfillmentStatus: json['fulfillment_status'] as String?,
      createdAt: json['created_at'] as String? ?? "",
      total: json['total'] as num? ?? 0,
      currencyCode: json['currency_code'] as String? ?? "usd",
      email: json['email'] as String?,
      customerName: json['customer_name'] as String?,
      countryCode: json['country_code'] as String?,
      itemCount: (json['item_count'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$OrderSummaryImplToJson(_$OrderSummaryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'display_id': instance.displayId,
      'status': instance.status,
      'payment_status': instance.paymentStatus,
      'fulfillment_status': instance.fulfillmentStatus,
      'created_at': instance.createdAt,
      'total': instance.total,
      'currency_code': instance.currencyCode,
      'email': instance.email,
      'customer_name': instance.customerName,
      'country_code': instance.countryCode,
      'item_count': instance.itemCount,
    };

_$OrdersListResponseImpl _$$OrdersListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$OrdersListResponseImpl(
      orders: (json['orders'] as List<dynamic>?)
              ?.map((e) => OrderSummary.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderSummary>[],
      count: (json['count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$OrdersListResponseImplToJson(
        _$OrdersListResponseImpl instance) =>
    <String, dynamic>{
      'orders': instance.orders,
      'count': instance.count,
    };

_$OrderItemDetailImpl _$$OrderItemDetailImplFromJson(
        Map<String, dynamic> json) =>
    _$OrderItemDetailImpl(
      quantity: json['quantity'] as num? ?? 0,
      fulfilledQuantity: json['fulfilled_quantity'] as num? ?? 0,
      shippedQuantity: json['shipped_quantity'] as num? ?? 0,
      deliveredQuantity: json['delivered_quantity'] as num? ?? 0,
      returnRequestedQuantity: json['return_requested_quantity'] as num? ?? 0,
      returnReceivedQuantity: json['return_received_quantity'] as num? ?? 0,
    );

Map<String, dynamic> _$$OrderItemDetailImplToJson(
        _$OrderItemDetailImpl instance) =>
    <String, dynamic>{
      'quantity': instance.quantity,
      'fulfilled_quantity': instance.fulfilledQuantity,
      'shipped_quantity': instance.shippedQuantity,
      'delivered_quantity': instance.deliveredQuantity,
      'return_requested_quantity': instance.returnRequestedQuantity,
      'return_received_quantity': instance.returnReceivedQuantity,
    };

_$OrderItemImpl _$$OrderItemImplFromJson(Map<String, dynamic> json) =>
    _$OrderItemImpl(
      id: json['id'] as String? ?? "",
      title: json['title'] as String? ?? "",
      subtitle: json['subtitle'] as String?,
      productTitle: json['product_title'] as String?,
      variantTitle: json['variant_title'] as String?,
      sku: json['sku'] as String?,
      productId: json['product_id'] as String?,
      quantity: json['quantity'] as num? ?? 0,
      unitPrice: json['unit_price'] as num? ?? 0,
      subtotal: json['subtotal'] as num? ?? 0,
      total: json['total'] as num? ?? 0,
      taxTotal: json['tax_total'] as num? ?? 0,
      discountTotal: json['discount_total'] as num? ?? 0,
      originalTotal: json['original_total'] as num? ?? 0,
      thumbnail: json['thumbnail'] as String?,
      detail: json['detail'] == null
          ? null
          : OrderItemDetail.fromJson(json['detail'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$OrderItemImplToJson(_$OrderItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'subtitle': instance.subtitle,
      'product_title': instance.productTitle,
      'variant_title': instance.variantTitle,
      'sku': instance.sku,
      'product_id': instance.productId,
      'quantity': instance.quantity,
      'unit_price': instance.unitPrice,
      'subtotal': instance.subtotal,
      'total': instance.total,
      'tax_total': instance.taxTotal,
      'discount_total': instance.discountTotal,
      'original_total': instance.originalTotal,
      'thumbnail': instance.thumbnail,
      'detail': instance.detail,
    };

_$OrderCustomerImpl _$$OrderCustomerImplFromJson(Map<String, dynamic> json) =>
    _$OrderCustomerImpl(
      id: json['id'] as String? ?? "",
      email: json['email'] as String? ?? "",
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      phone: json['phone'] as String?,
      companyName: json['company_name'] as String?,
      hasAccount: json['has_account'] as bool?,
      orderCount: json['order_count'] as num?,
    );

Map<String, dynamic> _$$OrderCustomerImplToJson(_$OrderCustomerImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
      'phone': instance.phone,
      'company_name': instance.companyName,
      'has_account': instance.hasAccount,
      'order_count': instance.orderCount,
    };

_$OrderAddressImpl _$$OrderAddressImplFromJson(Map<String, dynamic> json) =>
    _$OrderAddressImpl(
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      address1: json['address_1'] as String?,
      address2: json['address_2'] as String?,
      city: json['city'] as String?,
      province: json['province'] as String?,
      postalCode: json['postal_code'] as String?,
      countryCode: json['country_code'] as String?,
      phone: json['phone'] as String?,
    );

Map<String, dynamic> _$$OrderAddressImplToJson(_$OrderAddressImpl instance) =>
    <String, dynamic>{
      'first_name': instance.firstName,
      'last_name': instance.lastName,
      'address_1': instance.address1,
      'address_2': instance.address2,
      'city': instance.city,
      'province': instance.province,
      'postal_code': instance.postalCode,
      'country_code': instance.countryCode,
      'phone': instance.phone,
    };

_$PaymentCaptureImpl _$$PaymentCaptureImplFromJson(Map<String, dynamic> json) =>
    _$PaymentCaptureImpl(
      id: json['id'] as String? ?? "",
      amount: json['amount'] as num? ?? 0,
    );

Map<String, dynamic> _$$PaymentCaptureImplToJson(
        _$PaymentCaptureImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
    };

_$OrderRefundImpl _$$OrderRefundImplFromJson(Map<String, dynamic> json) =>
    _$OrderRefundImpl(
      id: json['id'] as String? ?? "",
      amount: json['amount'] as num? ?? 0,
      createdAt: json['created_at'] as String?,
      note: json['note'] as String?,
      reason: json['reason'] as String?,
    );

Map<String, dynamic> _$$OrderRefundImplToJson(_$OrderRefundImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
      'created_at': instance.createdAt,
      'note': instance.note,
      'reason': instance.reason,
    };

_$OrderPaymentImpl _$$OrderPaymentImplFromJson(Map<String, dynamic> json) =>
    _$OrderPaymentImpl(
      id: json['id'] as String? ?? "",
      amount: json['amount'] as num? ?? 0,
      currencyCode: json['currency_code'] as String?,
      providerId: json['provider_id'] as String?,
      createdAt: json['created_at'] as String?,
      capturedAt: json['captured_at'] as String?,
      canceledAt: json['canceled_at'] as String?,
      capturedAmount: json['captured_amount'] as num? ?? 0,
      refundedAmount: json['refunded_amount'] as num? ?? 0,
      captures: (json['captures'] as List<dynamic>?)
              ?.map((e) => PaymentCapture.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <PaymentCapture>[],
      refunds: (json['refunds'] as List<dynamic>?)
              ?.map((e) => OrderRefund.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderRefund>[],
    );

Map<String, dynamic> _$$OrderPaymentImplToJson(_$OrderPaymentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
      'currency_code': instance.currencyCode,
      'provider_id': instance.providerId,
      'created_at': instance.createdAt,
      'captured_at': instance.capturedAt,
      'canceled_at': instance.canceledAt,
      'captured_amount': instance.capturedAmount,
      'refunded_amount': instance.refundedAmount,
      'captures': instance.captures,
      'refunds': instance.refunds,
    };

_$FulfillmentItemImpl _$$FulfillmentItemImplFromJson(
        Map<String, dynamic> json) =>
    _$FulfillmentItemImpl(
      title: json['title'] as String? ?? "",
      quantity: json['quantity'] as num? ?? 0,
      lineItemId: json['line_item_id'] as String? ?? "",
    );

Map<String, dynamic> _$$FulfillmentItemImplToJson(
        _$FulfillmentItemImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'quantity': instance.quantity,
      'line_item_id': instance.lineItemId,
    };

_$FulfillmentLabelImpl _$$FulfillmentLabelImplFromJson(
        Map<String, dynamic> json) =>
    _$FulfillmentLabelImpl(
      trackingNumber: json['tracking_number'] as String?,
      trackingUrl: json['tracking_url'] as String?,
    );

Map<String, dynamic> _$$FulfillmentLabelImplToJson(
        _$FulfillmentLabelImpl instance) =>
    <String, dynamic>{
      'tracking_number': instance.trackingNumber,
      'tracking_url': instance.trackingUrl,
    };

_$OrderFulfillmentImpl _$$OrderFulfillmentImplFromJson(
        Map<String, dynamic> json) =>
    _$OrderFulfillmentImpl(
      id: json['id'] as String? ?? "",
      createdAt: json['created_at'] as String?,
      packedAt: json['packed_at'] as String?,
      shippedAt: json['shipped_at'] as String?,
      deliveredAt: json['delivered_at'] as String?,
      canceledAt: json['canceled_at'] as String?,
      providerId: json['provider_id'] as String?,
      locationId: json['location_id'] as String?,
      shippingOptionName: json['shipping_option_name'] as String?,
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => FulfillmentItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <FulfillmentItem>[],
      labels: (json['labels'] as List<dynamic>?)
              ?.map((e) => FulfillmentLabel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <FulfillmentLabel>[],
    );

Map<String, dynamic> _$$OrderFulfillmentImplToJson(
        _$OrderFulfillmentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'created_at': instance.createdAt,
      'packed_at': instance.packedAt,
      'shipped_at': instance.shippedAt,
      'delivered_at': instance.deliveredAt,
      'canceled_at': instance.canceledAt,
      'provider_id': instance.providerId,
      'location_id': instance.locationId,
      'shipping_option_name': instance.shippingOptionName,
      'items': instance.items,
      'labels': instance.labels,
    };

_$OrderShippingMethodImpl _$$OrderShippingMethodImplFromJson(
        Map<String, dynamic> json) =>
    _$OrderShippingMethodImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String? ?? "",
      amount: json['amount'] as num? ?? 0,
      total: json['total'] as num? ?? 0,
      subtotal: json['subtotal'] as num? ?? 0,
      taxTotal: json['tax_total'] as num? ?? 0,
    );

Map<String, dynamic> _$$OrderShippingMethodImplToJson(
        _$OrderShippingMethodImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'amount': instance.amount,
      'total': instance.total,
      'subtotal': instance.subtotal,
      'tax_total': instance.taxTotal,
    };

_$OrderSalesChannelImpl _$$OrderSalesChannelImplFromJson(
        Map<String, dynamic> json) =>
    _$OrderSalesChannelImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String? ?? "",
    );

Map<String, dynamic> _$$OrderSalesChannelImplToJson(
        _$OrderSalesChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
    };

_$OrderDetailImpl _$$OrderDetailImplFromJson(Map<String, dynamic> json) =>
    _$OrderDetailImpl(
      id: json['id'] as String? ?? "",
      displayId: json['display_id'] == null ? 0 : _toInt(json['display_id']),
      status: json['status'] as String? ?? "",
      paymentStatus: json['payment_status'] as String? ?? "",
      fulfillmentStatus: json['fulfillment_status'] as String? ?? "",
      email: json['email'] as String?,
      currencyCode: json['currency_code'] as String? ?? "usd",
      createdAt: json['created_at'] as String? ?? "",
      canceledAt: json['canceled_at'] as String?,
      total: json['total'] as num? ?? 0,
      subtotal: json['subtotal'] as num? ?? 0,
      itemSubtotal: json['item_subtotal'] as num? ?? 0,
      itemTotal: json['item_total'] as num? ?? 0,
      shippingTotal: json['shipping_total'] as num? ?? 0,
      taxTotal: json['tax_total'] as num? ?? 0,
      discountTotal: json['discount_total'] as num? ?? 0,
      paidTotal: json['paid_total'] as num? ?? 0,
      refundedTotal: json['refunded_total'] as num? ?? 0,
      outstanding: json['outstanding'] as num? ?? 0,
      originalTotal: json['original_total'] as num? ?? 0,
      salesChannel: json['sales_channel'] == null
          ? null
          : OrderSalesChannel.fromJson(
              json['sales_channel'] as Map<String, dynamic>),
      customer: json['customer'] == null
          ? null
          : OrderCustomer.fromJson(json['customer'] as Map<String, dynamic>),
      shippingAddress: json['shipping_address'] == null
          ? null
          : OrderAddress.fromJson(
              json['shipping_address'] as Map<String, dynamic>),
      billingAddress: json['billing_address'] == null
          ? null
          : OrderAddress.fromJson(
              json['billing_address'] as Map<String, dynamic>),
      shippingMethods: (json['shipping_methods'] as List<dynamic>?)
              ?.map((e) =>
                  OrderShippingMethod.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderShippingMethod>[],
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderItem>[],
      payments: (json['payments'] as List<dynamic>?)
              ?.map((e) => OrderPayment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderPayment>[],
      fulfillments: (json['fulfillments'] as List<dynamic>?)
              ?.map((e) => OrderFulfillment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <OrderFulfillment>[],
    );

Map<String, dynamic> _$$OrderDetailImplToJson(_$OrderDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'display_id': instance.displayId,
      'status': instance.status,
      'payment_status': instance.paymentStatus,
      'fulfillment_status': instance.fulfillmentStatus,
      'email': instance.email,
      'currency_code': instance.currencyCode,
      'created_at': instance.createdAt,
      'canceled_at': instance.canceledAt,
      'total': instance.total,
      'subtotal': instance.subtotal,
      'item_subtotal': instance.itemSubtotal,
      'item_total': instance.itemTotal,
      'shipping_total': instance.shippingTotal,
      'tax_total': instance.taxTotal,
      'discount_total': instance.discountTotal,
      'paid_total': instance.paidTotal,
      'refunded_total': instance.refundedTotal,
      'outstanding': instance.outstanding,
      'original_total': instance.originalTotal,
      'sales_channel': instance.salesChannel,
      'customer': instance.customer,
      'shipping_address': instance.shippingAddress,
      'billing_address': instance.billingAddress,
      'shipping_methods': instance.shippingMethods,
      'items': instance.items,
      'payments': instance.payments,
      'fulfillments': instance.fulfillments,
    };
