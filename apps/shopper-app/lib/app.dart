import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "core/notifications/deep_link_service.dart";
import "core/notifications/push_service.dart";
import "core/router/app_router.dart";
import "core/theme/theme.dart";
import "features/auth/auth_controller.dart";

/// Root widget: `MaterialApp.router` wired to the go_router, themed by the
/// shared design system (ported from the merchant app) with system light/dark.
///
/// The store's brand accent (resolved from the app-render `branding`/`design`
/// payload into [brandProvider]) is applied to BOTH themes via
/// [applyBrandAccent], so the whole app — buttons, inputs, nav — reflects the
/// store. A store with no custom accent is pixel-identical to the ember default.
///
/// This is a stateful consumer so it can, once the router exists, boot the
/// push + deep-link services (after the first frame) and re-sync the push token
/// with the customer session on sign-in / sign-out.
class ShopperApp extends ConsumerStatefulWidget {
  const ShopperApp({super.key});

  @override
  ConsumerState<ShopperApp> createState() => _ShopperAppState();
}

class _ShopperAppState extends ConsumerState<ShopperApp> {
  @override
  void initState() {
    super.initState();
    // After the first frame the router is mounted and can receive navigation.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Push registration + a cold-start notification tap.
      ref.read(pushServiceProvider).init();
      // OS deep links (App Links / Universal Links / custom scheme), cold + warm.
      ref.read(deepLinkServiceProvider).init();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final brand = ref.watch(brandProvider);

    // Re-associate the push token with the customer as the session changes.
    ref.listen<AsyncValue<dynamic>>(authControllerProvider, (prev, next) {
      final wasSignedIn = prev?.valueOrNull != null;
      final isSignedIn = next.valueOrNull != null;
      if (isSignedIn && !wasSignedIn) {
        ref.read(pushServiceProvider).syncWithSession();
      } else if (!isSignedIn && wasSignedIn) {
        ref.read(pushServiceProvider).onSignedOut();
      }
    });

    return MaterialApp.router(
      title: brand.storeName ?? "Store",
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(applyBrandAccent(AppColors.light, brand.accent)),
      darkTheme: AppTheme.dark(applyBrandAccent(AppColors.dark, brand.accent)),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
