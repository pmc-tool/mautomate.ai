import "package:flutter/foundation.dart";
import "package:flutter/widgets.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/api/products_repository.dart";
import "../../core/api/store_product.dart";
import "../../core/api/tenant_config.dart";

/// The sort orders offered by the catalog sort control.
///
/// Each maps to a Medusa `order` query value ([order]). Price sorts order by the
/// variant's calculated price; "newest" is created-at descending.
enum CatalogSort {
  newest,
  priceLowHigh,
  priceHighLow;

  /// The Medusa `order` query value.
  String get order => switch (this) {
        CatalogSort.newest => "-created_at",
        CatalogSort.priceLowHigh => "variants.calculated_price",
        CatalogSort.priceHighLow => "-variants.calculated_price",
      };

  /// Human label for the sort menu.
  String get label => switch (this) {
        CatalogSort.newest => "Newest",
        CatalogSort.priceLowHigh => "Price: Low to High",
        CatalogSort.priceHighLow => "Price: High to Low",
      };

  IconData get icon => switch (this) {
        CatalogSort.newest => PhosphorIcons.sparkle(),
        CatalogSort.priceLowHigh => PhosphorIcons.sortAscending(),
        CatalogSort.priceHighLow => PhosphorIcons.sortDescending(),
      };
}

/// A value-typed description of WHAT to fetch for a catalog listing.
///
/// It is the key for [catalogListControllerProvider] (a `family`), so two
/// identical queries share one paginated controller + cache, and changing the
/// sort or category yields a fresh controller that loads from page 0.
@immutable
class CatalogQuery {
  const CatalogQuery({
    this.search,
    this.categoryId,
    this.sort = CatalogSort.newest,
  });

  /// Free-text search (`q`). Null/empty means "no search filter".
  final String? search;

  /// Scope to a single category (`category_id[]`). Null means the whole catalog.
  final String? categoryId;

  /// The sort order.
  final CatalogSort sort;

  CatalogQuery copyWith({
    Object? search = _sentinel,
    Object? categoryId = _sentinel,
    CatalogSort? sort,
  }) {
    return CatalogQuery(
      search: search == _sentinel ? this.search : search as String?,
      categoryId:
          categoryId == _sentinel ? this.categoryId : categoryId as String?,
      sort: sort ?? this.sort,
    );
  }

  static const Object _sentinel = Object();

  @override
  bool operator ==(Object other) =>
      other is CatalogQuery &&
      other.search == search &&
      other.categoryId == categoryId &&
      other.sort == sort;

  @override
  int get hashCode => Object.hash(search, categoryId, sort);
}

/// The paginated state of one catalog listing.
@immutable
class CatalogListState {
  const CatalogListState({
    this.items = const [],
    this.isLoadingInitial = true,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.error,
  });

  /// The products loaded so far (accumulated across pages).
  final List<StoreProduct> items;

  /// True during the first page load (show a skeleton grid).
  final bool isLoadingInitial;

  /// True while appending the next page (show a footer spinner).
  final bool isLoadingMore;

  /// Whether another page is likely available.
  final bool hasMore;

  /// The last error, if a load failed. Paired with an empty [items] it drives
  /// the full-screen error state; with items present it is surfaced softly.
  final Object? error;

  bool get isEmpty => items.isEmpty && !isLoadingInitial && error == null;

  CatalogListState copyWith({
    List<StoreProduct>? items,
    bool? isLoadingInitial,
    bool? isLoadingMore,
    bool? hasMore,
    Object? error = _sentinel,
  }) {
    return CatalogListState(
      items: items ?? this.items,
      isLoadingInitial: isLoadingInitial ?? this.isLoadingInitial,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      error: error == _sentinel ? this.error : error,
    );
  }

  static const Object _sentinel = Object();
}

/// Drives one paginated catalog listing for a [CatalogQuery].
///
/// Loads the first page eagerly on creation; [loadMore] appends the next page
/// (offset-based, [pageSize] at a time), [refresh] reloads from page 0. The
/// store's `region_id` (for prices) is resolved once from [tenantConfigProvider].
class CatalogListController extends StateNotifier<CatalogListState> {
  CatalogListController(this._ref, this.query)
      : super(const CatalogListState()) {
    loadInitial();
  }

  final Ref _ref;
  final CatalogQuery query;

  static const int pageSize = 12;

  ProductsRepository get _repo => _ref.read(productsRepositoryProvider);

  Future<String?> _regionId() async {
    final config = await _ref.read(tenantConfigProvider.future);
    return config.regionId;
  }

  Future<List<StoreProduct>> _fetch(int offset, String? regionId) {
    return _repo.list(
      limit: pageSize,
      offset: offset,
      query: query.search,
      order: query.sort.order,
      regionId: regionId,
      categoryIds: query.categoryId == null ? null : [query.categoryId!],
    );
  }

  /// Load the first page (also used by pull-to-refresh).
  Future<void> loadInitial() async {
    state = const CatalogListState(isLoadingInitial: true);
    try {
      final regionId = await _regionId();
      final page = await _fetch(0, regionId);
      if (!mounted) return;
      state = CatalogListState(
        items: page,
        isLoadingInitial: false,
        hasMore: page.length == pageSize,
      );
    } catch (e) {
      if (!mounted) return;
      state = CatalogListState(isLoadingInitial: false, error: e);
    }
  }

  /// Append the next page, if any.
  Future<void> loadMore() async {
    if (state.isLoadingInitial || state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final regionId = await _regionId();
      final page = await _fetch(state.items.length, regionId);
      if (!mounted) return;
      state = state.copyWith(
        items: [...state.items, ...page],
        isLoadingMore: false,
        hasMore: page.length == pageSize,
      );
    } catch (e) {
      if (!mounted) return;
      // Keep what we have; stop the spinner. A failed page-append shouldn't
      // wipe the list — the footer just stops and the user can scroll to retry.
      state = state.copyWith(isLoadingMore: false);
      if (kDebugMode) debugPrint("[catalog] loadMore failed: $e");
    }
  }

  Future<void> refresh() => loadInitial();
}

/// A paginated catalog listing for a [CatalogQuery]. Auto-disposed so listings
/// scoped to a pushed screen (category) free their state on pop; the Shop tab
/// stays subscribed while its tab is alive.
final catalogListControllerProvider = StateNotifierProvider.autoDispose
    .family<CatalogListController, CatalogListState, CatalogQuery>(
  (ref, query) => CatalogListController(ref, query),
);
