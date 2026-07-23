import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The base surface primitive — a bordered, rounded card on [AppColors.surface].
///
/// Mirrors the web `SectionCard` shell (rounded-large, hairline border, white
/// fill). Every grouped block of content sits in an [AppCard] so surfaces read
/// as one material. Pass [onTap] to make the whole card a pressable target
/// (adds an ink ripple + light haptic).
///
/// ```dart
/// AppCard(
///   onTap: () => context.go("/orders/$id"),
///   child: Column(children: [...]),
/// )
/// ```
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = AppSpacing.card,
    this.onTap,
    this.color,
    this.borderColor,
    this.elevated = false,
    this.clip = false,
  });

  /// The card's contents.
  final Widget child;

  /// Interior padding. Defaults to 16 on all sides; pass `EdgeInsets.zero`
  /// for edge-to-edge content (e.g. a list inside the card).
  final EdgeInsetsGeometry padding;

  /// Makes the whole card tappable. When null, the card is static.
  final VoidCallback? onTap;

  /// Overrides the surface fill.
  final Color? color;

  /// Overrides the border colour.
  final Color? borderColor;

  /// When true, adds a soft ambient shadow for a floating card.
  final bool elevated;

  /// Clip the child to the rounded corners (needed when the child paints to
  /// the edge, e.g. an image header).
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final decoration = BoxDecoration(
      color: color ?? c.surface,
      borderRadius: AppRadius.lgAll,
      border: Border.all(color: borderColor ?? c.border),
      boxShadow: elevated
          ? [
              BoxShadow(
                color: c.shadow,
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ]
          : null,
    );

    final content = Padding(padding: padding, child: child);

    if (onTap == null) {
      return DecoratedBox(
        decoration: decoration,
        child: clip
            ? ClipRRect(borderRadius: AppRadius.lgAll, child: content)
            : content,
      );
    }

    return Material(
      color: Colors.transparent,
      child: Ink(
        decoration: decoration,
        child: InkWell(
          borderRadius: AppRadius.lgAll,
          splashColor: c.accent.withValues(alpha: 0.06),
          highlightColor: c.accent.withValues(alpha: 0.03),
          onTap: () {
            HapticFeedback.selectionClick();
            onTap!.call();
          },
          child: content,
        ),
      ),
    );
  }
}
