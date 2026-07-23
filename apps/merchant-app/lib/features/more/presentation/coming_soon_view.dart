import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

/// The on-brand "this surface is on the way" body shared by every secondary
/// surface that is routed + navigable now but not yet built.
///
/// The routes and the More hub are wired today; a feature engineer replaces the
/// owning screen's body in place (the screen class name is stable) without
/// touching the router. This is a designed state — a titled [EmptyState] with a
/// clear promise and, where useful, a status chip — never a bare spinner.
///
/// Usage inside a placeholder screen:
/// ```dart
/// AppScaffold(
///   title: "Inbox",
///   body: ComingSoonView(
///     icon: PhosphorIconsRegular.tray,
///     title: "Inbox is coming soon",
///     message: "Reply to customers and hand conversations to Jarvis, right "
///         "from your phone.",
///   ),
/// )
/// ```
class ComingSoonView extends StatelessWidget {
  const ComingSoonView({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  /// Surface glyph, in the Phosphor family used app-wide.
  final IconData icon;

  /// What is coming (headline).
  final String title;

  /// One or two sentences: what the merchant will be able to do here.
  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return EmptyState(
      icon: icon,
      title: title,
      message: message,
      action: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: c.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsRegular.wrench, size: 15, color: c.textSecondary),
            const Gap(AppSpacing.xs),
            Text(
              "In development",
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: c.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
