import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../chrome/categories_repository.dart";
import "catalog_list_controller.dart";

/// A pinned sort + (optional) category-filter bar shown above a [ProductGridView].
///
/// The sort button opens a bottom sheet of [CatalogSort] options; the filter
/// button (shown only when [categories] is non-null) opens a sheet of top-level
/// categories with an "All" reset. Selecting either calls back so the screen can
/// rebuild its [CatalogQuery].
class CatalogControlsBar extends StatelessWidget {
  const CatalogControlsBar({
    super.key,
    required this.sort,
    required this.onSortChanged,
    this.categories,
    this.selectedCategoryId,
    this.onCategoryChanged,
    this.resultLabel,
  });

  final CatalogSort sort;
  final ValueChanged<CatalogSort> onSortChanged;

  /// When non-null, a category filter button is shown backed by these.
  final List<StoreCategory>? categories;
  final String? selectedCategoryId;
  final ValueChanged<String?>? onCategoryChanged;

  /// Optional trailing label (e.g. "128 items").
  final String? resultLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final showFilter = categories != null && onCategoryChanged != null;
    final selectedCategory = showFilter
        ? categories!.cast<StoreCategory?>().firstWhere(
              (cat) => cat?.id == selectedCategoryId,
              orElse: () => null,
            )
        : null;

    return Container(
      decoration: BoxDecoration(
        color: c.background,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          _ControlChip(
            icon: sort.icon,
            label: sort.label,
            onTap: () => _openSortSheet(context),
          ),
          if (showFilter) ...[
            const Gap(AppSpacing.sm),
            _ControlChip(
              icon: PhosphorIcons.funnel(),
              label: selectedCategory?.name ?? "All categories",
              active: selectedCategoryId != null,
              onTap: () => _openCategorySheet(context),
            ),
          ],
          const Spacer(),
          if (resultLabel != null)
            Text(
              resultLabel!,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textMuted),
            ),
        ],
      ),
    );
  }

  Future<void> _openSortSheet(BuildContext context) async {
    final picked = await _showSheet<CatalogSort>(
      context,
      title: "Sort by",
      items: [
        for (final s in CatalogSort.values)
          _SheetItem(
            value: s,
            label: s.label,
            icon: s.icon,
            selected: s == sort,
          ),
      ],
    );
    if (picked != null) onSortChanged(picked);
  }

  Future<void> _openCategorySheet(BuildContext context) async {
    final result = await _showSheet<String>(
      context,
      title: "Filter by category",
      items: [
        _SheetItem(
          value: "",
          label: "All categories",
          icon: PhosphorIcons.squaresFour(),
          selected: selectedCategoryId == null,
        ),
        for (final cat in categories!)
          _SheetItem(
            value: cat.id,
            label: cat.name,
            icon: PhosphorIcons.tag(),
            selected: cat.id == selectedCategoryId,
          ),
      ],
    );
    if (result == null) return;
    onCategoryChanged!(result.isEmpty ? null : result);
  }
}

class _ControlChip extends StatelessWidget {
  const _ControlChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: active ? c.accentTint : c.surfaceMuted,
      borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: active ? c.accent : c.textSecondary),
              const Gap(AppSpacing.xs),
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: active ? c.accent : c.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const Gap(AppSpacing.xxs),
              Icon(
                PhosphorIcons.caretDown(),
                size: 12,
                color: active ? c.accent : c.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetItem<T> {
  const _SheetItem({
    required this.value,
    required this.label,
    required this.icon,
    required this.selected,
  });

  final T value;
  final String label;
  final IconData icon;
  final bool selected;
}

Future<T?> _showSheet<T>(
  BuildContext context, {
  required String title,
  required List<_SheetItem<T>> items,
}) {
  final c = context.colors;
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: c.surface,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
    ),
    builder: (context) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                children: [
                  for (final item in items)
                    ListTile(
                      leading: Icon(
                        item.icon,
                        color: item.selected ? c.accent : c.textSecondary,
                      ),
                      title: Text(
                        item.label,
                        style: TextStyle(
                          color: item.selected ? c.accent : c.textPrimary,
                          fontWeight:
                              item.selected ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                      trailing: item.selected
                          ? Icon(PhosphorIcons.check(), color: c.accent, size: 18)
                          : null,
                      onTap: () => Navigator.of(context).pop(item.value),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    },
  );
}
