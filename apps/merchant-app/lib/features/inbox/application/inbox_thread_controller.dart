import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/inbox_repository.dart";

/// Loads a single conversation (its details + full message history) and runs its
/// actions: reply, AI-suggest, take over, return to AI, change status and star.
///
/// The KEY control is the handler-mode handoff — [takeOver] claims the thread
/// from the AI so the merchant can reply, [returnToAi] hands it back. Each
/// action calls the repository (which throws a typed [ApiError] the screen can
/// surface — e.g. a 409 when another agent already holds the thread) then
/// silently re-reads the thread so the UI reflects the new state. A re-read
/// failure keeps the prior data rather than masking a successful action.
class InboxThreadController
    extends AutoDisposeFamilyAsyncNotifier<ThreadResult, String> {
  InboxRepository get _repo => ref.read(inboxRepositoryProvider);

  @override
  Future<ThreadResult> build(String arg) async {
    final thread = await _repo.getConversation(arg);
    // Clear the unread badge on open. Fire-and-forget: a failed read receipt
    // must not block reading the thread; the badge self-corrects on refresh.
    _markReadSilently();
    return thread;
  }

  Future<void> _markReadSilently() async {
    try {
      await _repo.markRead(arg);
    } catch (_) {
      // The badge is corrected on the next list refresh.
    }
  }

  Future<void> _reload() async {
    try {
      state = AsyncData(await _repo.getConversation(arg));
    } catch (_) {
      // Keep the current (pre-action) data; the action itself succeeded.
    }
  }

  /// Send a reply. Returns the delivery outcome so the screen can warn when the
  /// reply was saved but the channel could not deliver it. Reloads the thread.
  Future<bool> reply(String text) async {
    final res = await _repo.reply(arg, text);
    await _reload();
    return res.delivered;
  }

  /// Draft a reply with AI — never sends it. Does not mutate the thread.
  Future<SuggestResult> suggest() => _repo.suggest(arg);

  /// Claim the thread from the AI so the merchant can reply.
  Future<void> takeOver() async {
    await _repo.takeOver(arg);
    await _reload();
  }

  /// Hand the thread back to the AI assistant.
  Future<void> returnToAi() async {
    await _repo.returnToAi(arg);
    await _reload();
  }

  /// Set the conversation status (open / snoozed / closed).
  Future<void> setStatus(String status) async {
    await _repo.setStatus(arg, status);
    await _reload();
  }

  /// Toggle the star.
  Future<void> toggleStar() async {
    await _repo.star(arg);
    await _reload();
  }

  /// Re-read the thread (pull-to-refresh / retry).
  Future<void> reload() => _reload();
}

final inboxThreadControllerProvider = AsyncNotifierProvider.autoDispose
    .family<InboxThreadController, ThreadResult, String>(
  InboxThreadController.new,
);
