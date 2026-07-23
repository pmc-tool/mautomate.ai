import "package:flutter/material.dart";
import "package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../config/app_config.dart";
import "../../config/config_providers.dart";
import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/app_buttons.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

/// Renderer for `container` — a free-form column layout of atomic widgets.
///
/// Shape (backend `modules/cms/registry/container.ts`):
/// ```
/// { layout:"1".."4", gap?:{value,unit}, verticalAlign?:"top"|"center"|"bottom",
///   columns:[ { widgets: Widget[] } ] }
/// // Widget = { widget_type, ...contentProps }
/// ```
/// The widget vocabulary is owned by the storefront; this is the secondary
/// dispatch on `widget_type` (heading/text/image/button/spacer/divider/video/
/// icon/html). It is the LOWEST-priority block — permissive and defensive: an
/// unknown `widget_type` renders nothing, `html` is theme-styled, and `video`
/// degrades to a tappable poster (no arbitrary embed).
Widget containerBlock(BuildContext context, BlockData data) =>
    _ContainerBlock(data: data);

class _ContainerBlock extends ConsumerWidget {
  const _ContainerBlock({required this.data});

  final BlockData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final columns = data.maps("columns");
    if (columns.isEmpty) return const SizedBox.shrink();

    final gapObj = data.object("gap");
    final gapValue = gapObj["value"];
    final gap = (gapValue is num ? gapValue.toDouble() : AppSpacing.lg)
        .clamp(0, 48)
        .toDouble();

    final align = switch (data.strOr("verticalAlign", "top")) {
      "center" => CrossAxisAlignment.center,
      "bottom" => CrossAxisAlignment.end,
      _ => CrossAxisAlignment.start,
    };

    final columnWidgets = <Widget>[
      for (final col in columns)
        _buildColumn(context, config, col, gap),
    ];

    final body = columnWidgets.length == 1
        ? columnWidgets.first
        : Row(
            crossAxisAlignment: align,
            children: [
              for (var i = 0; i < columnWidgets.length; i++) ...[
                if (i > 0) SizedBox(width: gap),
                Expanded(child: columnWidgets[i]),
              ],
            ],
          );

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      child: body,
    );
  }

  Widget _buildColumn(
    BuildContext context,
    AppConfig config,
    Map<String, dynamic> col,
    double gap,
  ) {
    final widgets = col["widgets"];
    final list = widgets is List
        ? widgets.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
        : const <Map<String, dynamic>>[];

    final children = <Widget>[];
    for (final w in list) {
      final built = _buildWidget(context, config, w);
      if (built == null) continue;
      if (children.isNotEmpty) children.add(SizedBox(height: gap));
      children.add(built);
    }
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: children,
    );
  }

  /// Secondary dispatch: one atomic widget by its `widget_type`.
  Widget? _buildWidget(
    BuildContext context,
    AppConfig config,
    Map<String, dynamic> w,
  ) {
    final type = w["widget_type"];
    if (type is! String) return null;

    final c = context.colors;
    final text = Theme.of(context).textTheme;

    String? content() {
      for (final k in ["text", "content", "value", "label", "title"]) {
        final v = w[k];
        if (v is String && v.trim().isNotEmpty) return v.trim();
      }
      return null;
    }

    String? media() => config.resolveAsset(
          (w["image"] ?? w["src"] ?? w["url"]) is String
              ? (w["image"] ?? w["src"] ?? w["url"]) as String
              : null,
        );

    switch (type) {
      case "heading":
        final t = content();
        return t == null
            ? null
            : Text(
                t.replaceAll(r"\n", "\n"),
                style: text.headlineSmall?.copyWith(color: c.textPrimary),
              );
      case "text":
        final t = content();
        return t == null
            ? null
            : Text(
                t,
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              );
      case "html":
        final html = w["html"];
        return html is String && html.trim().isNotEmpty
            ? HtmlWidget(
                html,
                textStyle:
                    text.bodyMedium?.copyWith(color: c.textSecondary),
                onTapUrl: (url) {
                  handleBlockHref(context, url);
                  return true;
                },
                customWidgetBuilder: (element) {
                  const blocked = {"script", "style", "iframe", "object"};
                  return blocked.contains(element.localName)
                      ? const SizedBox.shrink()
                      : null;
                },
              )
            : null;
      case "image":
        final url = media();
        return url == null
            ? null
            : StoreImage(
                url: url,
                width: double.infinity,
                fit: BoxFit.cover,
                borderRadius: AppRadius.mdAll,
              );
      case "button":
        final label = content();
        return label == null
            ? null
            : PrimaryButton(
                label: label,
                onPressed: () =>
                    handleBlockHref(context, w["href"] as String?),
              );
      case "spacer":
        final h = w["height"];
        final height = h is num ? h.toDouble() : AppSpacing.lg;
        return SizedBox(height: height.clamp(0, 200).toDouble());
      case "divider":
        return Divider(color: c.border, height: 1);
      case "icon":
        return Icon(PhosphorIcons.star(), color: c.accent, size: 28);
      case "video":
        final poster = config.resolveAsset(
          w["poster"] is String ? w["poster"] as String : null,
        );
        return _VideoPlaceholder(
          poster: poster,
          onTap: () => handleBlockHref(
            context,
            (w["url"] ?? w["src"]) as String?,
          ),
        );
      default:
        return null;
    }
  }
}

class _VideoPlaceholder extends StatelessWidget {
  const _VideoPlaceholder({required this.poster, required this.onTap});

  final String? poster;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.mdAll,
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (poster != null)
                StoreImage(url: poster, fit: BoxFit.cover)
              else
                ColoredBox(color: c.surfaceMuted),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: const Color(0x88000000),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    PhosphorIcons.play(PhosphorIconsStyle.fill),
                    color: Colors.white,
                    size: 26,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
