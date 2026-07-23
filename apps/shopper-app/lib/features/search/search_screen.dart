import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../catalog/catalog_list_controller.dart";
import "../catalog/product_grid_view.dart";

/// The search screen: a debounced product search over the store catalog.
///
/// Seeded from the route's `?q=` ([initialQuery]). Typing debounces (350ms)
/// into a [CatalogQuery] search, whose results render in the shared
/// [ProductGridView]. Empty query shows an idle prompt; a query with no matches
/// shows the grid's designed empty state.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialQuery});

  /// Optional query seeded from the `?q=` param on the route.
  final String? initialQuery;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _textController;
  Timer? _debounce;
  String _submitted = "";

  @override
  void initState() {
    super.initState();
    _submitted = (widget.initialQuery ?? "").trim();
    _textController = TextEditingController(text: _submitted);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _textController.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      final next = value.trim();
      if (next != _submitted) setState(() => _submitted = next);
    });
  }

  void _clear() {
    _debounce?.cancel();
    _textController.clear();
    setState(() => _submitted = "");
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final hasQuery = _submitted.isNotEmpty;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: AppSpacing.lg),
          child: TextField(
            controller: _textController,
            autofocus: !hasQuery,
            textInputAction: TextInputAction.search,
            onChanged: _onChanged,
            onSubmitted: (v) {
              _debounce?.cancel();
              setState(() => _submitted = v.trim());
            },
            decoration: InputDecoration(
              hintText: "Search products",
              filled: true,
              fillColor: c.surfaceInset,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              prefixIcon: Icon(
                PhosphorIcons.magnifyingGlass(),
                size: 18,
                color: c.textMuted,
              ),
              suffixIcon: _textController.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: "Clear search",
                      icon: Icon(PhosphorIcons.x(), size: 16, color: c.textMuted),
                      onPressed: _clear,
                    ),
              border: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: c.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: c.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: c.accent),
              ),
            ),
          ),
        ),
      ),
      body: hasQuery ? _results(context) : _idle(context),
    );
  }

  Widget _results(BuildContext context) {
    final query = CatalogQuery(search: _submitted);
    final state = ref.watch(catalogListControllerProvider(query));
    final controller =
        ref.read(catalogListControllerProvider(query).notifier);
    return ProductGridView(
      state: state,
      onRefresh: controller.refresh,
      onLoadMore: controller.loadMore,
      onRetry: controller.loadInitial,
      emptyTitle: "No results",
      emptyMessage: 'We couldn\'t find anything for "$_submitted".',
      emptyIcon: PhosphorIcons.magnifyingGlass(),
    );
  }

  Widget _idle(BuildContext context) {
    return EmptyState(
      icon: PhosphorIcons.magnifyingGlass(),
      title: "Search the store",
      message: "Find products by name, brand, or keyword.",
    );
  }
}
