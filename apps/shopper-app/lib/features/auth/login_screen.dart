import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/api/api_error.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "auth_controller.dart";
import "auth_validators.dart";
import "register_screen.dart";

/// Email/password sign-in. Pushed over the account tab via MaterialPageRoute
/// (the shared router is untouched). On success it pops back to Account.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    await ref.read(authControllerProvider.notifier).login(
          email: _email.text.trim(),
          password: _password.text,
        );
    if (!mounted) return;

    final state = ref.read(authControllerProvider);
    setState(() => _submitting = false);
    if (state.hasValue && state.value != null) {
      Navigator.of(context).pop();
    } else if (state.hasError) {
      setState(() => _error = ApiError.from(state.error!).message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(title: const Text("Sign in")),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.screen,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Gap(AppSpacing.md),
                Text("Welcome back", style: text.headlineSmall),
                const Gap(AppSpacing.xs),
                Text(
                  "Sign in to track orders and check out faster.",
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                ),
                const Gap(AppSpacing.xl),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    labelText: "Email",
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  validator: AuthValidators.email,
                ),
                const Gap(AppSpacing.md),
                TextFormField(
                  controller: _password,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  onFieldSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    labelText: "Password",
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      tooltip: _obscure ? "Show password" : "Hide password",
                      icon: Icon(_obscure
                          ? PhosphorIcons.eye()
                          : PhosphorIcons.eyeSlash()),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: AuthValidators.loginPassword,
                ),
                if (_error != null) ...[
                  const Gap(AppSpacing.md),
                  Text(_error!, style: text.bodySmall?.copyWith(color: c.danger)),
                ],
                const Gap(AppSpacing.xl),
                PrimaryButton(
                  label: "Sign in",
                  fullWidth: true,
                  isLoading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
                const Gap(AppSpacing.md),
                GhostButton(
                  label: "New here? Create an account",
                  fullWidth: true,
                  onPressed: _submitting
                      ? null
                      : () => Navigator.of(context).pushReplacement(
                            MaterialPageRoute<void>(
                              builder: (_) => const RegisterScreen(),
                            ),
                          ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
