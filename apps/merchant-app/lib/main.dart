import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "app.dart";
import "core/push/push_service.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Best-effort push init. Guarded internally: with no Firebase config yet it
  // degrades to disabled-push and NEVER throws or blocks launch.
  await bootstrapPushFirebase();
  runApp(const ProviderScope(child: MerchantApp()));
}
