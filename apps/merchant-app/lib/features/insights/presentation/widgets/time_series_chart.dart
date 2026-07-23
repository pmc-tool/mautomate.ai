import "dart:ui" as ui;

import "package:flutter/material.dart";

import "package:mautomate_merchant/core/theme/theme.dart";

/// A lightweight, hand-drawn area/line chart for the revenue & orders series.
///
/// Deliberately a [CustomPaint] rather than a charting dependency: it stays
/// small, matches the design language exactly, and gives full control over the
/// three things the spec asks a chart to have — an **area fill**, a **faint
/// grid**, and an **emphasised endpoint**. It renders a single series; the
/// caller swaps the data + [color] to pivot between revenue and orders.
///
/// Degenerate inputs are handled: an empty or all-zero series draws a flat
/// baseline (no NaNs), and a single point draws a dot.
class TimeSeriesChart extends StatelessWidget {
  const TimeSeriesChart({
    super.key,
    required this.values,
    required this.color,
    this.height = 168,
  });

  /// The y-values in chronological order. The last entry is the endpoint that
  /// gets emphasised.
  final List<double> values;

  /// The line + fill hue (typically the cool data accent, `context.colors.cyan`).
  final Color color;

  /// Fixed drawing height.
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _TimeSeriesPainter(
          values: values,
          color: color,
          gridColor: c.border,
          endpointHalo: c.surface,
        ),
      ),
    );
  }
}

class _TimeSeriesPainter extends CustomPainter {
  _TimeSeriesPainter({
    required this.values,
    required this.color,
    required this.gridColor,
    required this.endpointHalo,
  });

  final List<double> values;
  final Color color;
  final Color gridColor;
  final Color endpointHalo;

  static const double _padTop = 10;
  static const double _padBottom = 10;
  static const double _padSide = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final chartW = size.width - _padSide * 2;
    final chartH = size.height - _padTop - _padBottom;
    if (chartW <= 0 || chartH <= 0) return;

    // ---- faint horizontal grid -----------------------------------------
    final gridPaint = Paint()
      ..color = gridColor.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    const rows = 3;
    for (var i = 0; i <= rows; i++) {
      final y = _padTop + chartH * (i / rows);
      canvas.drawLine(
        Offset(_padSide, y),
        Offset(size.width - _padSide, y),
        gridPaint,
      );
    }

    if (values.isEmpty) return;

    final maxV = values.fold<double>(0, (m, v) => v > m ? v : m);
    final safeMax = maxV <= 0 ? 1.0 : maxV;
    final n = values.length;
    final step = n > 1 ? chartW / (n - 1) : 0.0;

    Offset pointAt(int i) {
      final x = _padSide + (n > 1 ? i * step : chartW / 2);
      final y = _padTop + chartH - (values[i] / safeMax) * chartH;
      return Offset(x, y);
    }

    // A single point: just the emphasised dot.
    if (n == 1) {
      _drawEndpoint(canvas, pointAt(0));
      return;
    }

    final linePath = Path();
    final areaPath = Path();
    final baseline = _padTop + chartH;

    for (var i = 0; i < n; i++) {
      final p = pointAt(i);
      if (i == 0) {
        linePath.moveTo(p.dx, p.dy);
        areaPath.moveTo(p.dx, baseline);
        areaPath.lineTo(p.dx, p.dy);
      } else {
        linePath.lineTo(p.dx, p.dy);
        areaPath.lineTo(p.dx, p.dy);
      }
    }
    final last = pointAt(n - 1);
    areaPath.lineTo(last.dx, baseline);
    areaPath.close();

    // ---- area fill (top-weighted gradient) -----------------------------
    final fillPaint = Paint()
      ..shader = ui.Gradient.linear(
        Offset(0, _padTop),
        Offset(0, baseline),
        [color.withValues(alpha: 0.22), color.withValues(alpha: 0.0)],
      );
    canvas.drawPath(areaPath, fillPaint);

    // ---- line ----------------------------------------------------------
    final linePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(linePath, linePaint);

    // ---- emphasised endpoint -------------------------------------------
    _drawEndpoint(canvas, last);
  }

  void _drawEndpoint(Canvas canvas, Offset p) {
    // Soft glow, a halo ring the colour of the surface (so it reads as lifted),
    // then the solid dot.
    canvas.drawCircle(p, 8, Paint()..color = color.withValues(alpha: 0.16));
    canvas.drawCircle(p, 5, Paint()..color = endpointHalo);
    canvas.drawCircle(p, 3.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _TimeSeriesPainter old) =>
      old.values != values ||
      old.color != color ||
      old.gridColor != gridColor;
}
