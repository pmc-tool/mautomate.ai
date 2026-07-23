import "package:dio/dio.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/dio_client.dart";
import "../auth/auth_controller.dart";
import "../auth/auth_store.dart";

/// A lean order summary, parsed from Medusa /store/orders.
@immutable
class StoreOrder {
  const StoreOrder({
    required this.id,
    this.displayId,
    this.status,
    this.total,
    this.currencyCode,
    this.createdAt,
    this.itemCount,
  });

  final String id;
  final int? displayId;
  final String? status;
  final num? total;
  final String? currencyCode;
  final String? createdAt;
  final int? itemCount;

  /// A "#1024"-style label, falling back to a shortened id.
  String get label => displayId != null
      ? "Order #$displayId"
      : "Order ${id.length > 8 ? id.substring(id.length - 8) : id}";

  factory StoreOrder.fromJson(Map<String, dynamic> json) {
    num? n(String key) {
      final v = json[key];
      return v is num ? v : null;
    }

    int? items;
    final raw = json["items"];
    if (raw is List) {
      items = raw.fold<int>(0, (sum, it) {
        final q = it is Map ? it["quantity"] : null;
        return sum + (q is num ? q.toInt() : 0);
      });
    }

    return StoreOrder(
      id: (json["id"] as String?) ?? "",
      displayId: (n("display_id"))?.toInt(),
      status: json["status"] as String?,
      total: n("total"),
      currencyCode: json["currency_code"] as String?,
      createdAt: json["created_at"] as String?,
      itemCount: items,
    );
  }
}

/// Read access to the signed-in customer order history via /store/orders.
class OrdersRepository {
  OrdersRepository(this._dio);

  final Dio _dio;

  static const String _fields =
      "id,display_id,status,total,currency_code,created_at,items.quantity";

  Future<List<StoreOrder>> list({
    required String token,
    int limit = 20,
    int offset = 0,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/orders",
      queryParameters: {
        "limit": limit,
        "offset": offset,
        "fields": _fields,
        "order": "-created_at",
      },
      options: Options(headers: {"Authorization": "Bearer $token"}),
    );
    final raw = res.data?["orders"];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((m) => StoreOrder.fromJson(m.cast<String, dynamic>()))
        .toList(growable: false);
  }
}

final ordersRepositoryProvider = Provider<OrdersRepository>(
  (ref) => OrdersRepository(ref.watch(storeDioProvider)),
);

/// The signed-in customer orders. Empty when signed out; refetches on
/// login/logout because it watches [authControllerProvider].
final ordersProvider = FutureProvider<List<StoreOrder>>((ref) async {
  final customer = ref.watch(authControllerProvider).valueOrNull;
  if (customer == null) return const [];
  final token = await ref.read(authStoreProvider).readToken();
  if (token == null || token.isEmpty) return const [];
  return ref.read(ordersRepositoryProvider).list(token: token);
});
