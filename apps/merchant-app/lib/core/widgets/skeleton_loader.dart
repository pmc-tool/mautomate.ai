import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// Slides a shimmer gradient horizontally across the masked area.
class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform(this.slide);

  final double slide;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * slide, 0, 0);
  }
}

/// Wraps children in an animated shimmer sweep. Prefer the higher-level
/// [SkeletonLoader] / [SkeletonList]; use [Shimmer] directly only to shimmer a
/// bespoke placeholder layout you build from [SkeletonBox]es.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              colors: [
                c.skeletonBase,
                c.skeletonHighlight,
                c.skeletonBase,
              ],
              stops: const [0.35, 0.5, 0.65],
              transform: _SlidingGradientTransform(
                -1.5 + (_controller.value * 3.0),
              ),
            ).createShader(bounds);
          },
          child: child,
        );
      },
    );
  }
}

/// A single solid placeholder block (no animation of its own — sits under a
/// [Shimmer]). Use to compose custom skeletons.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 12,
    this.borderRadius,
    this.shape = BoxShape.rectangle,
  });

  final double? width;
  final double height;
  final BorderRadius? borderRadius;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      width: width,
      height: shape == BoxShape.circle ? height : height,
      decoration: BoxDecoration(
        color: c.skeletonBase,
        shape: shape,
        borderRadius: shape == BoxShape.circle
            ? null
            : (borderRadius ?? AppRadius.smAll),
      ),
    );
  }
}

/// A shimmering placeholder box for a single loading element (a value, a chip,
/// a thumbnail). Animated on its own.
///
/// ```dart
/// SkeletonLoader(width: 120, height: 20)                    // a line
/// SkeletonLoader(width: 48, height: 48, shape: BoxShape.circle) // avatar
/// ```
class SkeletonLoader extends StatelessWidget {
  const SkeletonLoader({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius,
    this.shape = BoxShape.rectangle,
  });

  final double? width;
  final double height;
  final BorderRadius? borderRadius;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: SkeletonBox(
        width: width,
        height: height,
        borderRadius: borderRadius,
        shape: shape,
      ),
    );
  }
}

/// A shimmering list placeholder — the standard loading state for any list
/// screen. Renders [itemCount] rows, each a leading tile + two text lines,
/// under one shared shimmer. Use this instead of a bare spinner while a list
/// loads.
///
/// ```dart
/// state.when(
///   loading: () => const SkeletonList(),
///   error: (e, _) => ErrorStateView(message: "$e", onRetry: refresh),
///   data: (orders) => ListView(...),
/// )
/// ```
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    this.itemCount = 6,
    this.showLeading = true,
    this.padding = AppSpacing.screen,
  });

  /// Number of placeholder rows.
  final int itemCount;

  /// Whether each row shows a leading square (thumbnail/icon) placeholder.
  final bool showLeading;

  /// Outer padding around the list.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Padding(
        padding: padding,
        child: Column(
          children: List.generate(itemCount, (i) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: i == itemCount - 1 ? 0 : AppSpacing.lg,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (showLeading) ...[
                    const SkeletonBox(
                      width: 44,
                      height: 44,
                      borderRadius: AppRadius.smAll,
                    ),
                    const Gap(AppSpacing.md),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(
                          width: (i.isEven ? 180 : 140).toDouble(),
                          height: 14,
                        ),
                        const Gap(AppSpacing.sm),
                        SkeletonBox(
                          width: (i.isEven ? 110 : 90).toDouble(),
                          height: 12,
                        ),
                      ],
                    ),
                  ),
                  const Gap(AppSpacing.md),
                  const SkeletonBox(width: 56, height: 22),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }
}
