import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/marketing_campaigns_controller.dart";
import "../data/marketing_models.dart";

/// The Campaigns tab: a read-only list of the tenant's marketing campaigns with
/// their objective, status and run window. Creating/editing campaigns is done
/// from the web dashboard (scoped out of the app for now).
class MarketingCampaignsTab extends ConsumerWidget {
  const MarketingCampaignsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(marketingCampaignsControllerProvider);
    final controller = ref.read(marketingCampaignsControllerProvider.notifier);

    if (state.isLoading && state.campaigns.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.campaigns.isEmpty) {
      return _refreshable(
        context,
        controller.refresh,
        ErrorStateView(message: state.error!.message, onRetry: controller.retry),
      );
    }

    if (state.isEmpty) {
      return _refreshable(
        context,
        controller.refresh,
        EmptyState(
          icon: PhosphorIcons.flag(),
          title: "No campaigns yet",
          message:
              "Campaigns group posts and channels around a goal. Create one from "
              "your dashboard on the web, then track it here.",
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: AppSpacing.xl),
        itemCount: state.campaigns.length,
        separatorBuilder: (context, _) => Divider(
          height: 1,
          thickness: 1,
          color: context.colors.border,
          indent: AppSpacing.lg,
          endIndent: AppSpacing.lg,
        ),
        itemBuilder: (context, index) =>
            _CampaignRow(campaign: state.campaigns[index]),
      ),
    );
  }

  Widget _refreshable(
    BuildContext context,
    Future<void> Function() onRefresh,
    Widget child,
  ) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _CampaignRow extends StatelessWidget {
  const _CampaignRow({required this.campaign});

  final MarketingCampaign campaign;

  @override
  Widget build(BuildContext context) {
    final window = _window(campaign);
    final subtitle = [
      if (campaign.objective != null && campaign.objective!.isNotEmpty)
        _humanise(campaign.objective!),
      if (window.isNotEmpty) window,
    ].join("  ·  ");

    return ListRowTile(
      icon: PhosphorIcons.flag(),
      title: campaign.name.isEmpty ? "Untitled campaign" : campaign.name,
      subtitle: subtitle.isEmpty ? "No objective set" : subtitle,
      showChevron: false,
      trailing: StatusChip(status: campaign.status),
    );
  }

  static String _window(MarketingCampaign c) {
    final start = _fmt(c.startsAt);
    final end = _fmt(c.endsAt);
    if (start.isEmpty && end.isEmpty) return "";
    if (start.isNotEmpty && end.isNotEmpty) return "$start – $end";
    if (start.isNotEmpty) return "From $start";
    return "Until $end";
  }

  static String _fmt(String? iso) {
    if (iso == null || iso.isEmpty) return "";
    final dt = DateTime.tryParse(iso);
    if (dt == null) return "";
    return DateFormat.MMMd().format(dt.toLocal());
  }

  static String _humanise(String value) {
    final cleaned = value.replaceAll("_", " ").trim();
    if (cleaned.isEmpty) return "";
    return cleaned[0].toUpperCase() + cleaned.substring(1);
  }
}
