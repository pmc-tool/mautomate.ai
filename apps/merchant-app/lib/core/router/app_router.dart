import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../auth/auth_controller.dart";
import "../../features/auth/presentation/login_screen.dart";
import "../../features/auth/presentation/mfa_screen.dart";
import "../../features/home/presentation/home_screen.dart";
import "../../features/orders/presentation/orders_screen.dart";
import "../../features/products/presentation/products_screen.dart";
import "../../features/jarvis/presentation/jarvis_screen.dart";
import "../../features/more/presentation/more_screen.dart";
import "../../features/inbox/presentation/inbox_screen.dart";
import "../../features/insights/presentation/insights_screen.dart";
import "../../features/setup/presentation/setup_screen.dart";
import "../../features/marketing/presentation/marketing_screen.dart";
import "../../features/ads/presentation/ads_screen.dart";
import "../../features/callcenter/presentation/call_center_screen.dart";
import "../../features/domains/presentation/domains_screen.dart";
import "../../features/settings/presentation/settings_screen.dart";
import "../../features/billing/presentation/billing_screen.dart";
import "../../features/shell/presentation/app_shell.dart";
import "../../features/shell/presentation/splash_screen.dart";

/// The auth-guarded router. Redirects follow the [AuthStatus] state machine:
///  - loading   -> splash ("/")
///  - signedOut -> "/login"
///  - mfa       -> "/mfa"
///  - signedIn  -> the app shell ("/home" default), with a bottom nav for
///                 Home / Orders / Products / Jarvis / More.
///
/// The five bottom-nav tabs are branches of a [StatefulShellRoute] so each
/// keeps its own stack. Every secondary surface reached from the More hub
/// (inbox, insights, setup, marketing, ads, call center, domains, settings,
/// billing) is a top-level route pushed OVER the shell: it opens full-screen
/// with a back button, and each has a stable path + screen class so feature
/// engineers can replace the destination in place without editing this file.
///
/// Deep-link ready: an authed link to /orders or /billing (etc.) is honoured;
/// an unauthenticated deep link is bounced to /login and resumes after
/// sign-in.
final goRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefreshListenable(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: "/",
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider).status;
      final loc = state.matchedLocation;
      final atSplash = loc == "/";
      final atLogin = loc == "/login";
      final atMfa = loc == "/mfa";

      switch (status) {
        case AuthStatus.loading:
          return atSplash ? null : "/";
        case AuthStatus.signedOut:
          return atLogin ? null : "/login";
        case AuthStatus.mfa:
          return atMfa ? null : "/mfa";
        case AuthStatus.signedIn:
          if (atSplash || atLogin || atMfa) return "/home";
          return null;
      }
    },
    routes: [
      GoRoute(path: "/", builder: (_, __) => const SplashScreen()),
      GoRoute(path: "/login", builder: (_, __) => const LoginScreen()),
      GoRoute(path: "/mfa", builder: (_, __) => const MfaScreen()),

      // Secondary surfaces — pushed full-screen over the shell from the More
      // hub. Each is a stable placeholder a feature engineer replaces in place.
      GoRoute(path: "/inbox", builder: (_, __) => const InboxScreen()),
      GoRoute(path: "/insights", builder: (_, __) => const InsightsScreen()),
      GoRoute(path: "/setup", builder: (_, __) => const SetupScreen()),
      GoRoute(path: "/marketing", builder: (_, __) => const MarketingScreen()),
      GoRoute(path: "/ads", builder: (_, __) => const AdsScreen()),
      GoRoute(
        path: "/callcenter",
        builder: (_, __) => const CallCenterScreen(),
      ),
      GoRoute(path: "/domains", builder: (_, __) => const DomainsScreen()),
      GoRoute(path: "/settings", builder: (_, __) => const SettingsScreen()),
      GoRoute(path: "/billing", builder: (_, __) => const BillingScreen()),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/home", builder: (_, __) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/orders", builder: (_, __) => const OrdersScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: "/products",
                builder: (_, __) => const ProductsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/jarvis", builder: (_, __) => const JarvisScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/more", builder: (_, __) => const MoreScreen()),
            ],
          ),
        ],
      ),
    ],
  );
});

/// Bridges Riverpod auth-state changes to go_router's [Listenable]-based
/// refresh, so a redirect re-runs whenever [AuthStatus] changes.
class _AuthRefreshListenable extends ChangeNotifier {
  _AuthRefreshListenable(Ref ref) {
    _subscription = ref.listen<AuthState>(
      authControllerProvider,
      (previous, next) {
        if (previous?.status != next.status) notifyListeners();
      },
    );
  }

  late final ProviderSubscription<AuthState> _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
