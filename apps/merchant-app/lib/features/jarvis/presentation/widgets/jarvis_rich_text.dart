import "package:flutter/material.dart";

import "../../../../core/theme/theme.dart";

/// A tiny, dependency-free Markdown-ish renderer for Jarvis replies.
///
/// Ports the web `RichText` (jarvis-panel.tsx): it builds real inline spans
/// (never raw HTML) and is deliberately forgiving — unbalanced input simply
/// falls through as plain text, so it never throws or dumps literal asterisks.
/// Handles inline **bold** / *italic* / `code`, `[label](http…)` links (shown
/// as accent-tinted label text), line breaks, and "- " / "* " bullet lists.
class JarvisRichText extends StatelessWidget {
  const JarvisRichText({
    super.key,
    required this.text,
    required this.baseStyle,
    this.accentColor,
    this.codeBackground,
  });

  final String text;
  final TextStyle baseStyle;
  final Color? accentColor;
  final Color? codeBackground;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? context.colors.accent;
    final codeBg = codeBackground ?? context.colors.surfaceMuted;
    if (text.isEmpty) return const SizedBox.shrink();

    List<Widget> blocks;
    try {
      blocks = _buildBlocks(text, accent, codeBg);
    } catch (_) {
      // Never dump raw markdown — strip markers, keep the words readable.
      blocks = [Text(_stripMarkers(text), style: baseStyle)];
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: blocks,
    );
  }

  List<Widget> _buildBlocks(String src, Color accent, Color codeBg) {
    final lines = src.split(RegExp(r"\r?\n"));
    final blocks = <Widget>[];
    var bullets = <Widget>[];

    void flushBullets() {
      if (bullets.isEmpty) return;
      blocks.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: bullets,
          ),
        ),
      );
      bullets = <Widget>[];
    }

    for (final line in lines) {
      final bullet = RegExp(r"^\s*[-*]\s+(.*)$").firstMatch(line);
      if (bullet != null) {
        bullets.add(_bulletRow(bullet.group(1) ?? "", accent, codeBg));
        continue;
      }
      flushBullets();
      if (line.trim().isEmpty) {
        blocks.add(const SizedBox(height: AppSpacing.sm));
        continue;
      }
      blocks.add(
        Text.rich(
          TextSpan(children: _inlineSpans(line, baseStyle, accent, codeBg)),
        ),
      );
    }
    flushBullets();
    return blocks;
  }

  Widget _bulletRow(String content, Color accent, Color codeBg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6, left: AppSpacing.xs),
            child: Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: baseStyle.color?.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
            ),
          ),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: _inlineSpans(content, baseStyle, accent, codeBg),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<InlineSpan> _inlineSpans(
    String src,
    TextStyle base,
    Color accent,
    Color codeBg,
  ) {
    if (src.isEmpty) return const [];
    try {
      final spans = <InlineSpan>[];
      // Order matters: **bold**/__bold__ before *italic*/_italic_ so a double
      // marker is never mis-split. A lone marker has no partner and is emitted
      // verbatim as text.
      final re = RegExp(
        r"(\*\*|__)([\s\S]+?)\1|(\*|_)([\s\S]+?)\3|`([^`]+?)`|\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)",
      );
      var last = 0;
      for (final m in re.allMatches(src)) {
        if (m.start > last) spans.add(TextSpan(text: src.substring(last, m.start)));
        if (m.group(1) != null) {
          spans.add(
            TextSpan(
              children: _inlineSpans(
                m.group(2) ?? "",
                base.copyWith(fontWeight: FontWeight.w700),
                accent,
                codeBg,
              ),
            ),
          );
        } else if (m.group(3) != null) {
          spans.add(
            TextSpan(
              children: _inlineSpans(
                m.group(4) ?? "",
                base.copyWith(fontStyle: FontStyle.italic),
                accent,
                codeBg,
              ),
            ),
          );
        } else if (m.group(5) != null) {
          spans.add(
            TextSpan(
              text: m.group(5),
              style: base.copyWith(
                fontFamily: "monospace",
                fontSize: (base.fontSize ?? 14) * 0.92,
                backgroundColor: codeBg,
              ),
            ),
          );
        } else if (m.group(6) != null) {
          spans.add(
            TextSpan(
              text: m.group(6),
              style: base.copyWith(
                color: accent,
                decoration: TextDecoration.underline,
                decorationColor: accent,
              ),
            ),
          );
        }
        last = m.end;
      }
      if (last < src.length) spans.add(TextSpan(text: src.substring(last)));
      return [
        TextSpan(style: base, children: spans),
      ];
    } catch (_) {
      return [TextSpan(text: _stripMarkers(src), style: base)];
    }
  }

  static String _stripMarkers(String input) {
    return input
        .replaceAllMapped(
          RegExp(r"\[([^\]]+?)\]\((?:https?:\/\/[^)\s]+)\)"),
          (m) => m.group(1) ?? "",
        )
        .replaceAll(RegExp(r"^#{1,6}\s+", multiLine: true), "")
        .replaceAll(RegExp(r"[*_`]"), "");
  }
}
