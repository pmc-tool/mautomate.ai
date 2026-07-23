import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/jarvis_models.dart";
import "../data/jarvis_repository.dart";

/// Loads and mutates the store's Jarvis chat history for the history drawer.
///
/// Exposes the list as an [AsyncValue] so the drawer renders loading / empty /
/// error states off one source, with [refresh] and [remove] for interaction.
class JarvisConversationsController
    extends AutoDisposeAsyncNotifier<List<JarvisConversation>> {
  @override
  Future<List<JarvisConversation>> build() {
    return ref.read(jarvisRepositoryProvider).listConversations();
  }

  /// Reloads the history from the server.
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(jarvisRepositoryProvider).listConversations(),
    );
  }

  /// Deletes a conversation, then reloads.
  Future<void> remove(String id) async {
    await ref.read(jarvisRepositoryProvider).deleteConversation(id);
    await refresh();
  }
}

final jarvisConversationsControllerProvider = AsyncNotifierProvider.autoDispose<
    JarvisConversationsController, List<JarvisConversation>>(
  JarvisConversationsController.new,
);
