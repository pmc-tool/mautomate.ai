import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/ads_models.dart";
import "../data/ads_repository.dart";

/// Loads the connect screen's data (connections + accounts + platforms) and
/// runs its actions: start connecting a platform, pick the ad account this
/// store advertises from, and disconnect. After a mutating action it silently
/// reloads so the list reflects the new state.
class AdsAccountsController
    extends AutoDisposeAsyncNotifier<AdsAccountsResponse> {
  AdsRepository get _repo => ref.read(adsRepositoryProvider);

  @override
  Future<AdsAccountsResponse> build() => _repo.listAccounts();

  Future<void> _reload() async {
    try {
      state = AsyncData(await _repo.listAccounts());
    } catch (_) {
      // Keep current data; the action itself succeeded.
    }
  }

  /// Start connecting [platform]. Meta returns an OAuth `auth_url` the merchant
  /// completes in a browser; direct platforms connect immediately. The screen
  /// handles the returned URL. Reloads on a direct connection.
  Future<({String? authUrl, AdsConnection? connection})> connect(
    String platform,
  ) async {
    final result = await _repo.connectPlatform(platform);
    if (result.authUrl == null) {
      await _reload();
    }
    return result;
  }

  /// Pick (or unpick) the ad account this store advertises from.
  Future<void> selectAccount(String accountId, bool selected) async {
    await _repo.selectAccount(accountId, selected);
    await _reload();
  }

  /// Disconnect a platform connection.
  Future<void> disconnect(String connectionId) async {
    await _repo.disconnectConnection(connectionId);
    await _reload();
  }

  /// Re-fetch after an error.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo.listAccounts);
  }
}

final adsAccountsControllerProvider = AsyncNotifierProvider.autoDispose<
    AdsAccountsController, AdsAccountsResponse>(
  AdsAccountsController.new,
);
