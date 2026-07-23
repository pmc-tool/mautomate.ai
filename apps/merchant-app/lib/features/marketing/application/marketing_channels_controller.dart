import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/marketing_models.dart";
import "../data/marketing_repository.dart";

/// State for the Channels tab: connected accounts + the provider catalog.
class MarketingChannelsState {
  const MarketingChannelsState({
    this.accounts = const <SocialAccount>[],
    this.providers = const <SocialProvider>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  final List<SocialAccount> accounts;
  final List<SocialProvider> providers;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;

  bool get isEmpty => !isLoading && error == null && accounts.isEmpty;

  static const Object _keep = Object();

  MarketingChannelsState copyWith({
    List<SocialAccount>? accounts,
    List<SocialProvider>? providers,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return MarketingChannelsState(
      accounts: accounts ?? this.accounts,
      providers: providers ?? this.providers,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the tenant's connected accounts + provider catalog and runs the safe
/// account mutations (refresh, disconnect). Connecting a NEW account (OAuth
/// consent / token entry) is done from the web dashboard — see the tab's note.
class MarketingChannelsController extends Notifier<MarketingChannelsState> {
  @override
  MarketingChannelsState build() {
    Future.microtask(_load);
    return const MarketingChannelsState();
  }

  MarketingRepository get _repo => ref.read(marketingRepositoryProvider);

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final res = await _repo.listAccounts();
      state = state.copyWith(
        accounts: res.accounts,
        providers: res.providers,
        isLoading: false,
        isRefreshing: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        error: ApiError.from(e),
      );
    }
  }

  Future<void> refresh() => _load(refreshing: true);

  void retry() => _load();

  /// Disconnect an account, then reload. Throws [ApiError] on failure so the
  /// caller can toast it.
  Future<void> disconnect(String id) async {
    await _repo.disconnectAccount(id);
    await _load(refreshing: true);
  }

  /// Refresh an account's token, then reload.
  Future<void> refreshAccount(String id) async {
    await _repo.refreshAccount(id);
    await _load(refreshing: true);
  }
}

final marketingChannelsControllerProvider =
    NotifierProvider<MarketingChannelsController, MarketingChannelsState>(
  MarketingChannelsController.new,
);
