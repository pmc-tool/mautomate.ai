import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../../core/theme/theme.dart";
import "../../data/inbox_models.dart";
import "../inbox_format.dart";

/// One message in a thread.
///
///  - Contact messages sit on the left in a bordered surface bubble.
///  - AI messages sit on the right, tinted with the info token, badged with a
///    robot avatar.
///  - Agent (you/your team) messages sit on the right in the ink primary bubble.
///  - System/internal audit lines render as a centered pill.
///
/// Ported from the web inbox `MessageBubble`.
class InboxMessageBubble extends StatelessWidget {
  const InboxMessageBubble({
    super.key,
    required this.message,
    required this.contactDisplayName,
  });

  final InboxMessage message;
  final String contactDisplayName;

  @override
  Widget build(BuildContext context) {
    if (isInternalMessage(message)) {
      return _SystemLine(message: message);
    }

    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final isContact = message.author == "contact";
    final isAi = message.author == "ai";
    final failed = message.deliveryStatus == "failed";
    final notDelivered = message.deliveryStatus == "no_channel_credential";

    final Color bubbleColor;
    final Color bodyColor;
    if (isContact) {
      bubbleColor = c.surface;
      bodyColor = c.textPrimary;
    } else if (isAi) {
      bubbleColor = c.infoBg;
      bodyColor = c.textPrimary;
    } else {
      bubbleColor = c.primary;
      bodyColor = c.onPrimary;
    }

    final avatar = _Avatar(isContact: isContact, isAi: isAi, name: contactDisplayName);
    final body = (message.body ?? "").trim();

    final column = Column(
      crossAxisAlignment:
          isContact ? CrossAxisAlignment.start : CrossAxisAlignment.end,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          textDirection: isContact ? TextDirection.ltr : TextDirection.rtl,
          children: [
            Text(
              _authorLabel(message, contactDisplayName),
              style: text.labelSmall?.copyWith(color: c.textSecondary),
            ),
            const Gap(AppSpacing.sm),
            Text(
              messageTime(message.sentAt),
              style: text.labelSmall?.copyWith(color: c.textMuted),
            ),
          ],
        ),
        if (body.isNotEmpty) ...[
          const Gap(AppSpacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(isContact ? AppRadius.sm : AppRadius.lg),
                topRight: Radius.circular(isContact ? AppRadius.lg : AppRadius.sm),
                bottomLeft: const Radius.circular(AppRadius.lg),
                bottomRight: const Radius.circular(AppRadius.lg),
              ),
              border: isContact ? Border.all(color: c.border) : null,
            ),
            child: Text(
              body,
              style: text.bodyMedium?.copyWith(color: bodyColor, height: 1.4),
            ),
          ),
        ],
        if (failed || notDelivered) ...[
          const Gap(AppSpacing.xs),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                PhosphorIcons.warningCircle(),
                size: 12,
                color: failed ? c.danger : c.warning,
              ),
              const Gap(AppSpacing.xs),
              Flexible(
                child: Text(
                  failed
                      ? "Delivery failed"
                      : "Saved to the thread, but no connected account could deliver it",
                  style: text.labelSmall?.copyWith(
                    color: failed ? c.danger : c.warning,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Row(
        mainAxisAlignment:
            isContact ? MainAxisAlignment.start : MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        textDirection: isContact ? TextDirection.ltr : TextDirection.rtl,
        children: [
          avatar,
          const Gap(AppSpacing.sm),
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * 0.72,
              ),
              child: column,
            ),
          ),
        ],
      ),
    );
  }
}

String _authorLabel(InboxMessage message, String name) {
  switch (message.author) {
    case "ai":
      return "AI assistant";
    case "agent":
      return "You and your team";
    case "system":
      return "System";
    default:
      return name;
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.isContact,
    required this.isAi,
    required this.name,
  });

  final bool isContact;
  final bool isAi;
  final String name;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final Color bg;
    final Color fg;
    if (isContact) {
      bg = c.surfaceMuted;
      fg = c.textSecondary;
    } else if (isAi) {
      bg = c.infoBg;
      fg = c.info;
    } else {
      bg = c.primary;
      fg = c.onPrimary;
    }

    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: isAi
          ? Icon(PhosphorIcons.robot(), size: 15, color: fg)
          : Text(
              initial(isContact ? name : "A"),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
            ),
    );
  }
}

class _SystemLine extends StatelessWidget {
  const _SystemLine({required this.message});

  final InboxMessage message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 320),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: c.surfaceMuted,
            borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: c.border),
          ),
          child: Text(
            [
              (message.body ?? "").trim(),
              messageTime(message.sentAt),
            ].where((s) => s.isNotEmpty).join("  ·  "),
            textAlign: TextAlign.center,
            style: text.labelSmall?.copyWith(color: c.textSecondary),
          ),
        ),
      ),
    );
  }
}
