import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../../data/domain_models.dart";

/// A copyable label/value pair — the merchant taps to copy the exact string to
/// paste at their registrar. The whole tile is a 44dp+ tap target.
class CopyableValue extends StatelessWidget {
  const CopyableValue({
    super.key,
    required this.label,
    required this.value,
    this.mono = true,
  });

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: "Copy $label",
      child: InkWell(
        borderRadius: AppRadius.smAll,
        onTap: value.isEmpty
            ? null
            : () async {
                await Clipboard.setData(ClipboardData(text: value));
                if (!context.mounted) return;
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(content: Text("Copied $label")),
                  );
              },
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: c.surfaceInset,
            borderRadius: AppRadius.smAll,
            border: Border.all(color: c.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label.toUpperCase(),
                      style: text.labelSmall?.copyWith(
                        color: c.textMuted,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const Gap(AppSpacing.xxs),
                    Text(
                      value.isEmpty ? "—" : value,
                      style: (mono
                              ? text.bodySmall?.copyWith(
                                  fontFamily: "monospace",
                                  color: c.textPrimary,
                                )
                              : text.bodyMedium)
                          ?.copyWith(color: c.textPrimary),
                    ),
                  ],
                ),
              ),
              const Gap(AppSpacing.sm),
              Icon(PhosphorIcons.copy(), size: 18, color: c.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Renders the DNS changes a merchant must make ([DnsInstruction]s) as an
/// ordered, copyable set of steps. This is a GUIDE — it shows the exact records
/// to add at the registrar; it never claims the change is done. `note`/`txt`
/// entries render as guidance, `ns`/`cname` as copyable records.
class DnsInstructionsCard extends StatelessWidget {
  const DnsInstructionsCard({
    super.key,
    required this.instructions,
    this.title = "What to change at your registrar",
  });

  final List<DnsInstruction> instructions;
  final String title;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    if (instructions.isEmpty) {
      return const SizedBox.shrink();
    }

    final notes = instructions.where((i) => i.kind == "note").toList();
    final records = instructions.where((i) => i.kind != "note").toList();

    return AppCard(
      color: c.surfaceMuted,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIcons.listChecks(), size: 18, color: c.textSecondary),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: text.titleSmall?.copyWith(color: c.textPrimary),
                ),
              ),
            ],
          ),
          if (records.isNotEmpty) ...[
            const Gap(AppSpacing.md),
            for (var i = 0; i < records.length; i++) ...[
              if (i > 0) const Gap(AppSpacing.sm),
              _RecordRow(index: i + 1, instruction: records[i]),
            ],
          ],
          for (final n in notes) ...[
            const Gap(AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(PhosphorIcons.info(), size: 16, color: c.info),
                const Gap(AppSpacing.sm),
                Expanded(
                  child: Text(
                    n.value.isNotEmpty ? n.value : n.name,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RecordRow extends StatelessWidget {
  const _RecordRow({required this.index, required this.instruction});

  final int index;
  final DnsInstruction instruction;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final kind = instruction.kind.toUpperCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: c.accentTint,
                borderRadius: AppRadius.smAll,
              ),
              child: Text(
                kind,
                style: text.labelSmall?.copyWith(
                  color: c.accent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Gap(AppSpacing.sm),
            Text(
              "Step $index",
              style: text.labelSmall?.copyWith(color: c.textMuted),
            ),
          ],
        ),
        const Gap(AppSpacing.sm),
        if (instruction.name.isNotEmpty) ...[
          CopyableValue(
            label: instruction.kind == "ns" ? "Nameserver" : "Name / host",
            value: instruction.name,
          ),
          const Gap(AppSpacing.xs),
        ],
        CopyableValue(
          label: instruction.kind == "ns" ? "Nameserver" : "Value",
          value: instruction.value,
        ),
        if (instruction.ttl != null) ...[
          const Gap(AppSpacing.xs),
          Text(
            "TTL ${instruction.ttl}",
            style: text.labelSmall?.copyWith(color: c.textMuted),
          ),
        ],
      ],
    );
  }
}
