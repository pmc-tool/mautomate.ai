import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "overview_tab.dart";
import "posts_tab.dart";
import "channels_tab.dart";
import "campaigns_tab.dart";

/// Marketing — the outbound marketing suite.
///
/// A tabbed surface that ports the core of the web marketing dashboard: an
/// Overview of the merchant's marketing counts, a Posts board (compose, schedule
/// and publish social content), a Channels view (connected account status +
/// connect guidance) and a Campaigns list. The inbound side (marketing
/// conversations) lives in the separate Inbox feature and is not duplicated here.
///
/// The class name and const constructor are stable so the router needs no
/// change.
class MarketingScreen extends StatelessWidget {
  const MarketingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return DefaultTabController(
      length: 4,
      child: AppScaffold(
        title: "Marketing",
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.border)),
            ),
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: c.textPrimary,
              unselectedLabelColor: c.textSecondary,
              indicatorColor: c.accent,
              indicatorSize: TabBarIndicatorSize.label,
              dividerColor: Colors.transparent,
              labelStyle: Theme.of(context).textTheme.labelLarge,
              tabs: const [
                Tab(text: "Overview"),
                Tab(text: "Posts"),
                Tab(text: "Channels"),
                Tab(text: "Campaigns"),
              ],
            ),
          ),
        ),
        body: const TabBarView(
          children: [
            MarketingOverviewTab(),
            MarketingPostsTab(),
            MarketingChannelsTab(),
            MarketingCampaignsTab(),
          ],
        ),
      ),
    );
  }
}

/// Wraps a non-scrolling widget (empty/error) so pull-to-refresh still works.
/// Shared by the marketing tabs.
class RefreshableMessage extends StatelessWidget {
  const RefreshableMessage({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: c.accent,
      backgroundColor: c.surface,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: child,
            ),
          );
        },
      ),
    );
  }
}

/// A compact stat tile used on the Overview tab.
class MarketingStatTile extends StatelessWidget {
  const MarketingStatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: c.surfaceMuted,
                  borderRadius: AppRadius.smAll,
                ),
                child: Icon(icon, size: 18, color: c.textSecondary),
              ),
              const Spacer(),
            ],
          ),
          const Gap(AppSpacing.md),
          Text(value, style: text.headlineSmall),
          const Gap(AppSpacing.xxs),
          Text(
            label,
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// The shared phosphor glyph for the marketing surface.
IconData get marketingIcon => PhosphorIconsRegular.megaphone;
