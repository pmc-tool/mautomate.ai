import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "chrome_controller.dart";
import "store_chrome.dart";

/// The announcement strip drawn ABOVE the store header when the store has a
/// topbar configured (`chrome.topbar`). Themed on the brand accent so the store
/// identity reads at the very top of every page. Renders nothing when there is
/// no enabled topbar with content.
class StoreTopbar extends ConsumerWidget {
  const StoreTopbar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topbar = ref.watch(
      storeChromeProvider.select((c) => c.topbar),
    );
    if (topbar == null || !topbar.hasContent) return const SizedBox.shrink();

    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final onBar = c.onAccent;

    final trailingBits = <String>[
      if (topbar.languageLabel != null) topbar.languageLabel!,
      if (topbar.currencyLabel != null) topbar.currencyLabel!,
    ];

    return Material(
      color: c.accent,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            if (topbar.message != null)
              Expanded(
                child: Text(
                  topbar.message!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.labelMedium?.copyWith(color: onBar),
                ),
              )
            else
              const Spacer(),
            for (final link in topbar.links) ...[
              const Gap(AppSpacing.md),
              _TopbarLink(link: link, color: onBar),
            ],
            if (trailingBits.isNotEmpty) ...[
              const Gap(AppSpacing.md),
              Text(
                trailingBits.join("  ·  "),
                style: text.labelMedium?.copyWith(
                  color: onBar.withValues(alpha: 0.85),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TopbarLink extends StatelessWidget {
  const _TopbarLink({required this.link, required this.color});

  final ChromeLink link;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return InkWell(
      onTap: () => context.navigateToHref(link.href),
      child: Text(
        link.label,
        style: text.labelMedium?.copyWith(
          color: color,
          decoration: TextDecoration.underline,
          decorationColor: color.withValues(alpha: 0.6),
        ),
      ),
    );
  }
}
