import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/auth/auth_controller.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/inbox_thread_controller.dart";
import "../data/inbox_models.dart";
import "../data/inbox_repository.dart";
import "inbox_format.dart";
import "widgets/inbox_message_bubble.dart";

/// The full conversation: message history grouped by day, the handoff banner
/// that says (in plain words) why the AI stepped back, and the KEY control —
/// the handler handoff. When the AI or the queue holds the thread the merchant
/// taps "Take over" to claim it and reply; "Return to AI" hands it back. Voice
/// (call-center) threads are read-only.
class InboxThreadScreen extends ConsumerStatefulWidget {
  const InboxThreadScreen({super.key, required this.conversationId});

  final String conversationId;

  static Route<void> route(String conversationId) {
    return MaterialPageRoute<void>(
      builder: (_) => InboxThreadScreen(conversationId: conversationId),
    );
  }

  @override
  ConsumerState<InboxThreadScreen> createState() => _InboxThreadScreenState();
}

class _InboxThreadScreenState extends ConsumerState<InboxThreadScreen> {
  final TextEditingController _composer = TextEditingController();
  final ScrollController _scroll = ScrollController();

  /// True while a handoff/status action is in flight (disables the controls).
  bool _acting = false;

  /// True while a reply is being sent.
  bool _sending = false;

  /// True while an AI draft is being generated.
  bool _suggesting = false;

  int _lastMessageCount = 0;

  InboxThreadController get _controller =>
      ref.read(inboxThreadControllerProvider(widget.conversationId).notifier);

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  void _notify(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      await action();
      if (success != null) _notify(success);
    } on ApiError catch (e) {
      _notify(e.message);
    } catch (e) {
      _notify("Something went wrong. Please try again.");
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _send() async {
    final body = _composer.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final delivered = await _controller.reply(body);
      _composer.clear();
      if (!delivered) {
        _notify(
          "The reply was saved to the thread, but it could not be delivered on this channel. Connect the channel under Marketing so replies reach the customer.",
        );
      }
    } on ApiError catch (e) {
      _notify(e.message);
    } catch (e) {
      _notify("Couldn't send the reply. Please try again.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _suggest() async {
    if (_suggesting) return;
    setState(() => _suggesting = true);
    try {
      final res = await _controller.suggest();
      if (res.needsAi || res.suggestion.isEmpty) {
        _notify(
          "No AI provider is configured for this store, so no draft could be generated.",
        );
      } else {
        _composer.text = res.suggestion;
        _composer.selection = TextSelection.fromPosition(
          TextPosition(offset: _composer.text.length),
        );
      }
    } on ApiError catch (e) {
      _notify(e.message);
    } catch (e) {
      _notify("Couldn't draft a reply. Please try again.");
    } finally {
      if (mounted) setState(() => _suggesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async =
        ref.watch(inboxThreadControllerProvider(widget.conversationId));
    final currentUserId =
        ref.watch(authControllerProvider).me?.merchant.id;

    final title = async.maybeWhen(
      data: (t) => contactName(t.conversation.contact),
      orElse: () => "Conversation",
    );

    return AppScaffold(
      title: title,
      actions: [
        async.maybeWhen(
          data: (t) => _HeaderActions(
            conversation: t.conversation,
            busy: _acting,
            onToggleStar: () => _run(_controller.toggleStar),
            onStatus: (status) => _run(
              () => _controller.setStatus(status),
              success: switch (status) {
                "closed" => "Conversation closed.",
                "snoozed" => "Conversation snoozed.",
                _ => "Conversation reopened.",
              },
            ),
          ),
          orElse: () => const SizedBox.shrink(),
        ),
      ],
      onRefresh: () => _controller.reload(),
      body: async.when(
        loading: () => const SkeletonList(itemCount: 5),
        error: (err, _) => ErrorStateView(
          title: "Couldn't load this conversation",
          message: err is ApiError ? err.message : "Please try again.",
          onRetry: () => ref.invalidate(
            inboxThreadControllerProvider(widget.conversationId),
          ),
        ),
        data: (thread) => _body(context, thread, currentUserId),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    ThreadResult thread,
    String? currentUserId,
  ) {
    final conversation = thread.conversation;
    final messages = thread.messages;

    if (messages.length != _lastMessageCount) {
      _lastMessageCount = messages.length;
      _scrollToBottom();
    }

    final isVoice = conversation.channel == "voice";
    final mine = conversation.handlerMode == "human" &&
        currentUserId != null &&
        conversation.assignedUserId == currentUserId;
    final canTakeOver = !isVoice &&
        (conversation.handlerMode == "ai" ||
            conversation.handlerMode == "queued");
    final canReply = !isVoice && mine && conversation.status != "closed";

    final handoff = handoffCopy(conversation.handoffReason);

    return Column(
      children: [
        _HandlerStrip(
          conversation: conversation,
          mine: mine,
          canTakeOver: canTakeOver,
          busy: _acting,
          onTakeOver: () => _run(
            _controller.takeOver,
            success:
                "You are handling this conversation now. The AI assistant stays silent until you return it.",
          ),
          onReturnToAi: () => _run(
            _controller.returnToAi,
            success:
                "Handed back to the AI assistant. It answers this thread from the next message on.",
          ),
        ),
        if (handoff != null) _HandoffBanner(handoff: handoff),
        Expanded(child: _messageList(context, conversation, messages)),
        _Footer(
          conversation: conversation,
          isVoice: isVoice,
          canReply: canReply,
          canTakeOver: canTakeOver,
          composer: _composer,
          sending: _sending,
          suggesting: _suggesting,
          busy: _acting,
          onSend: _send,
          onSuggest: _suggest,
          onTakeOver: () => _run(
            _controller.takeOver,
            success:
                "You are handling this conversation now. The AI assistant stays silent until you return it.",
          ),
          onReopen: () => _run(
            () => _controller.setStatus("open"),
            success: "Conversation reopened.",
          ),
        ),
      ],
    );
  }

  Widget _messageList(
    BuildContext context,
    InboxConversation conversation,
    List<InboxMessage> messages,
  ) {
    if (messages.isEmpty) {
      return const _Scrollable(
        child: EmptyState(
          title: "No messages yet",
          message: "This conversation has no messages yet.",
        ),
      );
    }

    final name = contactName(conversation.contact);

    // Group consecutive messages by calendar day, each group headed by a label.
    final children = <Widget>[];
    String? currentKey;
    for (final message in messages) {
      final key = dayKey(message.sentAt);
      if (key != currentKey) {
        currentKey = key;
        children.add(_DayHeader(label: dayLabel(message.sentAt)));
      }
      children.add(
        InboxMessageBubble(message: message, contactDisplayName: name),
      );
    }

    return ListView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      children: children,
    );
  }
}

/// Star toggle + status overflow menu in the app bar.
class _HeaderActions extends StatelessWidget {
  const _HeaderActions({
    required this.conversation,
    required this.busy,
    required this.onToggleStar,
    required this.onStatus,
  });

  final InboxConversation conversation;
  final bool busy;
  final VoidCallback onToggleStar;
  final ValueChanged<String> onStatus;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          onPressed: busy ? null : onToggleStar,
          tooltip:
              conversation.starred ? "Remove star" : "Star conversation",
          icon: Icon(
            conversation.starred
                ? PhosphorIconsFill.star
                : PhosphorIcons.star(),
            color: conversation.starred ? c.warning : null,
          ),
        ),
        PopupMenuButton<String>(
          enabled: !busy,
          tooltip: "Status",
          icon: Icon(PhosphorIcons.dotsThreeVertical()),
          onSelected: onStatus,
          itemBuilder: (context) => [
            _statusItem("open", "Open", PhosphorIcons.chatCircle(), conversation),
            _statusItem("snoozed", "Snooze", PhosphorIcons.clock(), conversation),
            _statusItem("closed", "Close", PhosphorIcons.checkCircle(), conversation),
          ],
        ),
      ],
    );
  }

  PopupMenuItem<String> _statusItem(
    String value,
    String label,
    IconData icon,
    InboxConversation conversation,
  ) {
    final active = conversation.status == value;
    return PopupMenuItem<String>(
      value: value,
      enabled: !active,
      child: Row(
        children: [
          Icon(icon, size: 18),
          const Gap(AppSpacing.md),
          Text(active ? "$label (current)" : label),
        ],
      ),
    );
  }
}

/// The handler-mode strip: who owns the thread now, plus the take-over / return
/// control — the heart of the feature.
class _HandlerStrip extends StatelessWidget {
  const _HandlerStrip({
    required this.conversation,
    required this.mine,
    required this.canTakeOver,
    required this.busy,
    required this.onTakeOver,
    required this.onReturnToAi,
  });

  final InboxConversation conversation;
  final bool mine;
  final bool canTakeOver;
  final bool busy;
  final VoidCallback onTakeOver;
  final VoidCallback onReturnToAi;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final handler = handlerMeta(conversation.handlerMode);
    final channel = channelMeta(conversation.channel);
    final isVoice = conversation.channel == "voice";

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Row(
        children: [
          Icon(channel.icon, size: 16, color: channel.color(c)),
          const Gap(AppSpacing.sm),
          Flexible(
            child: Text(
              channel.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: c.textSecondary,
                  ),
            ),
          ),
          const Gap(AppSpacing.sm),
          StatusChip.custom(
            label: isVoice ? "Call summary" : handler.label,
            tone: handler.tone,
            icon: handler.icon,
          ),
          const Spacer(),
          if (canTakeOver)
            PrimaryButton(
              label: "Take over",
              icon: PhosphorIcons.user(),
              size: AppButtonSize.small,
              onPressed: busy ? null : onTakeOver,
            )
          else if (mine && !isVoice)
            SecondaryButton(
              label: "Return to AI",
              icon: PhosphorIcons.robot(),
              size: AppButtonSize.small,
              onPressed: busy ? null : onReturnToAi,
            ),
        ],
      ),
    );
  }
}

/// The plain-words explanation of why the AI stepped back, with an optional
/// fix-it action (e.g. top up credits).
class _HandoffBanner extends StatelessWidget {
  const _HandoffBanner({required this.handoff});

  final InboxHandoffCopy handoff;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final urgent = handoff.actionRoute != null;
    final bg = urgent ? c.dangerBg : c.warningBg;
    final border = urgent ? c.dangerBorder : c.warningBorder;
    final fg = urgent ? c.danger : c.warning;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: bg,
        border: Border(bottom: BorderSide(color: border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.warningCircle(), size: 18, color: fg),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  handoff.title,
                  style: text.labelLarge?.copyWith(color: c.textPrimary),
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  handoff.detail,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
                if (handoff.actionLabel != null &&
                    handoff.actionRoute != null) ...[
                  const Gap(AppSpacing.sm),
                  PrimaryButton(
                    label: handoff.actionLabel!,
                    size: AppButtonSize.small,
                    onPressed: () => context.go(handoff.actionRoute!),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The reply composer (when the merchant holds the thread), the voice read-only
/// notice, or the take-over / reopen prompt when they do not.
class _Footer extends StatelessWidget {
  const _Footer({
    required this.conversation,
    required this.isVoice,
    required this.canReply,
    required this.canTakeOver,
    required this.composer,
    required this.sending,
    required this.suggesting,
    required this.busy,
    required this.onSend,
    required this.onSuggest,
    required this.onTakeOver,
    required this.onReopen,
  });

  final InboxConversation conversation;
  final bool isVoice;
  final bool canReply;
  final bool canTakeOver;
  final TextEditingController composer;
  final bool sending;
  final bool suggesting;
  final bool busy;
  final VoidCallback onSend;
  final VoidCallback onSuggest;
  final VoidCallback onTakeOver;
  final VoidCallback onReopen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget child;
    if (isVoice) {
      child = _Notice(
        icon: PhosphorIcons.phone(),
        message:
            "This is a call record from the call center. Calls are read-only in the inbox.",
      );
    } else if (canReply) {
      child = _Composer(
        composer: composer,
        sending: sending,
        suggesting: suggesting,
        onSend: onSend,
        onSuggest: onSuggest,
      );
    } else {
      final closed = conversation.status == "closed";
      final message = closed
          ? "This conversation is closed. Reopen it to reply."
          : conversation.handlerMode == "ai"
              ? "The AI assistant is handling this conversation. Take over to reply."
              : conversation.handlerMode == "queued"
                  ? "This conversation is waiting for a human agent. Take over to reply."
                  : "Another agent has taken over this conversation. Only they can reply until they return it to the AI assistant.";
      child = Row(
        children: [
          Expanded(
            child: Text(
              message,
              style: text.bodySmall?.copyWith(color: c.textSecondary),
            ),
          ),
          if (closed) ...[
            const Gap(AppSpacing.md),
            SecondaryButton(
              label: "Reopen",
              size: AppButtonSize.small,
              onPressed: busy ? null : onReopen,
            ),
          ] else if (canTakeOver) ...[
            const Gap(AppSpacing.md),
            PrimaryButton(
              label: "Take over",
              icon: PhosphorIcons.user(),
              size: AppButtonSize.small,
              onPressed: busy ? null : onTakeOver,
            ),
          ],
        ],
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: child,
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.composer,
    required this.sending,
    required this.suggesting,
    required this.onSend,
    required this.onSuggest,
  });

  final TextEditingController composer;
  final bool sending;
  final bool suggesting;
  final VoidCallback onSend;
  final VoidCallback onSuggest;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: composer,
                minLines: 1,
                maxLines: 5,
                enabled: !sending,
                textInputAction: TextInputAction.newline,
                keyboardType: TextInputType.multiline,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: c.textPrimary,
                    ),
                cursorColor: c.accent,
                decoration: InputDecoration(
                  hintText: "Write a reply",
                  filled: true,
                  fillColor: c.surfaceMuted,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.lgAll,
                    borderSide: BorderSide(color: c.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.lgAll,
                    borderSide: BorderSide(color: c.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: AppRadius.lgAll,
                    borderSide: BorderSide(color: c.accent),
                  ),
                ),
              ),
            ),
            const Gap(AppSpacing.sm),
            _SendButton(sending: sending, onSend: onSend),
          ],
        ),
        const Gap(AppSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: GhostButton(
            label: suggesting ? "Drafting" : "AI suggest",
            icon: PhosphorIcons.sparkle(),
            size: AppButtonSize.small,
            isLoading: suggesting,
            onPressed: (sending || suggesting) ? null : onSuggest,
          ),
        ),
      ],
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({required this.sending, required this.onSend});

  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: c.primary,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: sending ? null : onSend,
        child: SizedBox(
          width: 48,
          height: 48,
          child: sending
              ? Padding(
                  padding: const EdgeInsets.all(14),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: c.onPrimary,
                  ),
                )
              : Icon(
                  PhosphorIcons.paperPlaneTilt(),
                  color: c.onPrimary,
                  size: 20,
                ),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: c.textSecondary),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: c.textSecondary,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: c.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: c.textSecondary,
                ),
          ),
        ),
      ),
    );
  }
}

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
