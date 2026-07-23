import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/blocks/page_renderer.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../chrome/store_footer.dart";
import "../chrome/store_header.dart";
import "../chrome/store_menu_drawer.dart";
import "home_controller.dart";

/// The store home screen: fetches the store home page and renders its CMS/Puck
/// blocks natively via [PageRenderer], wrapped in the server-driven store chrome
/// — a pinned [StoreHeader] (announcement topbar + logo + search + cart badge)
/// at the top, a [StoreMenuDrawer] (with live category expansion), and a
/// [StoreFooter] at the end of the scroll (as the renderer's `trailing`).
///
/// This is the end-to-end proof of the engine — fetch page JSON, render native
/// blocks + chrome — with designed loading / error / empty states.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final async = ref.watch(homeControllerProvider);

    return Scaffold(
      backgroundColor: c.background,
      drawer: const StoreMenuDrawer(),
      body: Column(
        children: [
          const StoreHeader(),
          Expanded(
            child: async.when(
              loading: () => const _HomeLoading(),
              error: (err, _) => ErrorStateView(
                message: "$err",
                onRetry: () => ref.invalidate(homeControllerProvider),
              ),
              data: (load) {
                if (load.page.isEmpty) {
                  return const EmptyState(
                    title: "Nothing here yet",
                    message: "This store hasn't published a home page.",
                  );
                }
                return RefreshIndicator(
                  color: c.accent,
                  onRefresh: () async => ref.invalidate(homeControllerProvider),
                  child: PageRenderer(
                    page: load.page,
                    physics: const AlwaysScrollableScrollPhysics(),
                    trailing: const StoreFooter(),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeLoading extends StatelessWidget {
  const _HomeLoading();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Shimmer(
      child: ListView(
        padding: EdgeInsets.zero,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          Container(height: 300, color: c.skeletonBase),
          const Gap(AppSpacing.xl),
          const Padding(
            padding: AppSpacing.screenH,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 180, height: 20),
                Gap(AppSpacing.md),
                SkeletonBox(width: double.infinity, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: 240, height: 12),
              ],
            ),
          ),
          const Gap(AppSpacing.xxl),
          Padding(
            padding: AppSpacing.screenH,
            child: GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: AppSpacing.lg,
              crossAxisSpacing: AppSpacing.lg,
              childAspectRatio: 0.72,
              children: List.generate(
                4,
                (_) => Container(
                  decoration: BoxDecoration(
                    color: c.skeletonBase,
                    borderRadius: AppRadius.mdAll,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
