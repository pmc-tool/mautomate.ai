import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/widgets/widgets.dart";

/// A titled placeholder screen for routes whose real UI lands in a later build.
///
/// Wave 2a stands up the full navigation shell + routing; the catalog, product,
/// cart, account and search SCREENS are Wave 2b. Each of those routes points at
/// a thin screen that renders this — so the app compiles and navigates cleanly
/// today, and Wave 2b replaces the individual screen bodies in place without
/// touching the router.
class ComingSoonScaffold extends StatelessWidget {
  const ComingSoonScaffold({
    super.key,
    required this.title,
    this.message = "This screen is coming in the next build.",
    this.icon,
    this.showBack = false,
  });

  /// The screen / app-bar title.
  final String title;

  /// Supporting line under the title.
  final String message;

  /// Optional glyph for the empty state.
  final IconData? icon;

  /// Whether this is a pushed detail screen (shows a back button) vs a shell
  /// tab (no back button).
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        title: Text(title),
        automaticallyImplyLeading: showBack,
      ),
      body: EmptyState(
        title: title,
        message: message,
        icon: icon ?? PhosphorIcons.hammer(),
      ),
    );
  }
}
