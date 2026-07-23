import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/order_detail_controller.dart";
import "../data/order_models.dart";

/// Full order detail: header + status, fulfilment (with fulfil / ship / deliver
/// actions), payment (capture / mark paid), line items with totals, customer
/// and shipping address. Every irreversible action is confirmed in a dialog
/// before it fires; the server enforces the real gate.
class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({
    super.key,
    required this.orderId,
    required this.displayId,
  });

  final String orderId;
  final int displayId;

  /// Convenience route so the list can `Navigator.push` without touching the
  /// app router.
  static Route<void> route(String orderId, int displayId) {
    return MaterialPageRoute<void>(
      builder: (_) =>
          OrderDetailScreen(orderId: orderId, displayId: displayId),
    );
  }

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  /// The tag of the action currently in flight (null = idle). Drives per-button
  /// spinners and disables the others while one runs.
  String? _busy;

  OrderDetailController get _controller =>
      ref.read(orderDetailControllerProvider(widget.orderId).notifier);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(orderDetailControllerProvider(widget.orderId));

    return AppScaffold(
      title: "#${widget.displayId}",
      actions: [
        async.maybeWhen(
          data: (order) => _overflowMenu(order),
          orElse: () => const SizedBox.shrink(),
        ),
      ],
      onRefresh: () => ref.refresh(
        orderDetailControllerProvider(widget.orderId).future,
      ),
      body: async.when(
        loading: () => const SkeletonList(itemCount: 5),
        error: (err, _) => _Scrollable(
          child: ErrorStateView(
            message: err is ApiError ? err.message : "Couldn't load this order.",
            onRetry: () =>
                ref.invalidate(orderDetailControllerProvider(widget.orderId)),
          ),
        ),
        data: (order) => _body(order),
      ),
    );
  }

  Widget _overflowMenu(OrderDetail order) {
    final canceled = _isCanceled(order);
    if (canceled || order.status == "completed") {
      return const SizedBox.shrink();
    }
    return PopupMenuButton<String>(
      icon: Icon(PhosphorIcons.dotsThreeVertical()),
      onSelected: (value) {
        if (value == "cancel") _onCancel(order);
      },
      itemBuilder: (context) => [
        PopupMenuItem<String>(
          value: "cancel",
          child: Row(
            children: [
              Icon(PhosphorIcons.prohibit(),
                  size: 18, color: context.colors.danger),
              const Gap(AppSpacing.sm),
              Text(
                "Cancel order",
                style: TextStyle(color: context.colors.danger),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _body(OrderDetail order) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        _headerCard(order),
        const Gap(AppSpacing.lg),
        _fulfillmentCard(order),
        const Gap(AppSpacing.lg),
        _paymentCard(order),
        const Gap(AppSpacing.lg),
        _itemsCard(order),
        if (order.customer != null || (order.email?.isNotEmpty ?? false)) ...[
          const Gap(AppSpacing.lg),
          _customerCard(order),
        ],
        if (order.shippingAddress != null) ...[
          const Gap(AppSpacing.lg),
          _addressCard(order.shippingAddress!),
        ],
        const Gap(AppSpacing.xl),
      ],
    );
  }

  // --- Header ------------------------------------------------------------

  Widget _headerCard(OrderDetail order) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Order #${order.displayId}",
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Gap(AppSpacing.xs),
          Text(
            _formatDateTime(order.createdAt),
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: context.colors.textSecondary),
          ),
          const Gap(AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (_isCanceled(order)) const StatusChip(status: "canceled"),
              StatusChip(status: order.paymentStatus),
              StatusChip(status: order.fulfillmentStatus),
            ],
          ),
        ],
      ),
    );
  }

  // --- Fulfilment --------------------------------------------------------

  Widget _fulfillmentCard(OrderDetail order) {
    final canceled = _isCanceled(order);
    final needsFulfil = !canceled &&
        order.items.isNotEmpty &&
        const {"not_fulfilled", "unfulfilled", "partially_fulfilled"}
            .contains(order.fulfillmentStatus);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionHeader(
            icon: PhosphorIcons.package(),
            title: "Fulfilment",
            subtitle: _humanStatus(order.fulfillmentStatus),
          ),
          if (order.fulfillments.isNotEmpty) ...[
            const Gap(AppSpacing.md),
            for (final f in order.fulfillments) _fulfillmentRow(order, f),
          ],
          if (needsFulfil) ...[
            const Gap(AppSpacing.lg),
            PrimaryButton(
              label: "Fulfil order",
              icon: PhosphorIcons.package(),
              isLoading: _busy == "fulfil",
              fullWidth: true,
              onPressed: _busy != null
                  ? null
                  : () => _onFulfill(order),
            ),
          ],
        ],
      ),
    );
  }

  Widget _fulfillmentRow(OrderDetail order, OrderFulfillment f) {
    final canceled = f.canceledAt != null;
    final shipped = f.shippedAt != null;
    final delivered = f.deliveredAt != null;
    final status = canceled
        ? "canceled"
        : delivered
            ? "delivered"
            : shipped
                ? "shipped"
                : "fulfilled";
    final tracking = f.labels
        .map((l) => l.trackingNumber)
        .whereType<String>()
        .where((t) => t.isNotEmpty)
        .join(", ");
    final itemCount = f.items.fold<num>(0, (s, i) => s + i.quantity);

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: context.colors.surfaceInset,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: context.colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    "$itemCount ${itemCount == 1 ? "item" : "items"}",
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                StatusChip(status: status),
              ],
            ),
            if (tracking.isNotEmpty) ...[
              const Gap(AppSpacing.xs),
              Text(
                "Tracking: $tracking",
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: context.colors.textSecondary),
              ),
            ],
            if (!canceled && (!shipped || !delivered)) ...[
              const Gap(AppSpacing.md),
              Row(
                children: [
                  if (!shipped)
                    SecondaryButton(
                      label: "Mark shipped",
                      icon: PhosphorIcons.truck(),
                      size: AppButtonSize.small,
                      isLoading: _busy == "ship_${f.id}",
                      onPressed: _busy != null
                          ? null
                          : () => _onShip(order, f),
                    ),
                  if (shipped && !delivered)
                    SecondaryButton(
                      label: "Mark delivered",
                      icon: PhosphorIcons.checkCircle(),
                      size: AppButtonSize.small,
                      isLoading: _busy == "deliver_${f.id}",
                      onPressed: _busy != null
                          ? null
                          : () => _onDeliver(order, f),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // --- Payment -----------------------------------------------------------

  Widget _paymentCard(OrderDetail order) {
    final capturable = !_isCanceled(order) &&
        order.payments.any(
          (p) => p.canceledAt == null && (p.amount - p.capturedAmount) > 0,
        );
    final canMarkPaid =
        !_isCanceled(order) && !capturable && order.outstanding > 0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionHeader(
            icon: PhosphorIcons.creditCard(),
            title: "Payment",
            subtitle: _humanStatus(order.paymentStatus),
          ),
          const Gap(AppSpacing.md),
          _amountRow(context, "Paid", order.paidTotal, order.currencyCode),
          if (order.refundedTotal > 0)
            _amountRow(context, "Refunded", order.refundedTotal,
                order.currencyCode),
          if (order.outstanding > 0)
            _amountRow(context, "Outstanding", order.outstanding,
                order.currencyCode,
                emphasise: true),
          if (capturable) ...[
            const Gap(AppSpacing.lg),
            PrimaryButton(
              label: "Capture payment",
              icon: PhosphorIcons.currencyDollar(),
              isLoading: _busy == "capture",
              fullWidth: true,
              onPressed: _busy != null ? null : () => _onCapture(order),
            ),
          ] else if (canMarkPaid) ...[
            const Gap(AppSpacing.lg),
            SecondaryButton(
              label: "Mark as paid",
              icon: PhosphorIcons.checkCircle(),
              isLoading: _busy == "markPaid",
              fullWidth: true,
              onPressed: _busy != null ? null : () => _onMarkPaid(order),
            ),
          ],
        ],
      ),
    );
  }

  // --- Items -------------------------------------------------------------

  Widget _itemsCard(OrderDetail order) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: SectionHeader(
              icon: PhosphorIcons.shoppingBag(),
              title: "Items",
              subtitle:
                  "${order.items.length} ${order.items.length == 1 ? "line" : "lines"}",
            ),
          ),
          for (final item in order.items)
            _itemRow(order.currencyCode, item),
          Divider(height: 1, thickness: 1, color: context.colors.border),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: _totals(order),
          ),
        ],
      ),
    );
  }

  Widget _itemRow(String currency, OrderItem item) {
    final c = context.colors;
    final subtitleParts = <String>[
      if ((item.variantTitle?.isNotEmpty ?? false)) item.variantTitle!,
      if ((item.sku?.isNotEmpty ?? false)) "SKU ${item.sku}",
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        0,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _thumb(item.thumbnail),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitleParts.isNotEmpty) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    subtitleParts.join("  ·  "),
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: c.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const Gap(AppSpacing.xs),
                Row(
                  children: [
                    MoneyText(
                      amount: item.unitPrice,
                      currencyCode: currency,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: c.textSecondary),
                    ),
                    Text(
                      "  ×  ${item.quantity}",
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: c.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Gap(AppSpacing.md),
          MoneyText(
            amount: item.total,
            currencyCode: currency,
            strong: true,
          ),
        ],
      ),
    );
  }

  Widget _thumb(String? url) {
    final c = context.colors;
    return Container(
      height: 48,
      width: 48,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.surfaceMuted,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: c.border),
      ),
      child: (url != null && url.isNotEmpty)
          ? Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Icon(
                PhosphorIcons.image(),
                size: 20,
                color: c.textMuted,
              ),
            )
          : Icon(PhosphorIcons.package(), size: 20, color: c.textMuted),
    );
  }

  Widget _totals(OrderDetail order) {
    final cur = order.currencyCode;
    return Column(
      children: [
        _amountRow(context, "Subtotal", order.itemSubtotal, cur),
        _amountRow(context, "Shipping", order.shippingTotal, cur),
        if (order.discountTotal > 0)
          _amountRow(context, "Discount", -order.discountTotal, cur),
        _amountRow(context, "Tax", order.taxTotal, cur),
        const Gap(AppSpacing.xs),
        Divider(height: 1, thickness: 1, color: context.colors.border),
        const Gap(AppSpacing.sm),
        _amountRow(context, "Total", order.total, cur, emphasise: true),
      ],
    );
  }

  // --- Customer / address ------------------------------------------------

  Widget _customerCard(OrderDetail order) {
    final customer = order.customer;
    final name = [
      customer?.firstName,
      customer?.lastName,
    ].whereType<String>().where((s) => s.isNotEmpty).join(" ");
    final email = order.email ?? customer?.email ?? "";
    final phone = customer?.phone ?? order.shippingAddress?.phone;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            icon: PhosphorIcons.user(),
            title: "Customer",
          ),
          const Gap(AppSpacing.md),
          Text(
            name.isEmpty ? "Guest" : name,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (email.isNotEmpty) ...[
            const Gap(AppSpacing.xs),
            _iconLine(PhosphorIcons.envelopeSimple(), email),
          ],
          if (phone != null && phone.isNotEmpty) ...[
            const Gap(AppSpacing.xs),
            _iconLine(PhosphorIcons.phone(), phone),
          ],
          if (customer?.orderCount != null) ...[
            const Gap(AppSpacing.xs),
            _iconLine(
              PhosphorIcons.receipt(),
              "${customer!.orderCount} previous ${customer.orderCount == 1 ? "order" : "orders"}",
            ),
          ],
        ],
      ),
    );
  }

  Widget _addressCard(OrderAddress a) {
    final lines = <String>[
      [a.firstName, a.lastName]
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .join(" "),
      a.address1 ?? "",
      a.address2 ?? "",
      [a.city, a.province, a.postalCode]
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .join(", "),
      (a.countryCode ?? "").toUpperCase(),
    ].where((s) => s.isNotEmpty).toList();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            icon: PhosphorIcons.mapPin(),
            title: "Shipping address",
          ),
          const Gap(AppSpacing.md),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
              child: Text(
                line,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
        ],
      ),
    );
  }

  Widget _iconLine(IconData icon, String text) {
    final c = context.colors;
    return Row(
      children: [
        Icon(icon, size: 16, color: c.textMuted),
        const Gap(AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: c.textSecondary),
          ),
        ),
      ],
    );
  }

  Widget _amountRow(
    BuildContext context,
    String label,
    num amount,
    String currency, {
    bool emphasise = false,
  }) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: (emphasise ? text.titleSmall : text.bodyMedium)
                ?.copyWith(color: emphasise ? c.textPrimary : c.textSecondary),
          ),
          MoneyText(
            amount: amount,
            currencyCode: currency,
            strong: emphasise,
            style: emphasise ? text.titleSmall : text.bodyMedium,
          ),
        ],
      ),
    );
  }

  // --- Actions -----------------------------------------------------------

  Future<void> _onFulfill(OrderDetail order) async {
    final ok = await _confirm(
      title: "Fulfil order?",
      message:
          "This creates a fulfilment for all outstanding items on order #${order.displayId}.",
      confirmLabel: "Fulfil",
    );
    if (!ok) return;
    await _run("fulfil", _controller.fulfill, success: "Order fulfilled");
  }

  Future<void> _onShip(OrderDetail order, OrderFulfillment f) async {
    final ok = await _confirm(
      title: "Mark as shipped?",
      message: "This marks the fulfilment as shipped and notifies the customer.",
      confirmLabel: "Mark shipped",
    );
    if (!ok) return;
    await _run(
      "ship_${f.id}",
      () => _controller.markShipped(f.id),
      success: "Marked as shipped",
    );
  }

  Future<void> _onDeliver(OrderDetail order, OrderFulfillment f) async {
    final ok = await _confirm(
      title: "Mark as delivered?",
      message: "This marks the fulfilment as delivered.",
      confirmLabel: "Mark delivered",
    );
    if (!ok) return;
    await _run(
      "deliver_${f.id}",
      () => _controller.markDelivered(f.id),
      success: "Marked as delivered",
    );
  }

  Future<void> _onCapture(OrderDetail order) async {
    final ok = await _confirm(
      title: "Capture payment?",
      message:
          "This captures the authorized payment for order #${order.displayId}. This can't be undone.",
      confirmLabel: "Capture",
    );
    if (!ok) return;
    await _run("capture", _controller.capturePayment,
        success: "Payment captured");
  }

  Future<void> _onMarkPaid(OrderDetail order) async {
    final ok = await _confirm(
      title: "Mark as paid?",
      message:
          "This records order #${order.displayId} as paid without capturing a provider payment.",
      confirmLabel: "Mark paid",
    );
    if (!ok) return;
    await _run("markPaid", _controller.markPaid, success: "Marked as paid");
  }

  Future<void> _onCancel(OrderDetail order) async {
    final ok = await _confirm(
      title: "Cancel order?",
      message:
          "This cancels order #${order.displayId}. This can't be undone.",
      confirmLabel: "Cancel order",
      destructive: true,
    );
    if (!ok) return;
    await _run("cancel", _controller.cancel, success: "Order canceled");
  }

  /// Runs [action] with a per-button spinner and a success/error snackbar.
  Future<void> _run(
    String tag,
    Future<void> Function() action, {
    required String success,
  }) async {
    setState(() => _busy = tag);
    try {
      await action();
      if (mounted) _toast(success);
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
    bool destructive = false,
  }) async {
    final c = context.colors;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: Text(title),
        content: Text(message),
        actions: [
          GhostButton(
            label: "Back",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          if (destructive)
            GhostButton(
              label: confirmLabel,
              destructive: true,
              size: AppButtonSize.small,
              onPressed: () => Navigator.of(dialogContext).pop(true),
            )
          else
            PrimaryButton(
              label: confirmLabel,
              size: AppButtonSize.small,
              onPressed: () => Navigator.of(dialogContext).pop(true),
            ),
        ],
      ),
    );
    return result ?? false;
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: error ? AppColors.dangerSolid : null,
        ),
      );
  }
}

bool _isCanceled(OrderDetail order) =>
    order.canceledAt != null || order.status == "canceled";

String _humanStatus(String status) {
  final cleaned = status.replaceAll("_", " ").trim();
  if (cleaned.isEmpty) return "";
  return cleaned[0].toUpperCase() + cleaned.substring(1);
}

String _formatDateTime(String iso) {
  if (iso.isEmpty) return "";
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.yMMMMd().add_jm().format(dt.toLocal());
}

/// Wraps a non-scrolling widget so pull-to-refresh still works on empty/error.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: child,
        ),
      ),
    );
  }
}
