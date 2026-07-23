import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/inbox_list_controller.dart";
import "../data/inbox_models.dart";
import "../data/inbox_repository.dart";
import "inbox_format.dart";
import "inbox_thread_screen.dart";
import "widgets/conversation_row.dart";

/// The Inbox: one place for every customer conversation across every channel.
///
/// The AI assistant answers almost everything, so the landing view is "Needs
/// you" — the threads it handed back. Merchants filter by view (Needs you,
/// Unassigned, Mine, Starred, Open, Closed, Everything) and by channel, search,
/// and toggle unread-only. Tapping a row opens the full thread, where the KEY
/// control is the hand-to-AI / take-over handoff.
///
/// The class name and const constructor are stable so the router needs no edit.
class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _toggleStar(InboxConversation conversation) async {
    try {
      await ref.read(inboxRepositoryProvider).star(conversation.id);
      ref.read(inboxListControllerProvider.notifier).refreshSilently();
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiError ? e.message : "Couldn't update the star";
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Surface a transient refresh error (rows already on screen) as a snackbar.
    ref.listen<InboxListState>(inboxListControllerProvider, (prev, next) {
      final err = next.error;
      if (err != null &&
          next.conversations.isNotEmpty &&
          prev?.error != err) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err.message)));
      }
    });

    final state = ref.watch(inboxListControllerProvider);
    final controller = ref.read(inboxListControllerProvider.notifier);

    return AppScaffold(
      title: "Inbox",
      onRefresh: controller.refresh,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: AppTextField(
              controller: _searchController,
              hint: "Search name, email or phone",
              prefixIcon: PhosphorIcons.magnifyingGlass(),
              textInputAction: TextInputAction.search,
              onChanged: controller.search,
              suffix: state.query.isEmpty
                  ? null
                  : IconButton(
                      icon: Icon(PhosphorIcons.x(), size: 18),
                      tooltip: "Clear",
                      onPressed: () {
                        _searchController.clear();
                        controller.search("");
                      },
                    ),
            ),
          ),
          _ViewBar(
            selected: state.view,
            counts: state.counts,
            onSelected: controller.setView,
          ),
          const Gap(AppSpacing.sm),
          _ChannelBar(
            selectedChannel: state.channel,
            unreadOnly: state.unreadOnly,
            counts: state.counts,
            onChannel: controller.setChannel,
            onUnreadOnly: controller.setUnreadOnly,
          ),
          const Gap(AppSpacing.sm),
          Expanded(child: _content(context, state, controller)),
        ],
      ),
    );
  }

  Widget _content(
    BuildContext context,
    InboxListState state,
    InboxListController controller,
  ) {
    if (state.isLoading && state.conversations.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.conversations.isEmpty) {
      return _Scrollable(
        child: ErrorStateView(
          title: "Couldn't load conversations",
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    if (state.isEmpty) {
      return _Scrollable(
        child: EmptyState(
          icon: PhosphorIcons.chatCircleDots(),
          title: "Nothing here",
          message: _emptyMessage(state),
        ),
      );
    }

    final rows = state.conversations;
    final c = context.colors;
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      itemCount: rows.length,
      separatorBuilder: (context, _) => Divider(
        height: 1,
        thickness: 1,
        color: c.border,
        indent: AppSpacing.lg,
        endIndent: AppSpacing.lg,
      ),
      itemBuilder: (context, index) {
        final conversation = rows[index];
        return ConversationRow(
          conversation: conversation,
          onTap: () => Navigator.of(context).push(
            InboxThreadScreen.route(conversation.id),
          ),
          onToggleStar: () => _toggleStar(conversation),
        );
      },
    );
  }

  String _emptyMessage(InboxListState state) {
    if (state.channel.isNotEmpty) {
      final label = channelMeta(state.channel).label;
      return "No $label threads in this view. Choose \"All\" channels to widen the search.";
    }
    switch (state.view) {
      case InboxView.needsYou:
        return "Nothing is waiting on you. The AI assistant is handling every open thread — anything it cannot answer lands here.";
      case InboxView.mine:
        return "You have not taken over any conversation. Open a thread and choose Take over to handle it yourself.";
      case InboxView.unassigned:
        return "Every open thread is claimed.";
      case InboxView.starred:
        return "Star a conversation to keep it here.";
      case InboxView.closed:
        return "No conversation has been closed yet.";
      case InboxView.open:
      case InboxView.all:
        return "Threads land here when a visitor writes in through the website chat, or through any channel you connected under Marketing.";
    }
  }
}

/// The horizontally-scrolling view selector, each pill carrying its badge count.
class _ViewBar extends StatelessWidget {
  const _ViewBar({
    required this.selected,
    required this.counts,
    required this.onSelected,
  });

  final InboxView selected;
  final InboxCounts? counts;
  final ValueChanged<InboxView> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: InboxView.values.length,
        separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
        itemBuilder: (context, index) {
          final view = InboxView.values[index];
          final count = view.countOf(counts);
          return _Pill(
            label: view.label,
            selected: view == selected,
            count: count,
            urgentCount: view.urgent && count > 0,
            onTap: () => onSelected(view),
          );
        },
      ),
    );
  }
}

/// The channel filter row: "All", each connected channel, then an Unread toggle.
class _ChannelBar extends StatelessWidget {
  const _ChannelBar({
    required this.selectedChannel,
    required this.unreadOnly,
    required this.counts,
    required this.onChannel,
    required this.onUnreadOnly,
  });

  final String selectedChannel;
  final bool unreadOnly;
  final InboxCounts? counts;
  final ValueChanged<String> onChannel;
  final ValueChanged<bool> onUnreadOnly;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        children: [
          _Pill(
            label: "All",
            selected: selectedChannel.isEmpty,
            onTap: () => onChannel(""),
          ),
          const Gap(AppSpacing.sm),
          for (final channel in kInboxChannels) ...[
            _Pill(
              label: channel.label,
              icon: channel.icon,
              iconColor: (counts?.channels[channel.id] ?? 0) > 0
                  ? channel.color(c)
                  : null,
              selected: selectedChannel == channel.id,
              count: counts?.channels[channel.id] ?? 0,
              onTap: () => onChannel(
                selectedChannel == channel.id ? "" : channel.id,
              ),
            ),
            const Gap(AppSpacing.sm),
          ],
          _Pill(
            label: "Unread",
            icon: PhosphorIcons.envelopeSimple(),
            selected: unreadOnly,
            onTap: () => onUnreadOnly(!unreadOnly),
          ),
        ],
      ),
    );
  }
}

/// A filter pill with an optional leading icon and a trailing count badge.
class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.iconColor,
    this.count = 0,
    this.urgentCount = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? iconColor;
  final int count;
  final bool urgentCount;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final fg = selected ? c.accent : c.textSecondary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          decoration: BoxDecoration(
            color: selected ? c.accentTint : c.surface,
            borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: selected ? c.accent : c.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: iconColor ?? fg),
                const Gap(AppSpacing.xs),
              ],
              Text(
                label,
                style: text.labelMedium?.copyWith(
                  color: fg,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              if (count > 0) ...[
                const Gap(AppSpacing.xs),
                Container(
                  constraints: const BoxConstraints(minWidth: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: urgentCount
                        ? c.danger
                        : (selected ? c.accent : c.surfaceMuted),
                    borderRadius:
                        const BorderRadius.all(Radius.circular(AppRadius.pill)),
                  ),
                  child: Text(
                    count > 99 ? "99+" : "$count",
                    textAlign: TextAlign.center,
                    style: text.labelSmall?.copyWith(
                      color: (urgentCount || selected)
                          ? c.onAccent
                          : c.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
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
