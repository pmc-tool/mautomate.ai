import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/marketing_models.dart";
import "../data/marketing_repository.dart";

/// State for the Campaigns tab.
class MarketingCampaignsState {
  const MarketingCampaignsState({
    this.campaigns = const <MarketingCampaign>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
  });

  final List<MarketingCampaign> campaigns;
  final bool isLoading;
  final bool isRefreshing;
  final ApiError? error;

  bool get isEmpty => !isLoading && error == null && campaigns.isEmpty;

  static const Object _keep = Object();

  MarketingCampaignsState copyWith({
    List<MarketingCampaign>? campaigns,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
  }) {
    return MarketingCampaignsState(
      campaigns: campaigns ?? this.campaigns,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
    );
  }
}

/// Loads the tenant's marketing campaigns.
class MarketingCampaignsController extends Notifier<MarketingCampaignsState> {
  @override
  MarketingCampaignsState build() {
    Future.microtask(_load);
    return const MarketingCampaignsState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      final campaigns =
          await ref.read(marketingRepositoryProvider).listCampaigns();
      state = state.copyWith(
        campaigns: campaigns,
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

final marketingCampaignsControllerProvider =
    NotifierProvider<MarketingCampaignsController, MarketingCampaignsState>(
  MarketingCampaignsController.new,
);
