import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../../core/theme/theme.dart";
import "../../data/jarvis_models.dart";
import "jarvis_rich_text.dart";

/// The confirmation gate rendered for a proposed write.
///
/// Two tiers, mirroring the web card (the SERVER enforces the real gate at
/// /merchant/jarvis/apply — this only renders it):
///  - SOFT: a single "Confirm" tap (with a light haptic) runs it.
///  - HARD: the merchant must type the exact required word (case-insensitive);
///    the Confirm button stays disabled until it matches.
///
/// After a successful apply the card flips to a "Done" state with the result
/// and, when the action is reversible, an Undo affordance.
class ConfirmCard extends StatefulWidget {
  const ConfirmCard({
    super.key,
    required this.confirm,
    required this.onConfirm,
    required this.onDismiss,
    required this.onUndo,
  });

  final JarvisConfirm confirm;

  /// Called with the typed word (empty for soft) when the merchant confirms.
  final ValueChanged<String> onConfirm;
  final VoidCallback onDismiss;
  final VoidCallback onUndo;

  @override
  State<ConfirmCard> createState() => _ConfirmCardState();
}

class _ConfirmCardState extends State<ConfirmCard> {
  final _typed = TextEditingController();

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  String get _need => (widget.confirm.requireText ?? "").trim().toUpperCase();

  @override
  Widget build(BuildContext context) {
    final c = widget.confirm;
    if (c.status == ConfirmStatus.done) return _buildDone(context, c);
    return _buildPending(context, c);
  }

  Widget _buildDone(BuildContext context, JarvisConfirm c) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    return _shell(
      background: colors.successBg,
      border: colors.successBorder,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(PhosphorIconsFill.checkCircle, size: 16, color: colors.success),
              const Gap(AppSpacing.xs),
              Text(
                "Done",
                style: textTheme.labelLarge?.copyWith(
                  color: colors.success,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if ((c.resultMsg ?? "").isNotEmpty) ...[
            const Gap(AppSpacing.xs),
            JarvisRichText(
              text: c.resultMsg!,
              baseStyle: textTheme.bodySmall!.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ],
          if (c.undone)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                "Undone.",
                style: textTheme.bodySmall?.copyWith(color: colors.textMuted),
              ),
            )
          else if (c.undo != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: _UndoButton(
                label: c.undo!.label,
                busy: c.undoing,
                onPressed: widget.onUndo,
              ),
            ),
          if ((c.error ?? "").isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                c.error!,
                style: textTheme.bodySmall?.copyWith(color: colors.danger),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPending(BuildContext context, JarvisConfirm c) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final hard = c.tier == ConfirmTier.hard;
    final applying = c.status == ConfirmStatus.applying;

    return _shell(
      background: hard ? colors.dangerBg : colors.accentTint,
      border: hard ? colors.dangerBorder : colors.accent.withValues(alpha: 0.4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          JarvisRichText(
            text: c.summary,
            baseStyle: textTheme.bodyMedium!.copyWith(color: colors.textPrimary),
          ),
          if ((c.error ?? "").isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                c.error!,
                style: textTheme.bodySmall?.copyWith(color: colors.danger),
              ),
            ),
          if (hard) ...[
            const Gap(AppSpacing.sm),
            Text.rich(
              TextSpan(
                style: textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                children: [
                  const TextSpan(text: "Type "),
                  TextSpan(
                    text: _need,
                    style: textTheme.bodySmall?.copyWith(
                      color: colors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const TextSpan(text: " to confirm"),
                ],
              ),
            ),
            const Gap(AppSpacing.xs),
            TextField(
              controller: _typed,
              enabled: !applying,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _confirm(hard),
              style: textTheme.bodyMedium?.copyWith(color: colors.textPrimary),
              decoration: InputDecoration(
                isDense: true,
                hintText: _need,
                filled: true,
                fillColor: colors.surface,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: AppRadius.mdAll,
                  borderSide: BorderSide(color: colors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: AppRadius.mdAll,
                  borderSide: BorderSide(color: colors.borderStrong),
                ),
                disabledBorder: OutlineInputBorder(
                  borderRadius: AppRadius.mdAll,
                  borderSide: BorderSide(color: colors.border),
                ),
              ),
            ),
          ],
          const Gap(AppSpacing.md),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ConfirmButton(
                label: applying ? "Working…" : "Confirm",
                background: hard ? colors.danger : colors.primary,
                foreground: hard ? Colors.white : colors.onPrimary,
                enabled: _ready(hard) && !applying,
                busy: applying,
                onPressed: () => _confirm(hard),
              ),
              const Gap(AppSpacing.sm),
              TextButton(
                onPressed: applying ? null : widget.onDismiss,
                child: Text(
                  "Not now",
                  style: textTheme.labelLarge?.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  bool _ready(bool hard) {
    if (!hard) return true;
    return _typed.text.trim().toUpperCase() == _need && _need.isNotEmpty;
  }

  void _confirm(bool hard) {
    if (!_ready(hard) || widget.confirm.status == ConfirmStatus.applying) return;
    HapticFeedback.mediumImpact();
    widget.onConfirm(hard ? _typed.text.trim() : "");
  }

  Widget _shell({
    required Color background,
    required Color border,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: border),
      ),
      child: child,
    );
  }
}

class _ConfirmButton extends StatelessWidget {
  const _ConfirmButton({
    required this.label,
    required this.background,
    required this.foreground,
    required this.enabled,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final Color background;
  final Color foreground;
  final bool enabled;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: enabled ? background : colors.surfaceMuted,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy) ...[
                SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(foreground),
                  ),
                ),
                const Gap(AppSpacing.sm),
              ],
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: enabled ? foreground : colors.textDisabled,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UndoButton extends StatelessWidget {
  const _UndoButton({
    required this.label,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: busy ? null : onPressed,
      borderRadius: AppRadius.smAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(colors.textPrimary),
                ),
              )
            else
              Icon(
                PhosphorIconsRegular.arrowCounterClockwise,
                size: 14,
                color: colors.textPrimary,
              ),
            const Gap(AppSpacing.xs),
            Text(
              busy ? "Undoing…" : label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
