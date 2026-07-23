import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/order_models.dart";
import "../data/orders_repository.dart";

/// Loads a single order and runs its actions (fulfil, ship, deliver, capture,
/// mark-paid, cancel). Each action calls the repository — which throws a typed
/// [ApiError] on failure so the screen can surface it — then silently re-fetches
/// the order so the UI reflects the new state. A re-fetch failure keeps the
/// prior data rather than masking a successful action with an error screen.
class OrderDetailController
    extends AutoDisposeFamilyAsyncNotifier<OrderDetail, String> {
  OrdersRepository get _repo => ref.read(ordersRepositoryProvider);

  @override
  Future<OrderDetail> build(String arg) => _repo.getOrder(arg);

  Future<void> _reload() async {
    try {
      final order = await _repo.getOrder(arg);
      state = AsyncData(order);
    } catch (_) {
      // Keep the current (pre-action) data; the action itself succeeded.
    }
  }

  /// Fulfil every outstanding line.
  Future<void> fulfill() async {
    await _repo.fulfillOrder(arg);
    await _reload();
  }

  /// Mark a fulfilment shipped.
  Future<void> markShipped(String fulfillmentId) async {
    await _repo.createShipment(arg, fulfillmentId: fulfillmentId);
    await _reload();
  }

  /// Mark a fulfilment delivered.
  Future<void> markDelivered(String fulfillmentId) async {
    await _repo.markDelivered(arg, fulfillmentId: fulfillmentId);
    await _reload();
  }

  /// Capture the full authorized payment.
  Future<void> capturePayment() async {
    await _repo.capturePayment(arg);
    await _reload();
  }

  /// Mark the order paid without capturing a provider payment.
  Future<void> markPaid() async {
    await _repo.markOrderPaid(arg);
    await _reload();
  }

  /// Cancel the order.
  Future<void> cancel() async {
    await _repo.cancelOrder(arg);
    await _reload();
  }
}

final orderDetailControllerProvider = AsyncNotifierProvider.autoDispose
    .family<OrderDetailController, OrderDetail, String>(
  OrderDetailController.new,
);
