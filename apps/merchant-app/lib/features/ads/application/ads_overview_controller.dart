import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/ads_models.dart";
import "../data/ads_repository.dart";

/// The selectable performance windows on the overview — mirrors the web
/// `WINDOWS` (7 / 30 / 90 days).
const List<int> kAdsWindows = [7, 30, 90];

/// Immutable state for the Advertising overview: the payload, the active
/// window, and load/sync/error flags.
class AdsOverviewState {
  const AdsOverviewState({
    this.overview,
    this.days = 30,
    this.isLoading = true,
    this.isRefreshing = false,
    this.isSyncing = false,
    this.error,
  });

  /// The last successfully loaded overview (null until first load).
  final AdsOverview? overview;

  /// The active window in days.
  final int days;

  /// Initial load in flight (no data yet).
  final bool isLoading;

  /// A pull-to-refresh is in flight (data already on screen).
  final bool isRefreshing;

  /// A "Sync now" is in flight.
  final bool isSyncing;

  /// The last load error, when any.
  final ApiError? error;

  bool get hasConnection => overview?.hasConnection ?? false;
  bool get hasCampaigns => overview?.hasCampaigns ?? false;

  static const Object _keep = Object();

  AdsOverviewState copyWith({
    Object? overview = _keep,
    int? days,
    bool? isLoading,
    bool? isRefreshing,
    bool? isSyncing,
    Object? error = _keep,
  }) {
    return AdsOverviewState(
      overview: overview == _keep ? this.overview : overview as AdsOverview?,
      days: days ?? this.days,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isSyncing: isSyncing ?? this.isSyncing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the Advertising overview for the active window, changes the window,
/// and triggers a "Sync now" (which re-pulls from the ad platforms then
/// reloads). Pull-to-refresh and window changes re-query the server.
class AdsOverviewController extends Notifier<AdsOverviewState> {
  AdsRepository get _repo => ref.read(adsRepositoryProvider);

  @override
  AdsOverviewState build() {
    Future.microtask(_load);
    return const AdsOverviewState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final overview = await _repo.getOverview(days: state.days);
      state = state.copyWith(
        overview: overview,
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

  /// Pull-to-refresh — re-queries the current window.
  Future<void> refresh() => _load(refreshing: true);

  /// Re-run the load after an error.
  void retry() {
    _load();
  }

  /// Switch the performance window and re-query.
  void setWindow(int days) {
    if (days == state.days) return;
    state = state.copyWith(days: days);
    _load();
  }

  /// Re-pull campaigns + insights from the ad platforms, then reload. Returns
  /// the sync summary so the screen can surface any platform-reported issues.
  Future<AdsSyncSummary?> syncNow() async {
    if (state.isSyncing) return null;
    state = state.copyWith(isSyncing: true, error: null);
    try {
      final summary = await _repo.runSyncNow();
      await _load(refreshing: true);
      state = state.copyWith(isSyncing: false);
      return summary;
    } catch (e) {
      state = state.copyWith(isSyncing: false, error: ApiError.from(e));
      rethrow;
    }
  }
}

final adsOverviewControllerProvider =
    NotifierProvider<AdsOverviewController, AdsOverviewState>(
  AdsOverviewController.new,
);
