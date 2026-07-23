import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/marketing_posts_controller.dart";
import "../data/marketing_models.dart";
import "../data/marketing_repository.dart";
import "marketing_platforms.dart";
import "post_composer_sheet.dart";

/// The Posts tab: a status-filterable list of marketing posts with per-post
/// actions (schedule, publish, approve, delete). Composing opens a bottom-sheet
/// composer. Public actions (schedule / publish now) confirm first — the server
/// enforces the gate regardless.
class MarketingPostsTab extends ConsumerStatefulWidget {
  const MarketingPostsTab({super.key});

  @override
  ConsumerState<MarketingPostsTab> createState() => _MarketingPostsTabState();
}

class _MarketingPostsTabState extends ConsumerState<MarketingPostsTab> {
  String? _busyId;

  MarketingPostsController get _controller =>
      ref.read(marketingPostsControllerProvider.notifier);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(marketingPostsControllerProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  "Plan, schedule and publish your social content.",
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: context.colors.textSecondary),
                ),
              ),
              const Gap(AppSpacing.md),
              PrimaryButton(
                label: "Compose",
                icon: PhosphorIcons.plus(),
                size: AppButtonSize.small,
                onPressed: _openComposer,
              ),
            ],
          ),
        ),
        _StatusFilterBar(
          selected: state.status,
          onSelected: _controller.setStatus,
        ),
        const Gap(AppSpacing.sm),
        Expanded(child: _content(state)),
      ],
    );
  }

  Widget _content(MarketingPostsState state) {
    if (state.isLoading && state.posts.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.posts.isEmpty) {
      return _refreshable(
        ErrorStateView(
          message: state.error!.message,
          onRetry: _controller.retry,
        ),
      );
    }

    if (state.isEmpty) {
      return _refreshable(
        EmptyState(
          icon: PhosphorIcons.article(),
          title: state.hasFilter ? "No matching posts" : "No posts yet",
          message: state.hasFilter
              ? "No posts match this filter. Try clearing it."
              : "Compose your first post to start planning your social content.",
          action: state.hasFilter
              ? null
              : PrimaryButton(
                  label: "Compose post",
                  icon: PhosphorIcons.plus(),
                  onPressed: _openComposer,
                ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _controller.refresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: AppSpacing.xl),
        itemCount: state.posts.length,
        separatorBuilder: (context, _) => Divider(
          height: 1,
          thickness: 1,
          color: context.colors.border,
          indent: AppSpacing.lg,
          endIndent: AppSpacing.lg,
        ),
        itemBuilder: (context, index) {
          final post = state.posts[index];
          return _PostRow(
            post: post,
            busy: _busyId == post.id,
            onActions: () => _openActions(post),
          );
        },
      ),
    );
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _controller.refresh,
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

  Future<void> _openComposer() async {
    final saved = await showMarketingComposer(
      context,
      connectedPlatforms:
          ref.read(marketingPostsControllerProvider).connectedPlatforms,
    );
    if (saved == true) {
      await _controller.reload();
      if (mounted) _toast("Post saved.");
    }
  }

  Future<void> _openActions(MarketingPost post) async {
    final platforms = post.platforms;
    final hasTargets = platforms.isNotEmpty;
    final action = await showModalBottomSheet<_PostAction>(
      context: context,
      backgroundColor: context.colors.surface,
      showDragHandle: true,
      builder: (sheetContext) {
        final c = sheetContext.colors;
        final status = post.status;
        final items = <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              0,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: Text(post.label, style: Theme.of(sheetContext).textTheme.titleSmall),
          ),
          if (!hasTargets)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                "This post has no channel targets, so it can't be scheduled or "
                "published. Compose a new post and pick channels to publish it.",
                style: Theme.of(sheetContext)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: c.textSecondary),
              ),
            ),
          if (status == "draft")
            _sheetTile(sheetContext, PhosphorIcons.paperPlaneTilt(),
                "Submit for approval", _PostAction.submit),
          if (status == "draft" || status == "needs_approval")
            _sheetTile(sheetContext, PhosphorIcons.checkCircle(), "Approve",
                _PostAction.approve),
          if (hasTargets)
            _sheetTile(sheetContext, PhosphorIcons.calendarPlus(), "Schedule…",
                _PostAction.schedule),
          if (hasTargets && status == "scheduled")
            _sheetTile(sheetContext, PhosphorIcons.calendarX(), "Unschedule",
                _PostAction.unschedule),
          if (hasTargets)
            _sheetTile(sheetContext, PhosphorIcons.rocketLaunch(), "Publish now",
                _PostAction.publish),
          Divider(height: 1, color: c.border, indent: AppSpacing.lg, endIndent: AppSpacing.lg),
          _sheetTile(sheetContext, PhosphorIcons.trash(), "Delete",
              _PostAction.delete, destructive: true),
          const Gap(AppSpacing.sm),
        ];
        return SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, children: items),
        );
      },
    );
    if (action == null) return;
    await _run(post, action);
  }

  Widget _sheetTile(
    BuildContext context,
    IconData icon,
    String label,
    _PostAction action, {
    bool destructive = false,
  }) {
    final c = context.colors;
    final color = destructive ? c.danger : c.textPrimary;
    return ListTile(
      leading: Icon(icon, size: 20, color: destructive ? c.danger : c.textSecondary),
      title: Text(label, style: TextStyle(color: color)),
      onTap: () => Navigator.of(context).pop(action),
    );
  }

  Future<void> _run(MarketingPost post, _PostAction action) async {
    switch (action) {
      case _PostAction.submit:
        await _mutate(post, () => _repo.approvePost(post.id, action: "submit"),
            success: "Submitted for approval.");
        break;
      case _PostAction.approve:
        await _mutate(post, () => _repo.approvePost(post.id, action: "approve"),
            success: "Post approved.");
        break;
      case _PostAction.unschedule:
        await _mutate(
            post, () => _repo.schedulePost(post.id, scheduledAt: null),
            success: "Post unscheduled.");
        break;
      case _PostAction.schedule:
        await _schedule(post);
        break;
      case _PostAction.publish:
        await _publish(post);
        break;
      case _PostAction.delete:
        await _delete(post);
        break;
    }
  }

  MarketingRepository get _repo => ref.read(marketingRepositoryProvider);

  Future<void> _schedule(MarketingPost post) async {
    final when = await _pickDateTime(context, DateTime.now().add(const Duration(hours: 1)));
    if (when == null) return;
    final ok = await _confirm(
      title: "Schedule this post?",
      message:
          "\"${post.label}\" will publish to ${post.platforms.length} channel"
          "${post.platforms.length == 1 ? "" : "s"} at ${_fmtDateTime(when)}.",
      confirmLabel: "Schedule",
    );
    if (!ok) return;
    await _mutate(
      post,
      () => _repo.schedulePost(post.id, scheduledAt: when.toUtc().toIso8601String()),
      success: "Post scheduled.",
    );
  }

  Future<void> _publish(MarketingPost post) async {
    final ok = await _confirm(
      title: "Publish now?",
      message:
          "\"${post.label}\" will be published immediately to "
          "${post.platforms.length} channel"
          "${post.platforms.length == 1 ? "" : "s"}.",
      confirmLabel: "Publish now",
    );
    if (!ok) return;
    setState(() => _busyId = post.id);
    try {
      final res = await _repo.publishNow(post.id);
      await _controller.reload();
      if (mounted) _toast(res.message);
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _delete(MarketingPost post) async {
    final ok = await _confirm(
      title: "Delete this post?",
      message: "\"${post.label}\" will be permanently deleted. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    );
    if (!ok) return;
    await _mutate(post, () => _repo.deletePost(post.id), success: "Post deleted.");
  }

  Future<void> _mutate(
    MarketingPost post,
    Future<void> Function() action, {
    required String success,
  }) async {
    setState(() => _busyId = post.id);
    try {
      await action();
      await _controller.reload();
      if (mounted) _toast(success);
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
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

enum _PostAction { submit, approve, schedule, unschedule, publish, delete }

/// A single post row: label, snippet, platform glyphs, schedule time, a status
/// chip and an actions button.
class _PostRow extends StatelessWidget {
  const _PostRow({required this.post, required this.busy, required this.onActions});

  final MarketingPost post;
  final bool busy;
  final VoidCallback onActions;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final platforms = post.platforms;
    final scheduled = post.earliestScheduledAt;

    return Opacity(
      opacity: busy ? 0.5 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          post.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleSmall,
                        ),
                      ),
                      if (post.source == "agent") ...[
                        const Gap(AppSpacing.sm),
                        StatusChip.custom(
                          label: "Agent",
                          tone: StatusTone.info,
                          icon: PhosphorIcons.robot(),
                        ),
                      ],
                    ],
                  ),
                  if ((post.body ?? "").trim().isNotEmpty) ...[
                    const Gap(AppSpacing.xxs),
                    Text(
                      post.body!.trim(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(color: c.textSecondary),
                    ),
                  ],
                  const Gap(AppSpacing.sm),
                  Row(
                    children: [
                      if (platforms.isEmpty)
                        Text(
                          "No channels",
                          style: text.labelSmall?.copyWith(color: c.textMuted),
                        )
                      else
                        ...platforms.take(5).map(
                              (p) => Padding(
                                padding: const EdgeInsets.only(right: AppSpacing.xs),
                                child: Icon(
                                  platformMeta(p).icon,
                                  size: 14,
                                  color: c.textSecondary,
                                ),
                              ),
                            ),
                      if (scheduled != null) ...[
                        const Gap(AppSpacing.sm),
                        Icon(PhosphorIcons.clock(), size: 12, color: c.textMuted),
                        const Gap(AppSpacing.xxs),
                        Flexible(
                          child: Text(
                            _fmtIso(scheduled),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelSmall?.copyWith(color: c.textMuted),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Gap(AppSpacing.md),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusChip(status: post.status),
                const Gap(AppSpacing.xs),
                IconButton(
                  icon: Icon(PhosphorIcons.dotsThreeOutline(), size: 20),
                  color: c.textSecondary,
                  tooltip: "Post actions",
                  onPressed: busy ? null : onActions,
                ),
              ],
            ),
          ],
        ),
      ),
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
        itemCount: kPostStatusOptions.length,
        separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
        itemBuilder: (context, index) {
          final option = kPostStatusOptions[index];
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
            borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
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

/// A combined date + time picker. Returns null if the merchant cancels either.
Future<DateTime?> _pickDateTime(BuildContext context, DateTime initial) async {
  final date = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime.now().subtract(const Duration(days: 1)),
    lastDate: DateTime.now().add(const Duration(days: 365)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(initial),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

String _fmtDateTime(DateTime dt) => DateFormat.yMMMd().add_jm().format(dt);

String _fmtIso(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.MMMd().add_jm().format(dt.toLocal());
}
