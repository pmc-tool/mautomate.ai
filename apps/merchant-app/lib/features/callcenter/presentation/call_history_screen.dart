import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/call_center_controllers.dart";
import "../data/call_center_models.dart";
import "call_detail_screen.dart";
import "call_format.dart";

/// The call log: every inbound and outbound call, status-filterable and
/// client-paged. Each row shows the counterpart number, direction, disposition,
/// sentiment, duration and time; tapping one opens the full [CallDetailScreen].
class CallHistoryScreen extends ConsumerStatefulWidget {
  const CallHistoryScreen({super.key});

  /// Convenience route so the overview can push without touching the router.
  static Route<void> route() {
    return MaterialPageRoute<void>(builder: (_) => const CallHistoryScreen());
  }

  @override
  ConsumerState<CallHistoryScreen> createState() => _CallHistoryScreenState();
}

class _CallHistoryScreenState extends ConsumerState<CallHistoryScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 400) {
      ref.read(callHistoryControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<CallHistoryState>(callHistoryControllerProvider, (prev, next) {
      final err = next.error;
      if (err != null && next.calls.isNotEmpty && prev?.error != err) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err.message)));
      }
    });

    final state = ref.watch(callHistoryControllerProvider);
    final controller = ref.read(callHistoryControllerProvider.notifier);

    return AppScaffold(
      title: "Call history",
      onRefresh: controller.refresh,
      body: Column(
        children: [
          const Gap(AppSpacing.sm),
          _StatusFilterBar(
            selected: state.status,
            onSelected: controller.setStatus,
          ),
          const Gap(AppSpacing.sm),
          Expanded(child: _content(context, state, controller)),
        ],
      ),
    );
  }

  Widget _content(
    BuildContext context,
    CallHistoryState state,
    CallHistoryController controller,
  ) {
    if (state.isLoading && state.calls.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.calls.isEmpty) {
      return _Scrollable(
        child: ErrorStateView(
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    if (state.isEmpty) {
      return _Scrollable(
        child: EmptyState(
          icon: PhosphorIcons.phoneCall(),
          title: state.hasFilters ? "No matching calls" : "No calls yet",
          message: state.hasFilters
              ? "No calls match this filter. Try clearing it."
              : "Calls appear here once an agent answers or a campaign starts "
                  "dialing.",
        ),
      );
    }

    final rows = state.visible;
    return ListView.separated(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      itemCount: rows.length + (state.hasMore ? 1 : 0),
      separatorBuilder: (context, _) => Divider(
        height: 1,
        thickness: 1,
        color: context.colors.border,
        indent: AppSpacing.lg,
        endIndent: AppSpacing.lg,
      ),
      itemBuilder: (context, index) {
        if (index >= rows.length) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Center(
              child: SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        return _CallRow(call: rows[index]);
      },
    );
  }
}

/// The horizontally-scrolling status filter pills.
class _StatusFilterBar extends StatelessWidget {
  const _StatusFilterBar({required this.selected, required this.onSelected});

  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: kCallStatusOptions.length,
        separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
        itemBuilder: (context, index) {
          final option = kCallStatusOptions[index];
          return _FilterPill(
            label: option.label,
            selected: option.value == selected,
            onTap: () => onSelected(option.value),
          );
        },
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          decoration: BoxDecoration(
            color: selected ? c.accentTint : c.surface,
            borderRadius:
                const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: selected ? c.accent : c.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? c.accent : c.textSecondary,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
          ),
        ),
      ),
    );
  }
}

/// A single call row in the log.
class _CallRow extends StatelessWidget {
  const _CallRow({required this.call});

  final CallCenterCall call;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final inbound = call.direction == "inbound";
    final counterpart = inbound
        ? (call.fromNumber ?? call.toNumber)
        : (call.toNumber ?? call.fromNumber);
    final duration = formatCallDuration(call.startedAt, call.endedAt);

    final subtitleParts = <String>[
      formatCallWhen(call.createdAt),
      if (duration != "—") duration,
      if (call.disposition != null && call.disposition!.isNotEmpty)
        humaniseToken(call.disposition!),
    ];

    return ListRowTile(
      leading: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: inbound ? c.infoBg : c.accentTint,
          borderRadius: AppRadius.smAll,
        ),
        child: Icon(
          inbound ? PhosphorIcons.arrowDownLeft() : PhosphorIcons.arrowUpRight(),
          size: 18,
          color: inbound ? c.info : c.accent,
        ),
      ),
      title: counterpart == null || counterpart.isEmpty
          ? "Unknown number"
          : counterpart,
      subtitle: subtitleParts.join("  ·  "),
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          StatusChip(status: call.status),
          if (call.sentiment != null && call.sentiment!.isNotEmpty) ...[
            const Gap(AppSpacing.xs),
            StatusChip.custom(
              label: humaniseToken(call.sentiment!),
              tone: sentimentTone(call.sentiment),
            ),
          ],
        ],
      ),
      onTap: () => Navigator.of(context).push(CallDetailScreen.route(call.id)),
    );
  }
}

/// Wraps a non-scrolling widget (empty/error) so pull-to-refresh still works.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}
