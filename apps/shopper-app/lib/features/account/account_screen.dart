import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../auth/auth_controller.dart";
import "../auth/customer.dart";
import "../auth/login_screen.dart";
import "../auth/register_screen.dart";
import "../placeholder/coming_soon.dart";
import "orders_screen.dart";

/// The account tab.
///
/// Signed out: a prompt with Sign in / Create account CTAs. Signed in: the
/// customer identity header plus links to Orders and Addresses, and a Logout.
/// All secondary screens are pushed via MaterialPageRoute, so the shared
/// go_router is untouched.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final state = ref.watch(authControllerProvider);

    Widget body;
    if (state.isLoading && !state.hasValue) {
      body = const Center(child: CircularProgressIndicator());
    } else {
      final customer = state.valueOrNull;
      body = customer != null
          ? _SignedIn(customer: customer, onNavigate: _push)
          : _SignedOut(onNavigate: _push);
    }

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        title: const Text("Account"),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(child: body),
    );
  }
}

class _SignedOut extends StatelessWidget {
  const _SignedOut({required this.onNavigate});

  final void Function(BuildContext, Widget) onNavigate;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
        padding: AppSpacing.screen,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: c.surfaceMuted,
                shape: BoxShape.circle,
              ),
              child: Icon(PhosphorIcons.userCircle(), size: 40, color: c.textMuted),
            ),
            const Gap(AppSpacing.lg),
            Text("Your account", style: text.titleLarge, textAlign: TextAlign.center),
            const Gap(AppSpacing.xs),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                "Sign in to track orders, save your details and check out faster.",
                textAlign: TextAlign.center,
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
            ),
            const Gap(AppSpacing.xl),
            PrimaryButton(
              label: "Sign in",
              icon: PhosphorIcons.signIn(),
              fullWidth: true,
              onPressed: () => onNavigate(context, const LoginScreen()),
            ),
            const Gap(AppSpacing.md),
            SecondaryButton(
              label: "Create account",
              fullWidth: true,
              onPressed: () => onNavigate(context, const RegisterScreen()),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignedIn extends ConsumerWidget {
  const _SignedIn({required this.customer, required this.onNavigate});

  final Customer customer;
  final void Function(BuildContext, Widget) onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return ListView(
      padding: AppSpacing.screen,
      children: [
        Row(
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.accentTint,
                shape: BoxShape.circle,
              ),
              child: Text(
                customer.initials,
                style: text.titleMedium?.copyWith(
                  color: c.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const Gap(AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    customer.displayName,
                    style: text.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Gap(AppSpacing.xxs),
                  Text(
                    customer.email,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        const Gap(AppSpacing.xl),
        _AccountTile(
          icon: PhosphorIcons.package(),
          label: "Orders",
          subtitle: "Track and review your orders",
          onTap: () => onNavigate(context, const OrdersScreen()),
        ),
        const Gap(AppSpacing.md),
        _AccountTile(
          icon: PhosphorIcons.mapPin(),
          label: "Addresses",
          subtitle: "Manage your delivery addresses",
          onTap: () => onNavigate(
            context,
            const ComingSoonScaffold(
              title: "Addresses",
              message: "Saved addresses are coming in the next build.",
              showBack: true,
            ),
          ),
        ),
        const Gap(AppSpacing.xl),
        GhostButton(
          label: "Log out",
          icon: PhosphorIcons.signOut(),
          fullWidth: true,
          destructive: true,
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Material(
      color: c.surface,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: onTap,
        child: Container(
          padding: AppSpacing.card,
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: c.border),
          ),
          child: Row(
            children: [
              Icon(icon, size: 22, color: c.textPrimary),
              const Gap(AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: text.titleSmall),
                    if (subtitle != null) ...[
                      const Gap(AppSpacing.xxs),
                      Text(
                        subtitle!,
                        style: text.bodySmall?.copyWith(color: c.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(PhosphorIcons.caretRight(), size: 18, color: c.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
