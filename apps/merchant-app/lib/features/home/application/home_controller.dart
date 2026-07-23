// Home state — a Riverpod [AsyncNotifier] that loads and refreshes the
// composed [HomeSnapshot]. The screen keys off `AsyncValue` for its
// loading / data / error states; pull-to-refresh calls [refresh].
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/home_models.dart";
import "../data/home_repository.dart";

class HomeController extends AsyncNotifier<HomeSnapshot> {
  @override
  Future<HomeSnapshot> build() => ref.read(homeRepositoryProvider).fetchHome();

  /// Re-fetch, keeping the current data visible under the refresh spinner
  /// (so pull-to-refresh never flashes a skeleton over good data).
  Future<void> refresh() async {
    state = const AsyncValue<HomeSnapshot>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(
      () => ref.read(homeRepositoryProvider).fetchHome(),
    );
  }
}

final homeControllerProvider =
    AsyncNotifierProvider<HomeController, HomeSnapshot>(HomeController.new);
