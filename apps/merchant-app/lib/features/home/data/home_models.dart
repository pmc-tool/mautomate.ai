// Computed view-models for the Home dashboard — derived in the repository from
// the raw DTOs, so the screen renders pure data. Not parsed from JSON, so these
// stay hand-written (no codegen).
import "package:flutter/widgets.dart";

import "home_dtos.dart";

/// The headline numbers on Home, mirroring the web `OverviewStats`
/// (apps/storefront/src/lib/merchant-admin/api.ts → `fetchOverview`).
@immutable
class HomeStats {
  const HomeStats({
    required this.totalSales,
    required this.ordersThisMonth,
    required this.productsLive,
    required this.customers,
    required this.creditBalance,
    required this.currencyCode,
  });

  final num totalSales;
  final int ordersThisMonth;
  final int productsLive;
  final int customers;
  final num creditBalance;
  final String currencyCode;

  static const empty = HomeStats(
    totalSales: 0,
    ordersThisMonth: 0,
    productsLive: 0,
    customers: 0,
    creditBalance: 0,
    currencyCode: "USD",
  );
}

/// Visual weight of a "Needs attention" item — reuses the design system's
/// semantic tones (danger / warning / info).
enum AttentionTone { danger, warning, info }

/// One card on the "Needs attention" surface. [route] is a go_router path to
/// jump to when tapped; a null route renders the item as informational (no
/// chevron, not tappable) — honest about which destinations exist in the app.
@immutable
class AttentionItem {
  const AttentionItem({
    required this.id,
    required this.title,
    required this.detail,
    required this.icon,
    required this.tone,
    this.route,
    this.count,
  });

  final String id;
  final String title;
  final String detail;
  final IconData icon;
  final AttentionTone tone;
  final String? route;
  final int? count;
}

/// Everything the Home screen renders in one immutable snapshot.
@immutable
class HomeSnapshot {
  const HomeSnapshot({
    required this.stats,
    required this.recentOrders,
    required this.attention,
  });

  final HomeStats stats;
  final List<HomeOrder> recentOrders;
  final List<AttentionItem> attention;
}
