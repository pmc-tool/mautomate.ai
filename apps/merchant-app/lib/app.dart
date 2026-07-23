import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "core/auth/auth_controller.dart";
import "core/push/push_service.dart";
import "core/router/app_router.dart";
import "core/theme/brand_theme.dart";
import "core/theme/theme.dart";

/// Root widget: MaterialApp.router wired to the auth-guarded go_router, themed
/// by the shared design system (AppTheme) with a system-driven light/dark mode.
class MerchantApp extends ConsumerWidget {
  const MerchantApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);

    // White-label accent (P2): resolve the merchant's optional brand accent and
    // build the themes from the brand-adjusted token set. `applyBrandAccent`
    // returns the base UNCHANGED when the accent is null, so a store without a
    // custom brand is pixel-identical to the ember default.
    final brand = ref.watch(brandProvider);

    // Push lifecycle, driven off the auth state machine (minimal, additive —
    // the auth controller is untouched). Register the device when the merchant
    // signs in; unregister on sign-out. Both are guarded no-ops until Firebase
    // config lands, so this is safe to ship dormant.
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (previous?.status == next.status) return;
      final push = ref.read(pushServiceProvider);
      if (next.status == AuthStatus.signedIn) {
        push.registerDevice();
      } else if (next.status == AuthStatus.signedOut) {
        push.unregister();
      }
    });

    return MaterialApp.router(
      title: "mAutomate",
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(applyBrandAccent(AppColors.light, brand.accent)),
      darkTheme: AppTheme.dark(applyBrandAccent(AppColors.dark, brand.accent)),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
