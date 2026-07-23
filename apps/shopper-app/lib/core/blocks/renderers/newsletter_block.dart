import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/app_buttons.dart";
import "../block_data.dart";

/// Renderer for `newsletter` — an email-signup section.
///
/// Shape (backend `modules/cms/registry/newsletter.ts`):
/// ```
/// { title, subtitle?, placeholder, button, provider_note? }
/// ```
/// Local-only submission for now (validates + shows a thank-you). Wiring the
/// POST to the store's subscribe flow is a later phase.
Widget newsletterBlock(BuildContext context, BlockData data) =>
    _NewsletterBlock(data: data);

class _NewsletterBlock extends StatefulWidget {
  const _NewsletterBlock({required this.data});

  final BlockData data;

  @override
  State<_NewsletterBlock> createState() => _NewsletterBlockState();
}

class _NewsletterBlockState extends State<_NewsletterBlock> {
  final _controller = TextEditingController();
  bool _submitted = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final email = _controller.text.trim();
    final valid = RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(email);
    setState(() {
      if (!valid) {
        _error = "Enter a valid email address.";
      } else {
        _error = null;
        _submitted = true;
        // TODO(wave2): POST to the store's newsletter/subscribe endpoint.
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final title = data.str("title");
    final subtitle = data.str("subtitle");
    final placeholder = data.strOr("placeholder", "Your email address");
    final button = data.strOr("button", "Subscribe");
    final note = data.str("provider_note");

    if (title == null && !data.raw.containsKey("placeholder")) {
      return const SizedBox.shrink();
    }

    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xxl,
      ),
      color: c.surfaceMuted,
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (title != null)
            Text(
              title.replaceAll(r"\n", "\n"),
              style: text.titleLarge,
              textAlign: TextAlign.center,
            ),
          if (subtitle != null) ...[
            const Gap(AppSpacing.sm),
            Text(
              subtitle,
              style: text.bodyMedium?.copyWith(color: c.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
          const Gap(AppSpacing.lg),
          if (_submitted)
            Text(
              "Thanks — you're on the list.",
              style: text.bodyLarge?.copyWith(color: c.success),
              textAlign: TextAlign.center,
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                children: [
                  TextField(
                    controller: _controller,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      hintText: placeholder,
                      errorText: _error,
                      filled: true,
                      fillColor: c.surface,
                      border: OutlineInputBorder(
                        borderRadius: AppRadius.mdAll,
                        borderSide: BorderSide(color: c.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: AppRadius.mdAll,
                        borderSide: BorderSide(color: c.border),
                      ),
                    ),
                  ),
                  const Gap(AppSpacing.md),
                  PrimaryButton(
                    label: button,
                    onPressed: _submit,
                    fullWidth: true,
                  ),
                ],
              ),
            ),
          if (note != null) ...[
            const Gap(AppSpacing.md),
            Text(
              note,
              style: text.labelSmall?.copyWith(color: c.textMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
