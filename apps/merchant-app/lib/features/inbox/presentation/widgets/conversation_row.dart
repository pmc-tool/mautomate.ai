import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../../core/theme/theme.dart";
import "../../../../core/widgets/status_chip.dart";
import "../../data/inbox_models.dart";
import "../inbox_format.dart";

/// A single conversation row in the inbox list: an avatar (channel-badged),
/// the contact name, a two-line preview, the relative time, the badges a
/// merchant must act on (Needs you / Agent / closed status), an unread count,
/// and a star toggle. Tapping opens the thread.
class ConversationRow extends StatelessWidget {
  const ConversationRow({
    super.key,
    required this.conversation,
    required this.onTap,
    required this.onToggleStar,
  });

  final InboxConversation conversation;
  final VoidCallback onTap;
  final VoidCallback onToggleStar;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final name = contactName(conversation.contact);
    final unread = conversation.unreadCount > 0;
    final channel = channelMeta(conversation.channel);
    final waiting = conversation.handlerMode == "queued";
    final isHuman = conversation.handlerMode == "human";
    final isClosed = conversation.status != "open";

    return Material(
      color: Colors.transparent,
      child: InkWell(
        splashColor: c.accent.withValues(alpha: 0.06),
        highlightColor: c.accent.withValues(alpha: 0.03),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 72),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Avatar(name: name, unread: unread, channel: channel),
                const Gap(AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.titleSmall?.copyWith(
                                fontWeight:
                                    unread ? FontWeight.w700 : FontWeight.w600,
                                color: unread ? c.textPrimary : c.textSecondary,
                              ),
                            ),
                          ),
                          const Gap(AppSpacing.sm),
                          Text(
                            timeAgo(conversation.lastMessageAt),
                            style: text.labelSmall?.copyWith(color: c.textMuted),
                          ),
                        ],
                      ),
                      const Gap(AppSpacing.xxs),
                      Text(
                        (conversation.preview?.trim().isNotEmpty ?? false)
                            ? conversation.preview!.trim()
                            : "No messages yet",
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodySmall?.copyWith(
                          color: unread ? c.textPrimary : c.textMuted,
                        ),
                      ),
                      if (waiting || isHuman || isClosed || unread) ...[
                        const Gap(AppSpacing.sm),
                        _Badges(
                          waiting: waiting,
                          isHuman: isHuman,
                          isClosed: isClosed,
                          status: conversation.status,
                          unreadCount: conversation.unreadCount,
                        ),
                      ],
                    ],
                  ),
                ),
                const Gap(AppSpacing.xs),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: onToggleStar,
                  tooltip: conversation.starred
                      ? "Remove star"
                      : "Star conversation",
                  icon: Icon(
                    conversation.starred
                        ? PhosphorIconsFill.star
                        : PhosphorIcons.star(),
                    size: 18,
                    color: conversation.starred ? c.warning : c.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.name,
    required this.unread,
    required this.channel,
  });

  final String name;
  final bool unread;
  final InboxChannelMeta channel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      width: 42,
      height: 42,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: unread ? c.primary : c.surfaceMuted,
              shape: BoxShape.circle,
            ),
            child: Text(
              initial(name),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: unread ? c.onPrimary : c.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: c.surface,
                shape: BoxShape.circle,
                border: Border.all(color: c.border),
              ),
              child: Icon(channel.icon, size: 11, color: channel.color(c)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badges extends StatelessWidget {
  const _Badges({
    required this.waiting,
    required this.isHuman,
    required this.isClosed,
    required this.status,
    required this.unreadCount,
  });

  final bool waiting;
  final bool isHuman;
  final bool isClosed;
  final String status;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        if (waiting)
          StatusChip.custom(
            label: "Needs you",
            tone: StatusTone.pending,
            icon: PhosphorIcons.clock(),
          )
        else if (isHuman)
          StatusChip.custom(
            label: "Agent",
            tone: StatusTone.success,
            icon: PhosphorIcons.user(),
          ),
        if ((waiting || isHuman) && isClosed) const Gap(AppSpacing.xs),
        if (isClosed)
          StatusChip.custom(
            label: status.isEmpty ? "Closed" : _humanise(status),
            tone: StatusTone.neutral,
          ),
        const Spacer(),
        if (unreadCount > 0)
          Container(
            constraints: const BoxConstraints(minWidth: 18),
            height: 18,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 5),
            decoration: BoxDecoration(
              color: c.primary,
              borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            ),
            child: Text(
              unreadCount > 99 ? "99+" : "$unreadCount",
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: c.onPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
      ],
    );
  }
}

String _humanise(String s) {
  final cleaned = s.replaceAll("_", " ").trim();
  if (cleaned.isEmpty) return "—";
  return cleaned[0].toUpperCase() + cleaned.substring(1);
}
