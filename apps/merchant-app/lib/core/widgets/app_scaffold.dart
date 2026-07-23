import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// The standard screen chrome: a consistent app bar, safe-area-aware body, and
/// optional bottom navigation / FAB / pull-to-refresh.
///
/// Every feature screen builds on [AppScaffold] so titles, back buttons,
/// padding and refresh behaviour stay uniform. It reads colours from the theme
/// (never hardcode a bar colour) and keeps the body clear of notches and the
/// home indicator.
///
/// ```dart
/// AppScaffold(
///   title: "Orders",
///   actions: [IconButton(icon: Icon(PhosphorIcons.funnel()), onPressed: _filter)],
///   onRefresh: controller.refresh,
///   body: OrdersList(...),
/// )
/// ```
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.body,
    this.title,
    this.titleWidget,
    this.actions,
    this.leading,
    this.automaticallyImplyLeading = true,
    this.centerTitle = false,
    this.bottom,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.onRefresh,
    this.showAppBar = true,
    this.safeAreaTop = false,
    this.safeAreaBottom = true,
    this.backgroundColor,
    this.resizeToAvoidBottomInset,
  });

  /// The screen content.
  final Widget body;

  /// Convenience title string. Ignored if [titleWidget] is provided.
  final String? title;

  /// Fully custom title widget (e.g. a search field).
  final Widget? titleWidget;

  /// App bar trailing actions.
  final List<Widget>? actions;

  /// App bar leading widget (overrides the automatic back button).
  final Widget? leading;

  /// Whether to auto-insert a back button when a route can pop.
  final bool automaticallyImplyLeading;

  /// Whether to centre the title.
  final bool centerTitle;

  /// A widget below the app bar (e.g. a [TabBar]).
  final PreferredSizeWidget? bottom;

  /// Optional bottom navigation bar.
  final Widget? bottomNavigationBar;

  /// Optional floating action button.
  final Widget? floatingActionButton;

  /// FAB placement.
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  /// When provided, wraps the body in a pull-to-refresh. The callback must
  /// return a future that completes when the refresh is done.
  final Future<void> Function()? onRefresh;

  /// Whether to render the app bar. Set false for fully custom headers.
  final bool showAppBar;

  /// Apply top safe-area inset to the body (usually false — the app bar
  /// already handles the top inset).
  final bool safeAreaTop;

  /// Apply bottom safe-area inset to the body.
  final bool safeAreaBottom;

  /// Override the scaffold background.
  final Color? backgroundColor;

  /// Passed through to [Scaffold.resizeToAvoidBottomInset].
  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    Widget content = body;
    if (onRefresh != null) {
      content = RefreshIndicator(
        onRefresh: onRefresh!,
        color: c.accent,
        backgroundColor: c.surface,
        child: content,
      );
    }

    content = SafeArea(
      top: safeAreaTop,
      bottom: safeAreaBottom,
      child: content,
    );

    return Scaffold(
      backgroundColor: backgroundColor ?? c.background,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      appBar: showAppBar
          ? AppBar(
              title: titleWidget ?? (title != null ? Text(title!) : null),
              actions: actions,
              leading: leading,
              automaticallyImplyLeading: automaticallyImplyLeading,
              centerTitle: centerTitle,
              bottom: bottom,
            )
          : null,
      body: content,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
    );
  }
}
