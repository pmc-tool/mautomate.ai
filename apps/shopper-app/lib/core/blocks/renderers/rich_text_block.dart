import "package:flutter/material.dart";
import "package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `rich_text` / `text` — free-form sanitized HTML content.
///
/// CMS `rich_text` shape (backend `modules/cms/registry/rich-text.ts`):
/// ```
/// { html: string, width?: "narrow"|"normal"|"wide"|"full" }
/// ```
/// Also accepts a generic Puck `text` block carrying a plain `text` prop.
///
/// Renders authored HTML natively with `flutter_widget_from_html_core` (a light
/// HTML widget: only `html` + `csslib` transitive deps): headings, paragraphs,
/// ordered/unordered lists, links, bold/italic/underline. All typography and
/// colours come from the theme so it reads correctly in light + dark. Links
/// route through the block navigation seam ([handleBlockHref]). `width` maps to
/// the responsive reading-column constraint.
///
/// The server already strips `<script>`/`<style>`/inline handlers; we also skip
/// rendering any `<script>`/`<style>`/`<iframe>` defensively.
Widget richTextBlock(BuildContext context, BlockData data) {
  final html = data.str("html");
  final plain = data.str("text");
  final source = html ?? (plain != null ? _escape(plain) : null);
  if (source == null) return const SizedBox.shrink();

  final width = data.strOr("width", "normal");
  final maxWidth = switch (width) {
    "narrow" => 520.0,
    "wide" => 900.0,
    "full" => double.infinity,
    _ => 720.0,
  };

  final c = context.colors;
  final text = Theme.of(context).textTheme;
  final baseStyle =
      text.bodyLarge?.copyWith(color: c.textSecondary, height: 1.5);

  return Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.lg,
      vertical: AppSpacing.xl,
    ),
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: HtmlWidget(
        source,
        textStyle: baseStyle,
        onTapUrl: (url) {
          handleBlockHref(context, url);
          return true;
        },
        // Theme headings + links; drop unsafe/interactive tags defensively.
        customStylesBuilder: (element) {
          switch (element.localName) {
            case "a":
              final hex = _hex(c.accent);
              return {"color": hex, "text-decoration": "none"};
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
              return {"color": _hex(c.textPrimary), "font-weight": "700"};
            default:
              return null;
          }
        },
        customWidgetBuilder: (element) {
          const blocked = {"script", "style", "iframe", "object", "embed"};
          if (blocked.contains(element.localName)) {
            return const SizedBox.shrink();
          }
          return null;
        },
      ),
    ),
  );
}

/// CSS hex (`#rrggbb`) for a [Color], for the HTML widget's style maps.
String _hex(Color color) {
  final argb = color.toARGB32();
  return "#${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}";
}

/// Escape a plain-text `text` prop so the HTML widget renders it verbatim.
String _escape(String s) => s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
