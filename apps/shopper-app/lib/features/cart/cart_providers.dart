import "package:flutter_riverpod/flutter_riverpod.dart";

import "cart_controller.dart";

export "cart_controller.dart" show cartControllerProvider, CartController;
export "cart_models.dart";

/// The number of line items currently in the cart, surfaced as a badge on the
/// Cart tab (bottom nav) and the store header cart icon.
///
/// WAVE 2b: derived from the live [cartControllerProvider] — the summed line
/// quantity, or 0 when there is no cart. Kept a plain int Provider with the SAME
/// name the header + nav read, so those badges stay live with no edits. During
/// an in-flight mutation it reflects the previous cart (copyWithPrevious keeps
/// the value), so the badge never flickers to 0.
final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartControllerProvider).valueOrNull;
  return cart?.itemCount ?? 0;
});
