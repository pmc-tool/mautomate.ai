import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/api/api_error.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "auth_controller.dart";
import "auth_validators.dart";

/// Create-account form (first/last name optional, email + password required).
/// Pushed over the account tab via MaterialPageRoute; pops on success.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    await ref.read(authControllerProvider.notifier).register(
          email: _email.text.trim(),
          password: _password.text,
          firstName: _firstName.text,
          lastName: _lastName.text,
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
      appBar: AppBar(title: const Text("Create account")),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.screen,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Gap(AppSpacing.md),
                Text("Join the store", style: text.headlineSmall),
                const Gap(AppSpacing.xs),
                Text(
                  "Create an account to save your details and track orders.",
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                ),
                const Gap(AppSpacing.xl),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _firstName,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.givenName],
                        decoration: const InputDecoration(
                          labelText: "First name",
                        ),
                      ),
                    ),
                    const Gap(AppSpacing.md),
                    Expanded(
                      child: TextFormField(
                        controller: _lastName,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.familyName],
                        decoration: const InputDecoration(
                          labelText: "Last name",
                        ),
                      ),
                    ),
                  ],
                ),
                const Gap(AppSpacing.md),
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
                  autofillHints: const [AutofillHints.newPassword],
                  onFieldSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    labelText: "Password",
                    helperText: "At least 8 characters",
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      tooltip: _obscure ? "Show password" : "Hide password",
                      icon: Icon(_obscure
                          ? PhosphorIcons.eye()
                          : PhosphorIcons.eyeSlash()),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: AuthValidators.password,
                ),
                if (_error != null) ...[
                  const Gap(AppSpacing.md),
                  Text(_error!, style: text.bodySmall?.copyWith(color: c.danger)),
                ],
                const Gap(AppSpacing.xl),
                PrimaryButton(
                  label: "Create account",
                  fullWidth: true,
                  isLoading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
                const Gap(AppSpacing.md),
                GhostButton(
                  label: "Already have an account? Sign in",
                  fullWidth: true,
                  onPressed:
                      _submitting ? null : () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
