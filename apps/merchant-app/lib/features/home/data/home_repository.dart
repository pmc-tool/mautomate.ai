// Transport + aggregation for the Home dashboard. Mirrors the web
// `fetchOverview` (apps/storefront/src/lib/merchant-admin/api.ts): the same
// merchant endpoints, composed client-side into the headline numbers, recent
// orders, and the "Needs attention" surface.
//
// Fault model: the CORE aggregate (products / orders / customers / credits)
// must load for the screen to mean anything, so a failure there propagates.
// The setup-readiness and inbox signals are best-effort ENRICHMENT — each is
// wrapped so a disabled module or a transient error simply drops that one
// attention card instead of blanking the whole screen.
import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "home_dtos.dart";
import "home_models.dart";

/// Products at or below this on-hand count surface as a low-stock warning.
const int _kLowStockThreshold = 5;

/// Fulfilment states that still need the merchant to ship something.
const Set<String> _kAwaitingFulfilment = {
  "",
  "not_fulfilled",
  "unfulfilled",
  "partially_fulfilled",
  "partially_shipped",
};

/// Order states that are done/void and never count as "needs attention".
const Set<String> _kClosedOrderStates = {
  "canceled",
  "cancelled",
  "completed",
  "archived",
};

class HomeRepository {
  HomeRepository(this._dio);

  final Dio _dio;

  Map<String, dynamic> _asMap(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  List<dynamic> _asList(Object? v) => v is List ? v : const [];

  /// Loads and composes the whole Home snapshot. Throws [ApiError] only when
  /// the core aggregate fails.
  Future<HomeSnapshot> fetchHome() async {
    final results = await Future.wait([
      _listProducts(),
      _listOrders(),
      _customerCount(),
      _creditBalance(),
    ]);

    final products = results[0] as List<HomeProduct>;
    final orders = results[1] as List<HomeOrder>;
    final customers = results[2] as int;
    final creditBalance = results[3] as num;

    final stats = _deriveStats(
      products: products,
      orders: orders,
      customers: customers,
      creditBalance: creditBalance,
    );

    // Best-effort enrichment — each failure is swallowed to null.
    final enrichment = await Future.wait([
      _setupStatus(),
      _inboxCounts(),
    ]);
    final setup = enrichment[0] as SetupStatusDto?;
    final inbox = enrichment[1] as InboxCountsDto?;

    final attention = _deriveAttention(
      orders: orders,
      products: products,
      setup: setup,
      inbox: inbox,
    );

    final recent = [...orders]
      ..sort((a, b) => (b.createdAt ?? "").compareTo(a.createdAt ?? ""));

    return HomeSnapshot(
      stats: stats,
      recentOrders: recent.take(5).toList(),
      attention: attention,
    );
  }

  // -------------------------------------------------------------- core fetch

  Future<List<HomeProduct>> _listProducts() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/products");
      return _asList(_asMap(res.data)["products"])
          .map((e) => HomeProduct.fromJson(_asMap(e)))
          .toList();
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load products");
    }
  }

  Future<List<HomeOrder>> _listOrders() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/orders");
      return _asList(_asMap(res.data)["orders"])
          .map((e) => HomeOrder.fromJson(_asMap(e)))
          .toList();
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load orders");
    }
  }

  Future<int> _customerCount() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/customers");
      final data = _asMap(res.data);
      final list = _asList(data["customers"]);
      final count = data["count"];
      return count is num ? count.toInt() : list.length;
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load customers");
    }
  }

  Future<num> _creditBalance() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/credits");
      final balance = _asMap(res.data)["balance"];
      return balance is num ? balance : 0;
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load credit balance");
    }
  }

  // -------------------------------------------------- best-effort enrichment

  Future<SetupStatusDto?> _setupStatus() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/setup/status");
      return SetupStatusDto.fromJson(_asMap(res.data));
    } catch (_) {
      return null;
    }
  }

  Future<InboxCountsDto?> _inboxCounts() async {
    try {
      final res =
          await _dio.get<dynamic>("/merchant/marketing/conversations/counts");
      return InboxCountsDto.fromJson(_asMap(res.data));
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------------------------- derivation

  HomeStats _deriveStats({
    required List<HomeProduct> products,
    required List<HomeOrder> orders,
    required int customers,
    required num creditBalance,
  }) {
    final now = DateTime.now();
    final startOfMonth = DateTime(now.year, now.month);

    num totalSales = 0;
    var ordersThisMonth = 0;
    for (final o in orders) {
      totalSales += o.total;
      final created = DateTime.tryParse(o.createdAt ?? "");
      if (created != null && !created.isBefore(startOfMonth)) {
        ordersThisMonth++;
      }
    }

    final productsLive = products
        .where((p) =>
            p.status == "published" && p.metadata?["is_sample"] != true)
        .length;

    final currencyCode =
        orders.isNotEmpty ? orders.first.currencyCode : "USD";

    return HomeStats(
      totalSales: totalSales,
      ordersThisMonth: ordersThisMonth,
      productsLive: productsLive,
      customers: customers,
      creditBalance: creditBalance,
      currencyCode: currencyCode,
    );
  }

  List<AttentionItem> _deriveAttention({
    required List<HomeOrder> orders,
    required List<HomeProduct> products,
    required SetupStatusDto? setup,
    required InboxCountsDto? inbox,
  }) {
    final items = <AttentionItem>[];

    // 1. Store not ready to sell — the same verified engine as the web setup
    //    widget. Highest priority: nothing else matters if you can't sell.
    if (setup != null && !setup.readyToSell) {
      final next = setup.tasks
          .cast<SetupTaskDto?>()
          .firstWhere((t) => t!.isRequired && !t.done, orElse: () => null);
      final missing = setup.missingRequired.length;
      items.add(AttentionItem(
        id: "setup",
        title: "Finish setting up your shop",
        detail: next != null
            ? "Next: ${next.label}"
            : "$missing required ${missing == 1 ? "step" : "steps"} left before you can sell.",
        icon: PhosphorIconsRegular.storefront,
        tone: AttentionTone.warning,
        count: missing > 0 ? missing : null,
      ));
    }

    // 2. Orders awaiting fulfilment — the merchant needs to ship.
    final awaiting = orders.where((o) {
      final status = o.status.toLowerCase();
      if (_kClosedOrderStates.contains(status)) return false;
      final f = (o.fulfillmentStatus ?? "").toLowerCase();
      return _kAwaitingFulfilment.contains(f);
    }).length;
    if (awaiting > 0) {
      items.add(AttentionItem(
        id: "unfulfilled_orders",
        title: awaiting == 1 ? "1 order to fulfil" : "$awaiting orders to fulfil",
        detail: "Awaiting shipment — review and fulfil to keep customers happy.",
        icon: PhosphorIconsRegular.package,
        tone: AttentionTone.info,
        route: "/orders",
        count: awaiting,
      ));
    }

    // 3. A human is needed in the inbox.
    final needsYou = inbox?.views.needsYou ?? 0;
    if (needsYou > 0) {
      items.add(AttentionItem(
        id: "inbox_needs_you",
        title: needsYou == 1
            ? "1 conversation needs you"
            : "$needsYou conversations need you",
        detail: "The AI handed these to a human. A reply is waiting.",
        icon: PhosphorIconsRegular.chatCircle,
        tone: AttentionTone.warning,
        count: needsYou,
      ));
    }

    // 4. Low or out-of-stock products.
    final lowStock = products
        .where((p) => p.stock != null && p.stock! <= _kLowStockThreshold)
        .length;
    if (lowStock > 0) {
      items.add(AttentionItem(
        id: "low_stock",
        title: lowStock == 1 ? "1 product low on stock" : "$lowStock products low on stock",
        detail: "At or below $_kLowStockThreshold in stock — restock before they sell out.",
        icon: PhosphorIconsRegular.warning,
        tone: AttentionTone.danger,
        route: "/products",
        count: lowStock,
      ));
    }

    return items;
  }
}

/// Home data-access, bound to the shared authenticated [dioProvider].
final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(ref.read(dioProvider)),
);
