import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";

/// A compact inline error banner for the auth screens. States what went wrong;
/// the message copy (from `ApiError`) also tells the merchant how to fix it.
/// Reads its colours from the shared design system (`context.colors`).
class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.dangerBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.dangerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIconsRegular.warning, size: 18, color: c.danger),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: text.bodySmall?.copyWith(color: c.danger),
            ),
          ),
        ],
      ),
    );
  }
}
