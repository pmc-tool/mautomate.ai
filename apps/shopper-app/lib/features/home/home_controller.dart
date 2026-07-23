import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/theme/brand_theme.dart";
import "../chrome/chrome_controller.dart";
import "../chrome/store_chrome.dart";
import "home_repository.dart";

/// Loads the home page (and applies the store brand + chrome) once, exposing it
/// as an async value the [HomeScreen] renders loading / error / data states
/// from.
///
/// Side effects, so the whole app reflects the store as soon as the payload
/// resolves:
///  - pushes the resolved brand into [brandProvider] (app-bar, accent, nav), and
///  - pushes the parsed store chrome (topbar / header / footer) into
///    [storeChromeProvider] so [StoreHeader] / [StoreFooter] / [StoreMenuDrawer]
///    light up everywhere.
///
/// Refreshable via `ref.invalidate(homeControllerProvider)`.
final homeControllerProvider = FutureProvider<HomeLoad>((ref) async {
  final load = await ref.watch(homeRepositoryProvider).fetchHomePage();
  // Apply branding (no-op visual change when the store has no custom accent).
  ref.read(brandProvider.notifier).state = load.brand;
  // Apply the store chrome (draws nothing extra when the store defines none).
  ref.read(storeChromeProvider.notifier).state =
      StoreChrome.fromPayload(load.chrome);
  return load;
});
