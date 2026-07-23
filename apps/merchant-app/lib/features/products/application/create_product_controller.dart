import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/product_models.dart";
import "../data/products_repository.dart";

/// Loads the store's priceable currencies for the create-product pricing
/// section. Auto-disposed with the create screen so it re-fetches next time.
///
/// The screen degrades gracefully if this fails (falls back to a single "usd"
/// currency), so the create flow is never blocked by a currencies hiccup.
final storeCurrenciesProvider =
    FutureProvider.autoDispose<StoreCurrencies>((ref) {
  return ref.read(productsRepositoryProvider).storeCurrencies();
});
