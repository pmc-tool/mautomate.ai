import "package:flutter_riverpod/flutter_riverpod.dart";

import "app_config.dart";

/// The app's active per-store configuration, read once from the compile-time
/// environment. Overridable in tests via a `ProviderScope` override.
final appConfigProvider = Provider<AppConfig>(
  (ref) => AppConfig.fromEnvironment(),
);
