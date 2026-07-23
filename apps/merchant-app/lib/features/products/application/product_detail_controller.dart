import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/product_models.dart";
import "../data/products_repository.dart";
import "products_list_controller.dart";

/// Immutable state for the product detail + quick-edit screen.
class ProductDetailState {
  const ProductDetailState({
    this.product,
    this.loading = true,
    this.error,
    this.togglingStatus = false,
  });

  final ProductDetail? product;
  final bool loading;
  final ApiError? error;

  /// True while the publish/unpublish toggle is saving.
  final bool togglingStatus;

  bool get isPublished => product?.status == ProductStatus.published;

  ProductDetailState copyWith({
    Object? product = _keep,
    bool? loading,
    Object? error = _keep,
    bool? togglingStatus,
  }) {
    return ProductDetailState(
      product: product == _keep ? this.product : product as ProductDetail?,
      loading: loading ?? this.loading,
      error: error == _keep ? this.error : error as ApiError?,
      togglingStatus: togglingStatus ?? this.togglingStatus,
    );
  }

  static const Object _keep = Object();
}

/// Loads a single product and applies quick edits (publish toggle, variant
/// price, variant stock). Keyed by product id via [NotifierProvider.family].
class ProductDetailController
    extends FamilyNotifier<ProductDetailState, String> {
  ProductsRepository get _repo => ref.read(productsRepositoryProvider);

  @override
  ProductDetailState build(String arg) {
    Future.microtask(_load);
    return const ProductDetailState();
  }

  Future<void> _load() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final product = await _repo.detail(arg);
      state = state.copyWith(product: product, loading: false, error: null);
      // Keep the list row in sync after any (re)load — e.g. a restock refresh.
      _syncList(product);
    } on ApiError catch (e) {
      state = state.copyWith(loading: false, error: e);
    }
  }

  /// Retry / pull-to-refresh.
  Future<void> refresh() => _load();

  /// Flip the product between published and draft.
  Future<void> togglePublish() async {
    final current = state.product;
    if (current == null || state.togglingStatus) return;
    final next = current.status == ProductStatus.published
        ? ProductStatus.draft
        : ProductStatus.published;
    state = state.copyWith(togglingStatus: true);
    try {
      final updated = await _repo.updateStatus(arg, next);
      state = state.copyWith(product: updated, togglingStatus: false);
      _syncList(updated);
    } on ApiError {
      state = state.copyWith(togglingStatus: false);
      rethrow;
    }
  }

  /// Save a variant's price. Throws [ApiError] on failure for the caller to
  /// surface; on success the detail (and the list row) are refreshed.
  Future<void> savePrice(
    String variantId,
    num amount,
    String currencyCode,
  ) async {
    final updated = await _repo.updateVariantPrice(
      arg,
      variantId,
      amount,
      currencyCode,
    );
    state = state.copyWith(product: updated);
    _syncList(updated);
  }

  /// Save a variant's available stock. Throws [ApiError] on failure.
  Future<void> saveInventory(String variantId, int quantity) async {
    final updated = await _repo.updateVariantInventory(
      arg,
      variantId,
      quantity,
    );
    state = state.copyWith(product: updated);
    _syncList(updated);
  }

  /// Keep the product list row in sync after a quick edit, without a refetch.
  void _syncList(ProductDetail product) {
    ref.read(productsListControllerProvider.notifier).applyUpdated(product);
  }
}

final productDetailControllerProvider = NotifierProvider.family<
    ProductDetailController, ProductDetailState, String>(
  ProductDetailController.new,
);
