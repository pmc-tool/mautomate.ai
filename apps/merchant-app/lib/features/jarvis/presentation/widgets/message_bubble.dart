import "package:flutter/material.dart";

import "../../../../core/theme/theme.dart";
import "../../data/jarvis_models.dart";
import "confirm_card.dart";
import "jarvis_rich_text.dart";
import "thinking_indicator.dart";
import "tool_activity_chip.dart";

/// Renders one transcript turn.
///
/// User turns are right-aligned ember bubbles. Assistant turns are left-aligned
/// and composite: the live tool rows, a thinking indicator (only before any
/// content), the reply bubble (rich text), any confirm cards, and an error.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.onConfirm,
    required this.onDismiss,
    required this.onUndo,
  });

  final ChatMessage message;
  final void Function(JarvisConfirm confirm, String confirmText) onConfirm;
  final void Function(String confirmId) onDismiss;
  final void Function(JarvisConfirm confirm) onUndo;

  @override
  Widget build(BuildContext context) {
    return message.role == ChatRole.user
        ? _buildUser(context)
        : _buildAssistant(context);
  }

  Widget _buildUser(BuildContext context) {
    final colors = context.colors;
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        margin: const EdgeInsets.only(top: AppSpacing.md, left: AppSpacing.xxl),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.accent,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(AppRadius.lg),
            topRight: Radius.circular(AppRadius.sm),
            bottomLeft: Radius.circular(AppRadius.lg),
            bottomRight: Radius.circular(AppRadius.lg),
          ),
        ),
        child: Text(
          message.text ?? "",
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colors.onAccent,
                height: 1.4,
              ),
        ),
      ),
    );
  }

  Widget _buildAssistant(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final hasText = (message.text ?? "").isNotEmpty;
    final visibleConfirms = message.confirms
        .where((c) => c.status != ConfirmStatus.dismissed)
        .toList();
    final showThinking = message.thinking &&
        !hasText &&
        (message.error ?? "").isEmpty &&
        message.tools.isEmpty &&
        visibleConfirms.isEmpty;

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.9,
        ),
        margin: const EdgeInsets.only(top: AppSpacing.md, right: AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final tool in message.tools) ToolActivityChip(tool: tool),
            if (showThinking)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: ThinkingIndicator(),
              ),
            if (hasText)
              Container(
                margin: const EdgeInsets.only(top: AppSpacing.xs),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceMuted,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppRadius.sm),
                    topRight: Radius.circular(AppRadius.lg),
                    bottomLeft: Radius.circular(AppRadius.lg),
                    bottomRight: Radius.circular(AppRadius.lg),
                  ),
                ),
                child: JarvisRichText(
                  text: message.text!,
                  baseStyle: textTheme.bodyMedium!.copyWith(
                    color: colors.textPrimary,
                    height: 1.45,
                  ),
                ),
              ),
            for (final confirm in visibleConfirms)
              ConfirmCard(
                key: ValueKey(confirm.id),
                confirm: confirm,
                onConfirm: (text) => onConfirm(confirm, text),
                onDismiss: () => onDismiss(confirm.id),
                onUndo: () => onUndo(confirm),
              ),
            if ((message.error ?? "").isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: AppSpacing.xs),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: colors.dangerBg,
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: colors.dangerBorder),
                ),
                child: Text(
                  message.error!,
                  style: textTheme.bodySmall?.copyWith(color: colors.danger),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
