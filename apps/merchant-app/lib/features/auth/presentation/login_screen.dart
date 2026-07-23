import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/auth/auth_controller.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "auth_error_banner.dart";

/// Merchant sign-in: email + password -> POST /auth/merchant/emailpass.
/// On success the router redirects (to /mfa or /home) off auth state, so this
/// screen never navigates by hand.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    ref.read(authControllerProvider.notifier).login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final auth = ref.watch(authControllerProvider);
    final submitting = auth.submitting;

    return AppScaffold(
      showAppBar: false,
      safeAreaTop: true,
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
                  Text(
                    "mAutomate",
                    style: text.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                      color: c.textPrimary,
                    ),
                  ),
                  const Gap(AppSpacing.xs),
                  Text(
                    "Sign in to run your shop.",
                    style: text.bodyMedium?.copyWith(color: c.textSecondary),
                  ),
                  const Gap(AppSpacing.xl),
                  if (auth.error != null) ...[
                    AuthErrorBanner(message: auth.error!),
                    const Gap(AppSpacing.lg),
                  ],
                  AppTextField(
                    label: "Email",
                    hint: "you@store.com",
                    controller: _emailController,
                    enabled: !submitting,
                    prefixIcon: PhosphorIconsRegular.envelope,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.email],
                    validator: (value) {
                      final v = value?.trim() ?? "";
                      if (v.isEmpty) return "Enter your email";
                      if (!v.contains("@") || !v.contains(".")) {
                        return "Enter a valid email address";
                      }
                      return null;
                    },
                  ),
                  const Gap(AppSpacing.lg),
                  AppTextField(
                    label: "Password",
                    controller: _passwordController,
                    enabled: !submitting,
                    prefixIcon: PhosphorIconsRegular.lock,
                    obscure: true,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _submit(),
                    validator: (value) {
                      if ((value ?? "").isEmpty) return "Enter your password";
                      return null;
                    },
                  ),
                  const Gap(AppSpacing.xl),
                  PrimaryButton(
                    label: "Sign in",
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
