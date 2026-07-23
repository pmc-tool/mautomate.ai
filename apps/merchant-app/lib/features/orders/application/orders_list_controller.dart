import "dart:async";
import "dart:math" as math;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/order_models.dart";
import "../data/orders_repository.dart";

/// How many rows a "page" reveals as the merchant scrolls. The backend returns
/// the full (capped) result in one call, so paging is client-side.
const int kOrdersPageSize = 20;

/// A selectable order-status filter — mirrors the web `statusOptions`
/// (null = "All").
class OrderStatusOption {
  const OrderStatusOption(this.label, this.value);
  final String label;
  final String? value;
}

const List<OrderStatusOption> kOrderStatusOptions = [
  OrderStatusOption("All", null),
  OrderStatusOption("Pending", "pending"),
  OrderStatusOption("Processing", "processing"),
  OrderStatusOption("Completed", "completed"),
  OrderStatusOption("Canceled", "canceled"),
];

/// Immutable state for the orders list: the full server result, the visible
/// window, the active search/status filters, and load/error flags.
class OrdersListState {
  const OrdersListState({
    this.orders = const <OrderSummary>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
    this.query = "",
    this.status,
    this.visibleCount = kOrdersPageSize,
  });

  /// The full result set from the server (already filtered by status/query).
  final List<OrderSummary> orders;

  /// Initial load in flight (no data yet).
  final bool isLoading;

  /// A pull-to-refresh is in flight (data already on screen).
  final bool isRefreshing;

  /// The last load error, when any.
  final ApiError? error;

  /// The active search term.
  final String query;

  /// The active status filter (null = All).
  final String? status;

  /// How many rows of [orders] are currently revealed.
  final int visibleCount;

  /// The rows to render (the revealed window).
  List<OrderSummary> get visible =>
      orders.take(visibleCount).toList(growable: false);

  /// Whether more already-loaded rows can be revealed.
  bool get hasMore => visibleCount < orders.length;

  /// True once a load has completed with no rows and no error.
  bool get isEmpty => !isLoading && error == null && orders.isEmpty;

  /// Whether a search or status filter is narrowing the list.
  bool get hasFilters => query.trim().isNotEmpty || status != null;

  static const Object _keep = Object();

  OrdersListState copyWith({
    List<OrderSummary>? orders,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
    String? query,
    Object? status = _keep,
    int? visibleCount,
  }) {
    return OrdersListState(
      orders: orders ?? this.orders,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
      query: query ?? this.query,
      status: status == _keep ? this.status : status as String?,
      visibleCount: visibleCount ?? this.visibleCount,
    );
  }
}

/// Loads and filters the orders list. Search is debounced; status changes and
/// pull-to-refresh re-query the server; scrolling reveals more of the loaded
/// result without another request.
class OrdersListController extends Notifier<OrdersListState> {
  Timer? _debounce;

  @override
  OrdersListState build() {
    ref.onDispose(() => _debounce?.cancel());
    Future.microtask(_load);
    return const OrdersListState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final q = state.query.trim();
      final orders = await ref.read(ordersRepositoryProvider).listOrders(
            status: state.status,
            q: q.isEmpty ? null : q,
          );
      state = state.copyWith(
        orders: orders,
        isLoading: false,
        isRefreshing: false,
        error: null,
        visibleCount: kOrdersPageSize,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        error: ApiError.from(e),
      );
    }
  }

  /// Pull-to-refresh — re-queries with the current filters.
  Future<void> refresh() => _load(refreshing: true);

  /// Re-run the load after an error.
  void retry() {
    _load();
  }

  /// Switch the status filter and re-query.
  void setStatus(String? status) {
    if (status == state.status) return;
    state = state.copyWith(status: status);
    _load();
  }

  /// Update the search term; the query is debounced before hitting the server.
  void search(String value) {
    state = state.copyWith(query: value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  /// Reveal the next page of already-loaded rows.
  void loadMore() {
    if (!state.hasMore) return;
    state = state.copyWith(
      visibleCount: math.min(state.visibleCount + kOrdersPageSize, state.orders.length),
    );
  }
}

final ordersListControllerProvider =
    NotifierProvider<OrdersListController, OrdersListState>(
  OrdersListController.new,
);
