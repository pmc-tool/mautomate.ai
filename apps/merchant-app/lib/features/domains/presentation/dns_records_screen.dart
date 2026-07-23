import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/domain_search_controller.dart";
import "../data/domain_models.dart";

/// Read-only DNS record list for a registrar-managed domain
/// (`GET /merchant/domains/:domain/dns`). Pull-to-refresh re-fetches.
class DnsRecordsScreen extends ConsumerWidget {
  const DnsRecordsScreen({super.key, required this.domain});

  final String domain;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dnsRecordsProvider(domain));

    return AppScaffold(
      title: "DNS records",
      titleWidget: _TitleColumn(domain: domain),
      body: RefreshIndicator(
        color: context.colors.accent,
        onRefresh: () async => ref.invalidate(dnsRecordsProvider(domain)),
        child: async.when(
          loading: () => const SkeletonList(itemCount: 8),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(height: MediaQuery.of(context).size.height * 0.1),
              ErrorStateView(
                message: ApiError.from(e).message,
                onRetry: () => ref.invalidate(dnsRecordsProvider(domain)),
              ),
            ],
          ),
          data: (records) => _RecordsList(domain: domain, records: records),
        ),
      ),
    );
  }
}

class _TitleColumn extends StatelessWidget {
  const _TitleColumn({required this.domain});

  final String domain;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("DNS records", style: text.titleMedium),
        Text(
          domain,
          style: text.labelSmall?.copyWith(color: c.textMuted),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _RecordsList extends StatelessWidget {
  const _RecordsList({required this.domain, required this.records});

  final String domain;
  final List<DnsRecord> records;

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.1),
          EmptyState(
            icon: PhosphorIcons.listMagnifyingGlass(),
            title: "No DNS records",
            message:
                "This domain has no DNS records yet, or they're managed at your "
                "own provider.",
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      itemCount: records.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        thickness: 1,
        indent: AppSpacing.lg,
        endIndent: AppSpacing.lg,
        color: context.colors.border,
      ),
      itemBuilder: (context, index) => _RecordRow(record: records[index]),
    );
  }
}

class _RecordRow extends StatelessWidget {
  const _RecordRow({required this.record});

  final DnsRecord record;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final meta = <String>[
      if (record.ttl != null) "TTL ${record.ttl}",
      if (record.priority != null) "Priority ${record.priority}",
    ].join("  ·  ");

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            padding: const EdgeInsets.symmetric(vertical: 3),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surfaceMuted,
              borderRadius: AppRadius.smAll,
              border: Border.all(color: c.border),
            ),
            child: Text(
              record.type.isEmpty ? "?" : record.type.toUpperCase(),
              style: text.labelSmall?.copyWith(
                color: c.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.host.isEmpty ? "@" : record.host,
                  style: text.bodyMedium?.copyWith(color: c.textPrimary),
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  record.value,
                  style: text.bodySmall?.copyWith(
                    color: c.textSecondary,
                    fontFamily: "monospace",
                  ),
                ),
                if (meta.isNotEmpty) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    meta,
                    style: text.labelSmall?.copyWith(color: c.textMuted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
