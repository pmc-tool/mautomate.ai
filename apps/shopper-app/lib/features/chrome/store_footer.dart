import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/config/config_providers.dart";
import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "chrome_controller.dart";
import "store_chrome.dart";

/// The store footer, rendered at the end of scrollable pages (wired as the
/// [PageRenderer] `trailing`). Draws `chrome.footer`: link columns, a contact
/// block, a newsletter mention, social links, an optional payment strip and the
/// copyright line (with `{year}` substituted). Themed on the muted surface and
/// correct in light + dark. When the store has no footer configured it degrades
/// to a subtle "Powered by mAutomate" strip.
class StoreFooter extends ConsumerWidget {
  const StoreFooter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final footer = ref.watch(storeChromeProvider.select((v) => v.footer));
    final config = ref.watch(appConfigProvider);

    if (footer == null || footer.isEmpty) {
      return const _PoweredByStrip();
    }

    final text = Theme.of(context).textTheme;

    return Container(
      width: double.infinity,
      color: c.surfaceMuted,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (footer.columns.isNotEmpty || footer.contact != null)
            Wrap(
              spacing: AppSpacing.xxl,
              runSpacing: AppSpacing.xl,
              children: [
                if (footer.contact != null) _ContactBlock(contact: footer.contact!),
                for (final col in footer.columns)
                  if (!col.isEmpty) _LinkColumn(column: col),
              ],
            ),
          if (footer.newsletter != null) ...[
            const Gap(AppSpacing.xl),
            _NewsletterBlock(newsletter: footer.newsletter!),
          ],
          if (footer.social.isNotEmpty) ...[
            const Gap(AppSpacing.xl),
            _SocialRow(links: footer.social),
          ],
          if (footer.paymentImage != null) ...[
            const Gap(AppSpacing.xl),
            StoreImage(
              url: config.resolveAsset(footer.paymentImage),
              fit: BoxFit.contain,
              height: 24,
            ),
          ],
          const Gap(AppSpacing.xl),
          Divider(color: c.border, height: 1),
          const Gap(AppSpacing.lg),
          Text(
            footer.resolvedCopyright ?? "",
            style: text.labelMedium?.copyWith(color: c.textMuted),
          ),
          const Gap(AppSpacing.sm),
          Text(
            "Powered by mAutomate",
            style: text.labelSmall?.copyWith(color: c.textMuted),
          ),
        ],
      ),
    );
  }
}

class _ContactBlock extends StatelessWidget {
  const _ContactBlock({required this.contact});

  final FooterContact contact;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return SizedBox(
      width: 200,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (contact.title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                contact.title!,
                style: text.titleSmall?.copyWith(color: c.textPrimary),
              ),
            ),
          for (final line in contact.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text(
                line,
                style: text.bodySmall?.copyWith(color: c.textSecondary),
              ),
            ),
        ],
      ),
    );
  }
}

class _LinkColumn extends StatelessWidget {
  const _LinkColumn({required this.column});

  final FooterColumn column;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return SizedBox(
      width: 150,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (column.title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                column.title!,
                style: text.titleSmall?.copyWith(color: c.textPrimary),
              ),
            ),
          for (final link in column.links)
            InkWell(
              onTap: () => context.navigateToHref(link.href),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Text(
                  link.label,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NewsletterBlock extends StatelessWidget {
  const _NewsletterBlock({required this.newsletter});

  final FooterNewsletter newsletter;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (newsletter.title != null)
          Text(
            newsletter.title!,
            style: text.titleSmall?.copyWith(color: c.textPrimary),
          ),
        if (newsletter.subtitle != null) ...[
          const Gap(AppSpacing.xs),
          Text(
            newsletter.subtitle!,
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _SocialRow extends StatelessWidget {
  const _SocialRow({required this.links});

  final List<ChromeLink> links;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(
      spacing: AppSpacing.xs,
      children: [
        for (final link in links)
          IconButton(
            onPressed: () => context.navigateToHref(link.href),
            tooltip: link.label,
            icon: Icon(
              _socialIcon(link.platform ?? link.label),
              size: 20,
              color: c.textSecondary,
            ),
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
      ],
    );
  }

  IconData _socialIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains("instagram")) return PhosphorIcons.instagramLogo();
    if (n.contains("facebook")) return PhosphorIcons.facebookLogo();
    if (n.contains("twitter") || n == "x") return PhosphorIcons.twitterLogo();
    if (n.contains("youtube")) return PhosphorIcons.youtubeLogo();
    if (n.contains("tiktok")) return PhosphorIcons.tiktokLogo();
    if (n.contains("linkedin")) return PhosphorIcons.linkedinLogo();
    if (n.contains("pinterest")) return PhosphorIcons.pinterestLogo();
    if (n.contains("whatsapp")) return PhosphorIcons.whatsappLogo();
    return PhosphorIcons.link();
  }
}

class _PoweredByStrip extends StatelessWidget {
  const _PoweredByStrip();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      color: c.surfaceMuted,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      child: Center(
        child: Text(
          "Powered by mAutomate",
          style: text.labelSmall?.copyWith(color: c.textMuted),
        ),
      ),
    );
  }
}
