// Insights state — a Riverpod [AsyncNotifier] that loads and refreshes the
// composed [InsightsSnapshot] for the currently-selected date range.
//
// The range lives in a separate [insightsRangeProvider] that the notifier
// WATCHES, so switching Today / 7 days / 30 days transparently re-runs the
// fetch. Pull-to-refresh calls [refresh], which keeps the current data visible
// under the spinner (never flashing a skeleton over good data).
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/insights_models.dart";
import "../data/insights_repository.dart";

/// The selected date window. Changing it re-runs [InsightsController.build].
final insightsRangeProvider = StateProvider<InsightsRange>(
  (ref) => InsightsRange.sevenDays,
);

class InsightsController extends AsyncNotifier<InsightsSnapshot> {
  @override
  Future<InsightsSnapshot> build() {
    final range = ref.watch(insightsRangeProvider);
    return ref.read(insightsRepositoryProvider).fetchInsights(range);
  }

  /// Re-fetch the current range, keeping existing data under the refresh
  /// spinner so pull-to-refresh doesn't flash the skeleton.
  Future<void> refresh() async {
    final range = ref.read(insightsRangeProvider);
    state = const AsyncValue<InsightsSnapshot>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(
      () => ref.read(insightsRepositoryProvider).fetchInsights(range),
    );
  }

  /// Switch the date window. No-op when unchanged; otherwise the watched range
  /// provider drives a rebuild.
  void setRange(InsightsRange range) {
    final current = ref.read(insightsRangeProvider);
    if (current == range) return;
    ref.read(insightsRangeProvider.notifier).state = range;
  }
}

final insightsControllerProvider =
    AsyncNotifierProvider<InsightsController, InsightsSnapshot>(
  InsightsController.new,
);
