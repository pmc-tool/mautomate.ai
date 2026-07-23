import "dart:async";

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/product_models.dart";
import "../data/products_repository.dart";

/// The number of products fetched per page.
const int kProductsPageSize = 20;

/// Immutable state for the product list screen.
///
/// [loading] is the first-page / full-refresh load (drives the skeleton);
/// [loadingMore] drives the footer spinner while paging; [error] is only set
/// when the FIRST page fails (so the whole screen shows the retry state — a
/// failed *paging* request keeps the rows already on screen).
class ProductsListState {
  const ProductsListState({
    this.items = const [],
    this.count = 0,
    this.query = "",
    this.loading = true,
    this.loadingMore = false,
    this.refreshing = false,
    this.error,
    this.pageError,
  });

  final List<ProductListItem> items;
  final int count;
  final String query;
  final bool loading;
  final bool loadingMore;
  final bool refreshing;

  /// First-page load failure (full-screen error state).
  final ApiError? error;

  /// A failed *load-more* (surfaced as a small footer message + retry).
  final ApiError? pageError;

  bool get hasMore => items.length < count;
  bool get isEmpty => !loading && error == null && items.isEmpty;

  ProductsListState copyWith({
    List<ProductListItem>? items,
    int? count,
    String? query,
    bool? loading,
    bool? loadingMore,
    bool? refreshing,
    Object? error = _keep,
    Object? pageError = _keep,
  }) {
    return ProductsListState(
      items: items ?? this.items,
      count: count ?? this.count,
      query: query ?? this.query,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      refreshing: refreshing ?? this.refreshing,
      error: error == _keep ? this.error : error as ApiError?,
      pageError: pageError == _keep ? this.pageError : pageError as ApiError?,
    );
  }

  static const Object _keep = Object();
}

/// Loads and paginates the tenant's products, with debounced search.
class ProductsListController extends Notifier<ProductsListState> {
  Timer? _debounce;

  ProductsRepository get _repo => ref.read(productsRepositoryProvider);

  @override
  ProductsListState build() {
    ref.onDispose(() => _debounce?.cancel());
    // Kick off the first load after construction so provider reads are safe.
    Future.microtask(() => _loadFirstPage());
    return const ProductsListState();
  }

  /// Debounced search entry point — call on every keystroke.
  void search(String query) {
    _debounce?.cancel();
    // Reflect the typed text immediately; fetch after the user pauses.
    state = state.copyWith(query: query);
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _loadFirstPage();
    });
  }

  /// Clears the search and reloads.
  void clearSearch() {
    _debounce?.cancel();
    state = state.copyWith(query: "");
    _loadFirstPage();
  }

  /// Pull-to-refresh: reload the first page, keeping the current query.
  Future<void> refresh() async {
    _debounce?.cancel();
    await _loadFirstPage(refresh: true);
  }

  /// Retry after a first-page failure.
  Future<void> retry() => _loadFirstPage();

  Future<void> _loadFirstPage({bool refresh = false}) async {
    final query = state.query;
    state = state.copyWith(
      loading: !refresh,
      refreshing: refresh,
      error: refresh ? state.error : null,
      pageError: null,
    );
    try {
      final page = await _repo.list(
        q: query,
        offset: 0,
        limit: kProductsPageSize,
        order: "-created_at",
      );
      // Ignore a stale response if the query changed while in flight.
      if (state.query != query) return;
      state = state.copyWith(
        items: page.products,
        count: page.count,
        loading: false,
        refreshing: false,
        error: null,
      );
    } on ApiError catch (e) {
      if (state.query != query) return;
      state = state.copyWith(
        loading: false,
        refreshing: false,
        // On refresh keep the rows; only a fresh load shows the error screen.
        error: refresh ? null : e,
        pageError: refresh ? e : null,
      );
    }
  }

  /// Fetch the next page (infinite scroll). No-op while already paging, at the
  /// end, or during the initial load.
  Future<void> loadMore() async {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    final query = state.query;
    state = state.copyWith(loadingMore: true, pageError: null);
    try {
      final page = await _repo.list(
        q: query,
        offset: state.items.length,
        limit: kProductsPageSize,
        order: "-created_at",
      );
      if (state.query != query) return;
      state = state.copyWith(
        items: [...state.items, ...page.products],
        count: page.count,
        loadingMore: false,
      );
    } on ApiError catch (e) {
      if (state.query != query) return;
      state = state.copyWith(loadingMore: false, pageError: e);
    }
  }

  /// Merge a locally-updated product (e.g. after a detail-screen quick edit)
  /// into the list without a full round-trip.
  void applyUpdated(ProductDetail product) {
    final idx = state.items.indexWhere((p) => p.id == product.id);
    if (idx < 0) return;
    final existing = state.items[idx];
    final firstPrice =
        product.variants.isNotEmpty && product.variants.first.prices.isNotEmpty
            ? product.variants.first.prices.first
            : null;
    final firstVariant =
        product.variants.isNotEmpty ? product.variants.first : null;
    final merged = existing.copyWith(
      status: product.status,
      title: product.title,
      thumbnail: product.thumbnail,
      price: firstPrice?.amount ?? existing.price,
      currencyCode: firstPrice?.currencyCode ?? existing.currencyCode,
      stock: firstVariant?.inventoryQuantity ?? existing.stock,
    );
    final next = [...state.items];
    next[idx] = merged;
    state = state.copyWith(items: next);
  }
}

final productsListControllerProvider =
    NotifierProvider<ProductsListController, ProductsListState>(
  ProductsListController.new,
);
