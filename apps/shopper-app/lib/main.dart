import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "app.dart";
import "core/notifications/push_service.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Best-effort Firebase init for push. Guarded: with no google-services config
  // this leaves push disabled and the app runs fully without it (see
  // PUSH_SETUP.md). It NEVER blocks or crashes startup.
  await bootstrapPushFirebase();
  runApp(const ProviderScope(child: ShopperApp()));
}
