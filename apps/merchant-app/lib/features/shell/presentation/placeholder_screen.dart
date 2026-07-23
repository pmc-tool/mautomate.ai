import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

/// A tidy, on-brand "coming soon" placeholder for a not-yet-built tab. The
/// routes + bottom nav are wired now; feature agents replace each screen's
/// body. Not a bare spinner — it states what the tab is and that it is coming.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.blurb,
  });

  final String title;
  final IconData icon;
  final String blurb;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                title,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                blurb,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 20),
              Chip(
                avatar: Icon(
                  PhosphorIconsRegular.wrench,
                  size: 16,
                  color: theme.colorScheme.secondary,
                ),
                label: const Text("Coming soon"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
