import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/call_center_controllers.dart";
import "../data/call_center_models.dart";
import "call_format.dart";

/// Full call detail: header + status, the AI summary, the transcript, any
/// logged dispositions, and metadata (agent, related order, duration, time).
/// Read-only.
class CallDetailScreen extends ConsumerWidget {
  const CallDetailScreen({super.key, required this.callId});

  final String callId;

  /// Convenience route so the log can push without touching the router.
  static Route<void> route(String callId) {
    return MaterialPageRoute<void>(
      builder: (_) => CallDetailScreen(callId: callId),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(callDetailControllerProvider(callId));

    return AppScaffold(
      title: "Call",
      onRefresh: () => ref.refresh(callDetailControllerProvider(callId).future),
      body: async.when(
        loading: () => const SkeletonList(itemCount: 5),
        error: (err, _) => _Scrollable(
          child: ErrorStateView(
            message:
                err is ApiError ? err.message : "Couldn't load this call.",
            onRetry: () =>
                ref.invalidate(callDetailControllerProvider(callId)),
          ),
        ),
        data: (detail) => _body(context, detail),
      ),
    );
  }

  Widget _body(BuildContext context, CallDetail detail) {
    final call = detail.callData;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        _headerCard(context, detail),
        const Gap(AppSpacing.lg),
        _metaCard(context, detail),
        if (call.summary != null && call.summary!.trim().isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          _summaryCard(context, call.summary!),
        ],
        if (detail.dispositions.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          _dispositionsCard(context, detail.dispositions),
        ],
        if (call.transcript != null && call.transcript!.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          _transcriptCard(context, call.transcript!),
        ],
      ],
    );
  }

  Widget _headerCard(BuildContext context, CallDetail detail) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final call = detail.callData;
    final inbound = call.direction == "inbound";
    final counterpart = inbound
        ? (call.fromNumber ?? call.toNumber)
        : (call.toNumber ?? call.fromNumber);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: inbound ? c.infoBg : c.accentTint,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  inbound
                      ? PhosphorIcons.arrowDownLeft()
                      : PhosphorIcons.arrowUpRight(),
                  size: 20,
                  color: inbound ? c.info : c.accent,
                ),
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      counterpart == null || counterpart.isEmpty
                          ? "Unknown number"
                          : counterpart,
                      style: text.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const Gap(AppSpacing.xxs),
                    Text(
                      "${inbound ? "Inbound" : "Outbound"}  ·  ${formatCallWhen(call.createdAt)}",
                      style: text.bodySmall?.copyWith(color: c.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Gap(AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              StatusChip(status: call.status),
              if (call.disposition != null && call.disposition!.isNotEmpty)
                StatusChip.custom(
                  label: humaniseToken(call.disposition!),
                  tone: StatusTone.info,
                ),
              if (call.sentiment != null && call.sentiment!.isNotEmpty)
                StatusChip.custom(
                  label: humaniseToken(call.sentiment!),
                  tone: sentimentTone(call.sentiment),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metaCard(BuildContext context, CallDetail detail) {
    final call = detail.callData;
    final rows = <(String, String)>[
      ("Duration", formatCallDuration(call.startedAt, call.endedAt)),
      if (detail.agent != null && detail.agent!.name.isNotEmpty)
        ("Agent", detail.agent!.name),
      if (detail.order != null && detail.order!.displayId != 0)
        ("Order", "#${detail.order!.displayId}"),
      if (call.locale != null && call.locale!.isNotEmpty)
        ("Language", call.locale!),
      if (call.costTotal != null) ("Credits", "${call.costTotal!.toInt()}"),
    ];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: "Details"),
          const Gap(AppSpacing.md),
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Gap(AppSpacing.md),
            _MetaRow(label: rows[i].$1, value: rows[i].$2),
          ],
          if (detail.hasRecording) ...[
            const Gap(AppSpacing.md),
            _MetaRow(
              label: "Recording",
              value: "Available on the web dashboard",
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryCard(BuildContext context, String summary) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: "Summary"),
          const Gap(AppSpacing.md),
          Text(
            summary,
            style: text.bodyMedium?.copyWith(color: c.textSecondary, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _dispositionsCard(
    BuildContext context,
    List<CallDisposition> dispositions,
  ) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: "Outcomes"),
          const Gap(AppSpacing.md),
          for (var i = 0; i < dispositions.length; i++) ...[
            if (i > 0) ...[
              const Gap(AppSpacing.md),
              Divider(height: 1, thickness: 1, color: c.border),
              const Gap(AppSpacing.md),
            ],
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        humaniseToken(dispositions[i].outcome),
                        style: text.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text(
                      formatCallWhen(dispositions[i].createdAt),
                      style: text.bodySmall?.copyWith(color: c.textMuted),
                    ),
                  ],
                ),
                if (dispositions[i].reason != null &&
                    dispositions[i].reason!.isNotEmpty) ...[
                  const Gap(AppSpacing.xs),
                  Text(
                    dispositions[i].reason!,
                    style:
                        text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
                if (dispositions[i].notes != null &&
                    dispositions[i].notes!.isNotEmpty) ...[
                  const Gap(AppSpacing.xs),
                  Text(
                    dispositions[i].notes!,
                    style:
                        text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _transcriptCard(
    BuildContext context,
    List<CallTranscriptTurn> transcript,
  ) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: "Transcript"),
          const Gap(AppSpacing.md),
          for (var i = 0; i < transcript.length; i++) ...[
            if (i > 0) const Gap(AppSpacing.md),
            _TranscriptTurn(turn: transcript[i]),
          ],
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 96,
          child: Text(
            label,
            style: text.bodySmall?.copyWith(color: c.textMuted),
          ),
        ),
        const Gap(AppSpacing.md),
        Expanded(
          child: Text(
            value,
            style: text.bodyMedium?.copyWith(color: c.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _TranscriptTurn extends StatelessWidget {
  const _TranscriptTurn({required this.turn});

  final CallTranscriptTurn turn;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    // The agent/assistant is "our" side; anyone else is the caller.
    final isAgent = turn.role.toLowerCase() == "assistant" ||
        turn.role.toLowerCase() == "agent" ||
        turn.role.toLowerCase() == "bot";
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          isAgent ? "Agent" : humaniseToken(turn.role.isEmpty ? "caller" : turn.role),
          style: text.labelSmall?.copyWith(
            color: isAgent ? c.accent : c.textMuted,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        const Gap(AppSpacing.xxs),
        Text(
          turn.content,
          style: text.bodyMedium?.copyWith(color: c.textPrimary, height: 1.45),
        ),
      ],
    );
  }
}

/// Wraps a non-scrolling widget (error) so pull-to-refresh still works.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}
