import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/marketing_overview_controller.dart";
import "../data/marketing_models.dart";
import "marketing_screen.dart";

/// The Overview tab: the marketing summary counts and a per-status breakdown of
/// posts. Mirrors the web marketing hub's KPI cards.
class MarketingOverviewTab extends ConsumerWidget {
  const MarketingOverviewTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(marketingOverviewControllerProvider);
    final controller = ref.read(marketingOverviewControllerProvider.notifier);

    if (state.isLoading && state.summary == null) {
      return const SkeletonList(itemCount: 5);
    }

    if (state.error != null && state.summary == null) {
      return RefreshableMessage(
        onRefresh: controller.refresh,
        child: ErrorStateView(
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    final summary = state.summary ?? const MarketingSummary();
    final byStatus = summary.posts?.byStatus ?? const <String, int>{};

    return RefreshIndicator(
      onRefresh: controller.refresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: AppSpacing.screen,
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacing.md,
            crossAxisSpacing: AppSpacing.md,
            childAspectRatio: 1.5,
            children: [
              MarketingStatTile(
                label: "Total posts",
                value: "${summary.posts?.total ?? 0}",
                icon: PhosphorIcons.article(),
              ),
              MarketingStatTile(
                label: "Scheduled (next 7 days)",
                value: "${summary.scheduledNext7d}",
                icon: PhosphorIcons.calendarCheck(),
              ),
              MarketingStatTile(
                label: "Connected accounts",
                value: "${summary.connectedAccountsCount}",
                icon: PhosphorIcons.plugsConnected(),
              ),
              MarketingStatTile(
                label: "Brand voices",
                value: "${summary.brandVoiceCount}",
                icon: PhosphorIcons.chatCircleText(),
              ),
            ],
          ),
          const Gap(AppSpacing.xl),
          if (byStatus.isNotEmpty) ...[
            const SectionHeader(title: "Posts by status"),
            const Gap(AppSpacing.md),
            AppCard(
              child: Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final entry in byStatus.entries)
                    StatusChip.custom(
                      label: "${_humanise(entry.key)} · ${entry.value}",
                      tone: StatusChip.toneForStatus(entry.key),
                    ),
                ],
              ),
            ),
          ] else
            EmptyState(
              icon: PhosphorIcons.megaphone(),
              title: "Nothing published yet",
              message:
                  "Compose your first post from the Posts tab to start planning "
                  "your social content.",
              compact: true,
            ),
        ],
      ),
    );
  }

  static String _humanise(String status) {
    final cleaned = status.replaceAll("_", " ").trim();
    if (cleaned.isEmpty) return "—";
    return cleaned[0].toUpperCase() + cleaned.substring(1);
  }
}
