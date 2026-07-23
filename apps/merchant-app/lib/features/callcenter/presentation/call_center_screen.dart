import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/call_center_controllers.dart";
import "../data/call_center_models.dart";
import "call_analytics_screen.dart";
import "call_history_screen.dart";
import "widgets/call_stat_tile.dart";

/// Call Center overview — the AI voice agent surface.
///
/// Shows today's call tallies, the store's voice agents and their status, the
/// connected phone number(s), and links into the full call log and analytics.
/// Read-focused (P2): buying numbers and editing agents live on the web
/// dashboard. The class name and const constructor are stable so the router
/// needs no change.
class CallCenterScreen extends ConsumerWidget {
  const CallCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Surface a transient refresh error (data already on screen) as a snackbar.
    ref.listen<CallCenterOverviewState>(callCenterOverviewControllerProvider,
        (prev, next) {
      final err = next.error;
      if (err != null && next.dashboard != null && prev?.error != err) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err.message)));
      }
    });

    final state = ref.watch(callCenterOverviewControllerProvider);
    final controller =
        ref.read(callCenterOverviewControllerProvider.notifier);

    return AppScaffold(
      title: "Call Center",
      onRefresh: controller.refresh,
      body: _content(context, state, controller),
    );
  }

  Widget _content(
    BuildContext context,
    CallCenterOverviewState state,
    CallCenterOverviewController controller,
  ) {
    if (state.isLoading && state.dashboard == null) {
      return const SkeletonList(itemCount: 6);
    }

    if (state.error != null && state.dashboard == null) {
      return _Scrollable(
        child: ErrorStateView(
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    if (state.isNotSetUp) {
      return _Scrollable(
        child: EmptyState(
          icon: PhosphorIcons.headset(),
          title: "Set up your AI call center",
          message:
              "Create a voice agent and connect a phone number on the web "
              "dashboard, or ask Jarvis to set it up. Your agent then answers "
              "every call and logs it here.",
        ),
      );
    }

    final dashboard = state.dashboard ?? const CallCenterDashboard();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        _statGrid(dashboard),
        const Gap(AppSpacing.lg),
        _statusTodayCard(context, dashboard),
        const Gap(AppSpacing.lg),
        _agentsCard(context, state),
        const Gap(AppSpacing.lg),
        _numbersCard(context, state),
        const Gap(AppSpacing.lg),
        _navCard(context),
      ],
    );
  }

  Widget _statGrid(CallCenterDashboard d) {
    final connected = (d.callsToday.byStatus["completed"] ?? 0) +
        (d.callsToday.byStatus["in_progress"] ?? 0);
    final credits = d.totalCost;
    final tiles = <Widget>[
      CallStatTile(
        label: "Calls today",
        value: "${d.callsToday.total}",
        icon: PhosphorIcons.chatCircle(),
        tone: CallStatTone.info,
      ),
      CallStatTile(
        label: "Connected today",
        value: "${connected.toInt()}",
        icon: PhosphorIcons.phone(),
        tone: CallStatTone.success,
      ),
      CallStatTile(
        label: "Running campaigns",
        value: "${d.campaignsRunning}",
        icon: PhosphorIcons.lightning(),
        tone: CallStatTone.accent,
      ),
      CallStatTile(
        label: "Credits today",
        value: "${credits.toInt()}",
        icon: PhosphorIcons.sparkle(),
        tone: CallStatTone.warning,
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.md;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final t in tiles) SizedBox(width: width, child: t),
          ],
        );
      },
    );
  }

  Widget _statusTodayCard(BuildContext context, CallCenterDashboard d) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final entries = d.callsToday.byStatus.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: "Call status today"),
          const Gap(AppSpacing.md),
          Row(
            children: [
              Icon(PhosphorIcons.clock(), size: 15, color: c.textMuted),
              const Gap(AppSpacing.xs),
              Text(
                "${d.totalMinutes.toInt()} min talk time",
                style: text.bodySmall?.copyWith(color: c.textSecondary),
              ),
              const Gap(AppSpacing.lg),
              Icon(PhosphorIcons.calendar(), size: 15, color: c.textMuted),
              const Gap(AppSpacing.xs),
              Flexible(
                child: Text(
                  "${d.tasksScheduled} scheduled",
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ),
            ],
          ),
          const Gap(AppSpacing.md),
          if (entries.isEmpty)
            Text(
              "No calls yet today. They show up here as your agents pick up.",
              style: text.bodySmall?.copyWith(color: c.textMuted),
            )
          else
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final e in entries)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: c.surfaceMuted,
                      borderRadius: AppRadius.smAll,
                      border: Border.all(color: c.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        StatusChip(status: e.key),
                        const Gap(AppSpacing.sm),
                        Text(
                          "${e.value.toInt()}",
                          style: text.labelMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _agentsCard(BuildContext context, CallCenterOverviewState state) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: SectionHeader(
              title: "Voice agents",
              icon: PhosphorIcons.robot(),
              subtitle:
                  "${state.agents.length} ${state.agents.length == 1 ? "agent" : "agents"}",
            ),
          ),
          if (state.agents.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Text(
                "No agents yet. Create one on the web dashboard, or ask Jarvis.",
                style: text.bodySmall?.copyWith(color: c.textMuted),
              ),
            )
          else
            for (final agent in state.agents)
              ListRowTile(
                icon: PhosphorIcons.robot(),
                title: agent.name.isEmpty ? "Untitled agent" : agent.name,
                subtitle: agent.useCase.isEmpty ? null : agent.useCase,
                showChevron: false,
                trailing: StatusChip(status: agent.status),
              ),
        ],
      ),
    );
  }

  Widget _numbersCard(BuildContext context, CallCenterOverviewState state) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: SectionHeader(
              title: "Phone numbers",
              icon: PhosphorIcons.phone(),
              subtitle:
                  "${state.phoneNumbers.length} connected",
            ),
          ),
          if (state.phoneNumbers.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Text(
                "No number connected. Buy or attach one on the web dashboard, "
                "or ask Jarvis — the attached agent answers every call to it.",
                style: text.bodySmall?.copyWith(color: c.textMuted),
              ),
            )
          else
            for (final number in state.phoneNumbers)
              ListRowTile(
                icon: PhosphorIcons.phone(),
                title: number.e164.isEmpty ? "Unknown number" : number.e164,
                subtitle: _numberSubtitle(state, number),
                showChevron: false,
                trailing: StatusChip.custom(
                  label: number.active ? "Active" : "Paused",
                  tone: number.active ? StatusTone.success : StatusTone.neutral,
                ),
              ),
        ],
      ),
    );
  }

  String _numberSubtitle(
    CallCenterOverviewState state,
    CallPhoneNumber number,
  ) {
    final parts = <String>[];
    final agentName = state.agentNameFor(number.agentId);
    parts.add(agentName != null ? "Agent: $agentName" : "No agent attached");
    if (number.label != null && number.label!.isNotEmpty) {
      parts.add(number.label!);
    }
    return parts.join("  ·  ");
  }

  Widget _navCard(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          ListRowTile(
            icon: PhosphorIcons.phoneCall(),
            title: "Call history",
            subtitle: "Every call, with outcome and duration",
            onTap: () =>
                Navigator.of(context).push(CallHistoryScreen.route()),
          ),
          Divider(
            height: 1,
            thickness: 1,
            color: context.colors.border,
            indent: AppSpacing.lg,
            endIndent: AppSpacing.lg,
          ),
          ListRowTile(
            icon: PhosphorIcons.chartBar(),
            title: "Analytics",
            subtitle: "Connect rate, containment and credit usage",
            onTap: () =>
                Navigator.of(context).push(CallAnalyticsScreen.route()),
          ),
        ],
      ),
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
