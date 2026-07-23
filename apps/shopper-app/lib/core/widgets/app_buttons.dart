import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// Button size variants. [medium] is the default 48dp CTA height; [small] is a
/// compact 44dp control for dense toolbars (still above the tap-target floor).
enum AppButtonSize { medium, small }

/// Shared button behaviour: pressed/disabled/loading states, haptics, an
/// optional leading [icon], and a non-jumping loading spinner. Not exported —
/// use [PrimaryButton], [SecondaryButton] or [GhostButton].
class _AppButton extends StatefulWidget {
  const _AppButton({
    required this.label,
    required this.onPressed,
    required this.background,
    required this.pressedBackground,
    required this.foreground,
    required this.disabledBackground,
    required this.disabledForeground,
    required this.border,
    required this.icon,
    required this.isLoading,
    required this.fullWidth,
    required this.size,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color background;
  final Color pressedBackground;
  final Color foreground;
  final Color disabledBackground;
  final Color disabledForeground;
  final Color? border;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final AppButtonSize size;

  @override
  State<_AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<_AppButton> {
  bool _pressed = false;

  bool get _enabled => widget.onPressed != null && !widget.isLoading;

  double get _height => widget.size == AppButtonSize.medium ? 48 : 44;

  void _handleTap() {
    HapticFeedback.lightImpact();
    widget.onPressed!.call();
  }

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.labelLarge;
    final bg = !_enabled
        ? widget.disabledBackground
        : (_pressed ? widget.pressedBackground : widget.background);
    final fg = _enabled ? widget.foreground : widget.disabledForeground;
    final borderColor = widget.border == null
        ? null
        : (_enabled ? widget.border : widget.border!.withValues(alpha: 0.5));

    final content = widget.isLoading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 18, color: fg),
                const Gap(AppSpacing.sm),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textStyle?.copyWith(color: fg),
                ),
              ),
            ],
          );

    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: _enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: _enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel:
            _enabled ? () => setState(() => _pressed = false) : null,
        onTap: _enabled ? _handleTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          height: _height,
          width: widget.fullWidth ? double.infinity : null,
          constraints: const BoxConstraints(minWidth: 64),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: AppRadius.mdAll,
            border: borderColor != null
                ? Border.all(color: borderColor)
                : null,
          ),
          child: content,
        ),
      ),
    );
  }
}

/// The primary call-to-action — a solid ink fill ("ink is for action").
///
/// Use ONE per view for the main affirmative action (Save, Fulfil, Continue).
/// Fires [HapticFeedback.lightImpact] on tap. Pass `onPressed: null` to
/// disable; pass `isLoading: true` to show an inline spinner (also disables).
///
/// ```dart
/// PrimaryButton(label: "Fulfil order", icon: PhosphorIcons.package(),
///   onPressed: _fulfil, isLoading: state.isSaving, fullWidth: true)
/// ```
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.fullWidth = false,
    this.size = AppButtonSize.medium,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final AppButtonSize size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return _AppButton(
      label: label,
      onPressed: onPressed,
      background: c.primary,
      pressedBackground: Color.alphaBlend(c.overlay, c.primary),
      foreground: c.onPrimary,
      disabledBackground: c.surfaceMuted,
      disabledForeground: c.textDisabled,
      border: null,
      icon: icon,
      isLoading: isLoading,
      fullWidth: fullWidth,
      size: size,
    );
  }
}

/// A secondary, outlined action — surface fill with a hairline border. Use for
/// alternative or lower-emphasis actions that sit beside a [PrimaryButton].
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.fullWidth = false,
    this.size = AppButtonSize.medium,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final AppButtonSize size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return _AppButton(
      label: label,
      onPressed: onPressed,
      background: c.surface,
      pressedBackground: c.surfaceMuted,
      foreground: c.textPrimary,
      disabledBackground: c.surface,
      disabledForeground: c.textDisabled,
      border: c.borderStrong,
      icon: icon,
      isLoading: isLoading,
      fullWidth: fullWidth,
      size: size,
    );
  }
}

/// The lowest-emphasis action — transparent, no border. Use for tertiary
/// actions (Cancel, Skip, Dismiss) or inline text-like actions.
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.fullWidth = false,
    this.size = AppButtonSize.medium,
    this.destructive = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final AppButtonSize size;

  /// Tints the label with the danger colour for destructive tertiary actions.
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fg = destructive ? c.danger : c.textSecondary;
    return _AppButton(
      label: label,
      onPressed: onPressed,
      background: Colors.transparent,
      pressedBackground: c.surfaceMuted,
      foreground: fg,
      disabledBackground: Colors.transparent,
      disabledForeground: c.textDisabled,
      border: null,
      icon: icon,
      isLoading: isLoading,
      fullWidth: fullWidth,
      size: size,
    );
  }
}
