import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/ads_models.dart";
import "../data/ads_repository.dart";

/// Loads a single campaign and runs its actions (launch, pause, set budget).
/// Each action calls the repository — which throws a typed [ApiError] on
/// failure so the screen can surface it — then silently re-fetches the
/// campaign so the UI reflects the new state. A re-fetch failure keeps the
/// prior data rather than masking a successful action with an error screen.
class AdsCampaignDetailController
    extends AutoDisposeFamilyAsyncNotifier<AdsCampaignDetail, String> {
  AdsRepository get _repo => ref.read(adsRepositoryProvider);

  @override
  Future<AdsCampaignDetail> build(String arg) => _repo.getCampaignDetail(arg);

  Future<void> _reload() async {
    try {
      final detail = await _repo.getCampaignDetail(arg);
      state = AsyncData(detail);
    } catch (_) {
      // Keep the current (pre-action) data; the action itself succeeded.
    }
  }

  /// Launch the campaign — it starts spending, billed to the merchant's ad
  /// account. Confirmed in the UI before this runs.
  Future<void> launch() async {
    await _repo.setCampaignStatus(arg, "active");
    await _reload();
  }

  /// Pause the campaign — stops spend.
  Future<void> pause() async {
    await _repo.setCampaignStatus(arg, "paused");
    await _reload();
  }

  /// Set the daily budget (in the ad account's currency, major units).
  Future<void> setBudget(num dailyBudget) async {
    await _repo.setCampaignBudget(arg, dailyBudget);
    await _reload();
  }
}

final adsCampaignDetailControllerProvider = AsyncNotifierProvider.autoDispose
    .family<AdsCampaignDetailController, AdsCampaignDetail, String>(
  AdsCampaignDetailController.new,
);
