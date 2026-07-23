import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "order_models.dart";

/// Thin transport for the merchant Orders endpoints, mirroring the web client's
/// `listOrders`, `getOrder`, `fulfillOrder`, `cancelOrder`, `captureOrderPayment`,
/// `createShipment`, `markDelivered` and `markOrderPaid`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// The backend list route filters by `status` + `q` server-side and returns up
/// to 200 rows (no server pagination); the list controller pages the result on
/// the client.
class OrdersRepository {
  OrdersRepository(this._dio);

  final Dio _dio;

  /// GET /merchant/orders?status=&q= -> { orders, count }.
  Future<List<OrderSummary>> listOrders({String? status, String? q}) async {
    try {
      final params = <String, dynamic>{};
      if (status != null && status.isNotEmpty) params["status"] = status;
      if (q != null && q.isNotEmpty) params["q"] = q;
      final res = await _dio.get<dynamic>(
        "/merchant/orders",
        queryParameters: params.isEmpty ? null : params,
      );
      final data = res.data;
      final raw = (data is Map ? data["orders"] : null) as List? ?? const [];
      return raw
          .map((e) => OrderSummary.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load orders");
    }
  }

  /// GET /merchant/orders/:id -> { order }.
  Future<OrderDetail> getOrder(String id) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/orders/$id");
      final data = res.data;
      final order = (data is Map ? data["order"] : null);
      if (order is! Map) {
        throw ApiError("This order could not be found.", 404, "not_found");
      }
      return OrderDetail.fromJson(Map<String, dynamic>.from(order));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load this order");
    }
  }

  /// POST /merchant/orders/:id/fulfill. Omitting [items] fulfils every
  /// outstanding line, mirroring the web default.
  Future<void> fulfillOrder(
    String id, {
    List<Map<String, dynamic>>? items,
    String? trackingNumber,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (items != null) body["items"] = items;
      if (trackingNumber != null && trackingNumber.isNotEmpty) {
        body["tracking_number"] = trackingNumber;
      }
      await _dio.post<dynamic>("/merchant/orders/$id/fulfill", data: body);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't fulfil this order");
    }
  }

  /// POST /merchant/orders/:id/shipments — marks a fulfilment shipped.
  Future<void> createShipment(
    String id, {
    required String fulfillmentId,
    List<String>? trackingNumbers,
  }) async {
    try {
      final body = <String, dynamic>{"fulfillment_id": fulfillmentId};
      if (trackingNumbers != null && trackingNumbers.isNotEmpty) {
        body["tracking_numbers"] = trackingNumbers;
      }
      await _dio.post<dynamic>("/merchant/orders/$id/shipments", data: body);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't mark this shipment");
    }
  }

  /// POST /merchant/orders/:id/deliveries — marks a fulfilment delivered.
  Future<void> markDelivered(
    String id, {
    required String fulfillmentId,
  }) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/orders/$id/deliveries",
        data: {"fulfillment_id": fulfillmentId},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't mark this delivery");
    }
  }

  /// POST /merchant/orders/:id/capture — captures the authorized payment.
  /// Omitting [amount] captures the full authorized amount.
  Future<void> capturePayment(String id, {num? amount}) async {
    try {
      final body = <String, dynamic>{};
      if (amount != null) body["amount"] = amount;
      await _dio.post<dynamic>("/merchant/orders/$id/capture", data: body);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't capture the payment");
    }
  }

  /// POST /merchant/orders/:id/cancel.
  Future<void> cancelOrder(String id) async {
    try {
      await _dio.post<dynamic>("/merchant/orders/$id/cancel");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't cancel this order");
    }
  }

  /// POST /merchant/orders/:id/mark-paid.
  Future<void> markOrderPaid(String id) async {
    try {
      await _dio.post<dynamic>("/merchant/orders/$id/mark-paid");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't mark this order paid");
    }
  }
}

final ordersRepositoryProvider = Provider<OrdersRepository>(
  (ref) => OrdersRepository(ref.read(dioProvider)),
);
