import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_data.dart";

/// Renderer for `testimonials` — customer quote cards.
///
/// Shape (backend `modules/cms/registry/testimonials.ts`):
/// ```
/// { title?, items:[ { quote, author, role?, avatar? } ] }
/// ```
Widget testimonialsBlock(BuildContext context, BlockData data) {
  final items = data.maps("items");
  final title = data.str("title");
  if (items.isEmpty) return const SizedBox.shrink();

  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Padding(
            padding: AppSpacing.screenH,
            child: Text(title, style: text.titleLarge),
          ),
          const Gap(AppSpacing.lg),
        ],
        SizedBox(
          height: 210,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: AppSpacing.screenH,
            itemCount: items.length,
            separatorBuilder: (_, __) => const Gap(AppSpacing.md),
            itemBuilder: (_, i) => _TestimonialCard(
              item: items[i],
              avatarUrl: data.resolve(items[i]["avatar"] as String?),
            ),
          ),
        ),
      ],
    ),
  );
}

class _TestimonialCard extends StatelessWidget {
  const _TestimonialCard({required this.item, required this.avatarUrl});

  final Map<String, dynamic> item;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final quote = (item["quote"] as String?)?.trim();
    final author = (item["author"] as String?)?.trim();
    final role = (item["role"] as String?)?.trim();

    return Container(
      width: 280,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.quotes(PhosphorIconsStyle.fill),
              color: c.accent, size: 22),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              quote ?? "",
              style: text.bodyMedium?.copyWith(color: c.textPrimary, height: 1.4),
              maxLines: 5,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const Gap(AppSpacing.md),
          Row(
            children: [
              _Avatar(url: avatarUrl, label: author),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (author != null)
                      Text(
                        author,
                        style: text.labelLarge
                            ?.copyWith(color: c.textPrimary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (role != null)
                      Text(
                        role,
                        style: text.labelSmall
                            ?.copyWith(color: c.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.label});

  final String? url;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const size = 36.0;
    if (url == null || url!.isEmpty) {
      final initial = (label ?? "").trim();
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: c.accentTint, shape: BoxShape.circle),
        child: Text(
          initial.isNotEmpty ? initial.characters.first.toUpperCase() : "?",
          style: Theme.of(context)
              .textTheme
              .labelLarge
              ?.copyWith(color: c.accent, fontWeight: FontWeight.w700),
        ),
      );
    }
    return ClipOval(
      child: StoreImage(url: url, width: size, height: size, fit: BoxFit.cover),
    );
  }
}
