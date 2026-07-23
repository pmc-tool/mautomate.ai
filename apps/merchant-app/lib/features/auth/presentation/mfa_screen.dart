import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/auth/auth_controller.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "auth_error_banner.dart";

/// Two-factor step: the merchant enters the code from their authenticator, and
/// we POST /auth/merchant/mfa/verify with the pending token. The router
/// redirects to /home on success off auth state.
class MfaScreen extends ConsumerStatefulWidget {
  const MfaScreen({super.key});

  @override
  ConsumerState<MfaScreen> createState() => _MfaScreenState();
}

class _MfaScreenState extends ConsumerState<MfaScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    ref
        .read(authControllerProvider.notifier)
        .verifyMfa(code: _codeController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final auth = ref.watch(authControllerProvider);
    final submitting = auth.submitting;

    return AppScaffold(
      leading: IconButton(
        icon: const Icon(PhosphorIconsRegular.arrowLeft),
        tooltip: "Back to sign in",
        onPressed: submitting
            ? null
            : () => ref.read(authControllerProvider.notifier).cancelMfa(),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.xxl,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    PhosphorIconsRegular.shieldCheck,
                    size: 40,
                    color: c.accent,
                  ),
                  const Gap(AppSpacing.lg),
                  Text(
                    "Two-factor verification",
                    style: text.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: c.textPrimary,
                    ),
                  ),
                  const Gap(AppSpacing.xs),
                  Text(
                    "Enter the 6-digit code from your authenticator app.",
                    style: text.bodyMedium?.copyWith(color: c.textSecondary),
                  ),
                  const Gap(AppSpacing.xl),
                  if (auth.error != null) ...[
                    AuthErrorBanner(message: auth.error!),
                    const Gap(AppSpacing.lg),
                  ],
                  AppTextField(
                    label: "Verification code",
                    controller: _codeController,
                    enabled: !submitting,
                    prefixIcon: PhosphorIconsRegular.password,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    autofocus: true,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onSubmitted: (_) => _submit(),
                    validator: (value) {
                      final v = value?.trim() ?? "";
                      if (v.length < 6) return "Enter the 6-digit code";
                      return null;
                    },
                  ),
                  const Gap(AppSpacing.xl),
                  PrimaryButton(
                    label: "Verify",
                    fullWidth: true,
                    isLoading: submitting,
                    onPressed: submitting ? null : _submit,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
