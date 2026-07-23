import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../data/marketing_repository.dart";
import "marketing_platforms.dart";

/// Opens the compose-post bottom sheet. Resolves to `true` when a post was
/// created (the caller reloads), otherwise null/false.
Future<bool?> showMarketingComposer(
  BuildContext context, {
  required List<String> connectedPlatforms,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
    ),
    builder: (_) => _PostComposerSheet(connectedPlatforms: connectedPlatforms),
  );
}

class _PostComposerSheet extends ConsumerStatefulWidget {
  const _PostComposerSheet({required this.connectedPlatforms});

  final List<String> connectedPlatforms;

  @override
  ConsumerState<_PostComposerSheet> createState() => _PostComposerSheetState();
}

class _PostComposerSheetState extends ConsumerState<_PostComposerSheet> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _hashtags = TextEditingController();
  final _link = TextEditingController();

  final Set<String> _platforms = {};
  DateTime? _scheduledAt;
  bool _saving = false;
  String? _error;

  /// The platforms the merchant can target. Prefer their connected accounts;
  /// fall back to the standard composable set so the picker is never empty.
  List<String> get _options {
    if (widget.connectedPlatforms.isNotEmpty) {
      final set = {...widget.connectedPlatforms};
      return set.toList(growable: false);
    }
    return kComposablePlatforms;
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _hashtags.dispose();
    _link.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final hasConnected = widget.connectedPlatforms.isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              const Gap(AppSpacing.sm),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.borderStrong,
                  borderRadius: AppRadius.smAll,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Icon(PhosphorIconsRegular.megaphone, size: 20, color: c.textSecondary),
                    const Gap(AppSpacing.sm),
                    Text("Compose post", style: text.titleMedium),
                    const Spacer(),
                    IconButton(
                      icon: Icon(PhosphorIcons.x(), size: 20),
                      color: c.textSecondary,
                      tooltip: "Close",
                      onPressed: _saving ? null : () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: c.border),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: AppSpacing.screen,
                  children: [
                    if (_error != null) ...[
                      _ErrorBanner(message: _error!),
                      const Gap(AppSpacing.lg),
                    ],
                    AppTextField(
                      label: "Title",
                      hint: "Optional — an internal name for this post",
                      controller: _title,
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const Gap(AppSpacing.lg),
                    AppTextField(
                      label: "Body",
                      hint: "What do you want to say?",
                      controller: _body,
                      maxLines: 6,
                      minLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const Gap(AppSpacing.lg),
                    AppTextField(
                      label: "Hashtags",
                      hint: "summer sale newarrivals",
                      controller: _hashtags,
                      prefixIcon: PhosphorIcons.hash(),
                      helperText: "Separate with spaces or commas.",
                    ),
                    const Gap(AppSpacing.lg),
                    AppTextField(
                      label: "Link",
                      hint: "https://your-store.com/product",
                      controller: _link,
                      prefixIcon: PhosphorIcons.link(),
                      keyboardType: TextInputType.url,
                    ),
                    const Gap(AppSpacing.xl),
                    Text("Channels", style: text.labelMedium?.copyWith(color: c.textSecondary)),
                    const Gap(AppSpacing.sm),
                    if (!hasConnected)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          "You haven't connected any channels yet. Connect accounts "
                          "in the Channels tab to publish; you can still save a draft.",
                          style: text.bodySmall?.copyWith(color: c.textMuted),
                        ),
                      ),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final p in _options)
                          _PlatformChip(
                            platform: p,
                            selected: _platforms.contains(p),
                            onTap: () => setState(() {
                              if (!_platforms.add(p)) _platforms.remove(p);
                            }),
                          ),
                      ],
                    ),
                    const Gap(AppSpacing.xl),
                    Text("Schedule", style: text.labelMedium?.copyWith(color: c.textSecondary)),
                    const Gap(AppSpacing.sm),
                    _ScheduleField(
                      value: _scheduledAt,
                      enabled: _platforms.isNotEmpty,
                      onPick: _pickSchedule,
                      onClear: () => setState(() => _scheduledAt = null),
                    ),
                    if (_platforms.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          "Pick at least one channel to schedule a post.",
                          style: text.labelSmall?.copyWith(color: c.textMuted),
                        ),
                      ),
                    const Gap(AppSpacing.xxl),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: AppSpacing.screen,
                  child: PrimaryButton(
                    label: _scheduledAt != null && _platforms.isNotEmpty
                        ? "Schedule post"
                        : "Save draft",
                    icon: PhosphorIcons.check(),
                    isLoading: _saving,
                    fullWidth: true,
                    onPressed: _saving ? null : _save,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pickSchedule() async {
    final initial = _scheduledAt ?? DateTime.now().add(const Duration(hours: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return;
    setState(() {
      _scheduledAt =
          DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  List<String> _parseHashtags(String raw) => raw
      .split(RegExp(r"[\s,]+"))
      .map((t) => t.replaceFirst(RegExp(r"^#"), "").trim())
      .where((t) => t.isNotEmpty)
      .toList();

  Future<void> _save() async {
    final title = _title.text.trim();
    final body = _body.text.trim();
    if (title.isEmpty && body.isEmpty) {
      setState(() => _error = "Add a title or some body text before saving.");
      return;
    }
    final scheduling = _scheduledAt != null && _platforms.isNotEmpty;

    // Scheduling publishes publicly at the chosen time — confirm first. The
    // server enforces its own gate regardless.
    if (scheduling) {
      final ok = await _confirmSchedule();
      if (!ok) return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(marketingRepositoryProvider).createPost(
            title: title.isEmpty ? null : title,
            body: body.isEmpty ? null : body,
            hashtags: _parseHashtags(_hashtags.text),
            linkUrl: _link.text.trim().isEmpty ? null : _link.text.trim(),
            platforms: _platforms.isEmpty ? null : _platforms.toList(),
            scheduledAt: scheduling ? _scheduledAt!.toUtc().toIso8601String() : null,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = ApiError.from(e).message;
        });
      }
    }
  }

  Future<bool> _confirmSchedule() async {
    final c = context.colors;
    final count = _platforms.length;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: const Text("Schedule this post?"),
        content: Text(
          "This post will publish to $count channel${count == 1 ? "" : "s"} at "
          "${DateFormat.yMMMd().add_jm().format(_scheduledAt!)}.",
        ),
        actions: [
          GhostButton(
            label: "Back",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          PrimaryButton(
            label: "Schedule",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}

class _PlatformChip extends StatelessWidget {
  const _PlatformChip({
    required this.platform,
    required this.selected,
    required this.onTap,
  });

  final String platform;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final meta = platformMeta(platform);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? c.accentTint : c.surface,
            borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: selected ? c.accent : c.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                meta.icon,
                size: 15,
                color: selected ? c.accent : c.textSecondary,
              ),
              const Gap(AppSpacing.xs),
              Text(
                meta.label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: selected ? c.accent : c.textSecondary,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleField extends StatelessWidget {
  const _ScheduleField({
    required this.value,
    required this.enabled,
    required this.onPick,
    required this.onClear,
  });

  final DateTime? value;
  final bool enabled;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final label = value == null
        ? "Save as draft (publish later)"
        : DateFormat.yMMMd().add_jm().format(value!);
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: AppRadius.mdAll,
          onTap: enabled ? onPick : null,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: c.surfaceInset,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: c.border),
            ),
            child: Row(
              children: [
                Icon(PhosphorIcons.calendarBlank(), size: 18, color: c.textSecondary),
                const Gap(AppSpacing.md),
                Expanded(
                  child: Text(
                    label,
                    style: text.bodyMedium?.copyWith(
                      color: value == null ? c.textMuted : c.textPrimary,
                    ),
                  ),
                ),
                if (value != null)
                  IconButton(
                    icon: Icon(PhosphorIcons.x(), size: 16),
                    color: c.textMuted,
                    tooltip: "Clear",
                    onPressed: onClear,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.dangerBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.dangerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.warningCircle(), size: 18, color: c.danger),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.danger),
            ),
          ),
        ],
      ),
    );
  }
}
