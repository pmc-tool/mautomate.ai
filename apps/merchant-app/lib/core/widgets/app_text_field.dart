import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The standard text input — a labelled [TextFormField] wired to the app's
/// [InputDecorationTheme], with an optional prefix icon, password reveal
/// toggle, helper/error text, and a top-aligned label.
///
/// Use for every form field so inputs share one height, radius, focus ring and
/// error treatment. Works with `Form`/`validator` and with plain [onChanged].
///
/// ```dart
/// AppTextField(
///   label: "Email",
///   hint: "you@store.com",
///   prefixIcon: PhosphorIcons.envelope(),
///   keyboardType: TextInputType.emailAddress,
///   controller: _email,
///   validator: (v) => v!.contains("@") ? null : "Enter a valid email",
/// )
/// ```
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    this.label,
    this.hint,
    this.helperText,
    this.errorText,
    this.controller,
    this.initialValue,
    this.prefixIcon,
    this.suffix,
    this.obscure = false,
    this.enabled = true,
    this.readOnly = false,
    this.autofocus = false,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.validator,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.none,
  });

  /// Label rendered above the field.
  final String? label;

  /// Placeholder text inside the field.
  final String? hint;

  /// Persistent helper text below the field.
  final String? helperText;

  /// Error text below the field (overrides [helperText] and paints red). For
  /// `Form`-managed validation, prefer [validator].
  final String? errorText;

  final TextEditingController? controller;
  final String? initialValue;

  /// Leading icon.
  final IconData? prefixIcon;

  /// Trailing widget (ignored when [obscure] is true — the reveal toggle wins).
  final Widget? suffix;

  /// Password mode with a show/hide toggle.
  final bool obscure;

  final bool enabled;
  final bool readOnly;
  final bool autofocus;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final int maxLines;
  final int? minLines;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onTap;
  final FormFieldValidator<String>? validator;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _obscured = widget.obscure;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget? suffixIcon;
    if (widget.obscure) {
      suffixIcon = IconButton(
        icon: Icon(
          _obscured ? PhosphorIcons.eye() : PhosphorIcons.eyeSlash(),
          size: 20,
        ),
        color: c.textMuted,
        splashRadius: 20,
        tooltip: _obscured ? "Show" : "Hide",
        onPressed: () => setState(() => _obscured = !_obscured),
      );
    } else if (widget.suffix != null) {
      suffixIcon = widget.suffix;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: text.labelMedium?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.sm),
        ],
        TextFormField(
          controller: widget.controller,
          initialValue: widget.initialValue,
          enabled: widget.enabled,
          readOnly: widget.readOnly,
          autofocus: widget.autofocus,
          obscureText: _obscured,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          inputFormatters: widget.inputFormatters,
          maxLines: _obscured ? 1 : widget.maxLines,
          minLines: widget.minLines,
          maxLength: widget.maxLength,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onSubmitted,
          onTap: widget.onTap,
          validator: widget.validator,
          autofillHints: widget.autofillHints,
          textCapitalization: widget.textCapitalization,
          style: text.bodyMedium?.copyWith(color: c.textPrimary),
          cursorColor: c.accent,
          decoration: InputDecoration(
            hintText: widget.hint,
            helperText: widget.helperText,
            errorText: widget.errorText,
            counterText: "",
            prefixIcon: widget.prefixIcon != null
                ? Icon(widget.prefixIcon, size: 20)
                : null,
            suffixIcon: suffixIcon,
          ),
        ),
      ],
    );
  }
}
