import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/jarvis_chat_controller.dart";
import "../data/jarvis_repository.dart";
import "jarvis_conversations_sheet.dart";
import "jarvis_voice_sheet.dart";
import "widgets/jarvis_empty_state.dart";
import "widgets/message_bubble.dart";

/// The Jarvis chat screen — a ChatGPT-style assistant docked in its own tab.
///
/// Streams a live run (thinking / tools / confirm cards / reply) from
/// POST /merchant/jarvis, renders write confirmations inline with the correct
/// soft/hard gate, and offers durable chat history. The composer carries a mic
/// beside Send that opens the immersive voice mode (on-device speech + the orb).
class JarvisScreen extends ConsumerStatefulWidget {
  const JarvisScreen({super.key});

  @override
  ConsumerState<JarvisScreen> createState() => _JarvisScreenState();
}

class _JarvisScreenState extends ConsumerState<JarvisScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  void _send([String? preset]) {
    final text = preset ?? _input.text;
    if (text.trim().isEmpty) return;
    _input.clear();
    setState(() {});
    ref.read(jarvisChatControllerProvider.notifier).send(text);
  }

  /// Opens the immersive voice mode. Sends flow through the same chat, so the
  /// transcript is up to date when the merchant returns.
  Future<void> _openVoice() async {
    await JarvisVoiceSheet.show(context);
    if (!mounted) return;
    _scrollToBottom();
  }

  Future<void> _openHistory() async {
    final selection = await JarvisConversationsSheet.show(context);
    if (selection == null || !mounted) return;
    final controller = ref.read(jarvisChatControllerProvider.notifier);
    if (selection.isNew) {
      controller.startNewChat();
      return;
    }
    final conversation = selection.conversation;
    if (conversation == null) return;
    try {
      final detail = await ref
          .read(jarvisRepositoryProvider)
          .getConversation(conversation.id);
      if (!mounted) return;
      controller.loadConversation(detail);
      _scrollToBottom();
    } on ApiError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final state = ref.watch(jarvisChatControllerProvider);

    // Auto-scroll as the transcript grows or a stream frame lands.
    ref.listen(jarvisChatControllerProvider, (_, __) => _scrollToBottom());

    final controller = ref.read(jarvisChatControllerProvider.notifier);

    return AppScaffold(
      title: "Jarvis",
      actions: [
        IconButton(
          tooltip: "Chat history",
          onPressed: _openHistory,
          icon: Icon(PhosphorIconsRegular.clockCounterClockwise,
              color: colors.textSecondary),
        ),
        IconButton(
          tooltip: "New chat",
          onPressed: () {
            controller.startNewChat();
            _input.clear();
            setState(() {});
          },
          icon: Icon(PhosphorIconsRegular.notePencil,
              color: colors.textSecondary),
        ),
      ],
      body: Column(
        children: [
          Expanded(
            child: state.messages.isEmpty
                ? SingleChildScrollView(
                    controller: _scroll,
                    child: JarvisEmptyState(onPrompt: _send),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.sm,
                      AppSpacing.lg,
                      AppSpacing.lg,
                    ),
                    itemCount: state.messages.length,
                    itemBuilder: (context, i) => MessageBubble(
                      message: state.messages[i],
                      onConfirm: controller.applyConfirm,
                      onDismiss: controller.dismissConfirm,
                      onUndo: controller.applyUndo,
                    ),
                  ),
          ),
          _Composer(
            controller: _input,
            busy: state.busy,
            onChanged: () => setState(() {}),
            onSend: _send,
            onVoice: _openVoice,
          ),
        ],
      ),
    );
  }
}

/// The message composer: a growing multiline field and a Send button. Structured
/// so a voice mic can drop in beside Send in a later wave.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.busy,
    required this.onChanged,
    required this.onSend,
    required this.onVoice,
  });

  final TextEditingController controller;
  final bool busy;
  final VoidCallback onChanged;
  final VoidCallback onSend;
  final VoidCallback onVoice;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final canSend = controller.text.trim().isNotEmpty && !busy;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.border)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    enabled: !busy,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.send,
                    onChanged: (_) => onChanged(),
                    onSubmitted: (_) => onSend(),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colors.textPrimary,
                        ),
                    decoration: InputDecoration(
                      hintText: "Ask Jarvis, or tell it what to do…",
                      hintStyle: TextStyle(color: colors.textMuted),
                      filled: true,
                      fillColor: colors.surfaceInset,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: AppRadius.lgAll,
                        borderSide: BorderSide(color: colors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: AppRadius.lgAll,
                        borderSide: BorderSide(color: colors.borderStrong),
                      ),
                      disabledBorder: OutlineInputBorder(
                        borderRadius: AppRadius.lgAll,
                        borderSide: BorderSide(color: colors.border),
                      ),
                    ),
                  ),
                ),
                const Gap(AppSpacing.sm),
                _MicButton(enabled: !busy, onPressed: onVoice),
                const Gap(AppSpacing.sm),
                _SendButton(enabled: canSend, onPressed: onSend),
              ],
            ),
            const Gap(AppSpacing.xs),
            Text(
              "Jarvis always asks before it changes anything.",
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.textMuted,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Opens the immersive voice mode. Sits between the field and Send; disabled
/// only while a text run is streaming (voice would collide with it).
class _MicButton extends StatelessWidget {
  const _MicButton({required this.enabled, required this.onPressed});

  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: "Talk to Jarvis",
      child: Material(
        color: colors.surfaceMuted,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onPressed : null,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(
              PhosphorIconsFill.microphone,
              size: 18,
              color: enabled ? colors.textPrimary : colors.textDisabled,
            ),
          ),
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({required this.enabled, required this.onPressed});

  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: "Send",
      child: Material(
        color: enabled ? colors.accent : colors.surfaceMuted,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onPressed : null,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(
              PhosphorIconsFill.paperPlaneRight,
              size: 18,
              color: enabled ? colors.onAccent : colors.textDisabled,
            ),
          ),
        ),
      ),
    );
  }
}
