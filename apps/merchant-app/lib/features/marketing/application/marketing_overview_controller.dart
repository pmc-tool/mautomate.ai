import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/marketing_models.dart";
import "../data/marketing_repository.dart";

/// State for the marketing Overview tab: the summary counts plus load/refresh
/// flags.
class MarketingOverviewState {
  const MarketingOverviewState({
    this.summary,
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  final MarketingSummary? summary;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;

  static const Object _keep = Object();

  MarketingOverviewState copyWith({
    Object? summary = _keep,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return MarketingOverviewState(
      summary: summary == _keep ? this.summary : summary as MarketingSummary?,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the marketing summary counts for the Overview tab.
class MarketingOverviewController extends Notifier<MarketingOverviewState> {
  @override
  MarketingOverviewState build() {
    Future.microtask(_load);
    return const MarketingOverviewState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final summary = await ref.read(marketingRepositoryProvider).getSummary();
      state = state.copyWith(
        summary: summary,
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
}

final marketingOverviewControllerProvider =
    NotifierProvider<MarketingOverviewController, MarketingOverviewState>(
  MarketingOverviewController.new,
);
