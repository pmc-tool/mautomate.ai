import "package:flutter_riverpod/flutter_riverpod.dart";

import "store_chrome.dart";

/// The active store chrome (topbar / header / footer), resolved from the
/// app-render payload and shared app-wide.
///
/// Held as a plain [StateProvider] — mirroring `brandProvider` — so the home
/// loader can push it from the store payload
/// (`ref.read(storeChromeProvider.notifier).state = ...`) without coupling the
/// chrome widgets to any specific data source. Every chrome widget
/// ([StoreHeader], [StoreTopbar], [StoreFooter], [StoreMenuDrawer]) watches this
/// provider, so once any screen loads the payload the header/footer light up
/// everywhere. Defaults to [StoreChrome.empty] (draw nothing) so first paint is
/// correct before any network call resolves.
final storeChromeProvider =
    StateProvider<StoreChrome>((ref) => StoreChrome.empty);
