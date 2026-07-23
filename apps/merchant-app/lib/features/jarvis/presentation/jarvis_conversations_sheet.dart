import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/jarvis_conversations_controller.dart";
import "../data/jarvis_models.dart";

/// The chat history drawer. Presented as a modal sheet; returns the selected
/// [JarvisConversation] (or null for "start a new chat" / dismiss).
class JarvisConversationsSheet extends ConsumerWidget {
  const JarvisConversationsSheet._();

  /// Opens the history sheet and resolves to the merchant's choice.
  static Future<JarvisConversationSelection?> show(BuildContext context) {
    return showModalBottomSheet<JarvisConversationSelection>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const JarvisConversationsSheet._(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final async = ref.watch(jarvisConversationsControllerProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(AppRadius.lg),
            ),
          ),
          child: Column(
            children: [
              const Gap(AppSpacing.sm),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.borderStrong,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Text(
                      "Chats",
                      style: textTheme.titleMedium?.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => Navigator.of(context)
                          .pop(const JarvisConversationSelection.newChat()),
                      icon: Icon(PhosphorIconsRegular.plus,
                          size: 16, color: colors.accent),
                      label: Text(
                        "New chat",
                        style: textTheme.labelLarge?.copyWith(
                          color: colors.accent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.border),
              Expanded(
                child: async.when(
                  loading: () => _LoadingList(controller: scrollController),
                  error: (err, _) => ErrorStateView(
                    message:
                        "We could not load your chat history. Please try again.",
                    onRetry: () => ref
                        .read(jarvisConversationsControllerProvider.notifier)
                        .refresh(),
                  ),
                  data: (conversations) {
                    if (conversations.isEmpty) {
                      return const EmptyState(
                        icon: PhosphorIconsRegular.chatCircle,
                        title: "No chats yet",
                        message:
                            "Your conversations with Jarvis will show up here.",
                      );
                    }
                    return ListView.separated(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.sm,
                      ),
                      itemCount: conversations.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, color: colors.border, indent: AppSpacing.lg),
                      itemBuilder: (context, i) => _ConversationRow(
                        conversation: conversations[i],
                        onTap: () => Navigator.of(context).pop(
                          JarvisConversationSelection.open(conversations[i]),
                        ),
                        onDelete: () => ref
                            .read(jarvisConversationsControllerProvider.notifier)
                            .remove(conversations[i].id),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// The merchant's pick from the history sheet.
class JarvisConversationSelection {
  const JarvisConversationSelection.newChat()
      : conversation = null,
        isNew = true;
  const JarvisConversationSelection.open(this.conversation) : isNew = false;

  final JarvisConversation? conversation;
  final bool isNew;
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({
    required this.conversation,
    required this.onTap,
    required this.onDelete,
  });

  final JarvisConversation conversation;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Icon(PhosphorIconsRegular.chatCircle,
                size: 18, color: colors.textMuted),
            const Gap(AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    conversation.title.isEmpty
                        ? "New chat"
                        : conversation.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (_relativeTime(conversation.updatedAt) != null) ...[
                    const Gap(AppSpacing.xxs),
                    Text(
                      _relativeTime(conversation.updatedAt)!,
                      style: textTheme.bodySmall?.copyWith(
                        color: colors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              onPressed: onDelete,
              tooltip: "Delete chat",
              icon: Icon(PhosphorIconsRegular.trash,
                  size: 18, color: colors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  static String? _relativeTime(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final dt = DateTime.tryParse(iso);
    if (dt == null) return null;
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return "Just now";
    if (diff.inMinutes < 60) return "${diff.inMinutes}m ago";
    if (diff.inHours < 24) return "${diff.inHours}h ago";
    if (diff.inDays < 7) return "${diff.inDays}d ago";
    return "${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}";
  }
}

class _LoadingList extends StatelessWidget {
  const _LoadingList({required this.controller});

  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      itemCount: 6,
      itemBuilder: (context, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: colors.skeletonBase,
                borderRadius: AppRadius.smAll,
              ),
            ),
            const Gap(AppSpacing.md),
            Expanded(
              child: Container(
                height: 12,
                decoration: BoxDecoration(
                  color: colors.skeletonBase,
                  borderRadius: AppRadius.smAll,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
