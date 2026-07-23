import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../cart/cart_models.dart";
import "checkout_controller.dart";
import "checkout_models.dart";
import "order_confirmation_screen.dart";

/// The real multi-step checkout: Information -> Delivery -> Payment -> placed.
///
/// Pushed via a MaterialPageRoute from the cart (the shared go_router is
/// untouched). Internal step navigation is state-driven off
/// [checkoutControllerProvider]; on a successful placement it replaces itself
/// with the [OrderConfirmationScreen]. All errors surface inline on the current
/// step — it never crashes on a bad network.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final state = ref.watch(checkoutControllerProvider);
    final ctrl = ref.read(checkoutControllerProvider.notifier);

    // On a placed order, replace the checkout with the confirmation.
    ref.listen<CheckoutState>(checkoutControllerProvider, (prev, next) {
      if (prev?.order == null && next.order != null) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => OrderConfirmationScreen(order: next.order!),
          ),
        );
      }
    });

    Widget body;
    switch (state.step) {
      case CheckoutStep.information:
        body = _InformationStep(state: state, ctrl: ctrl);
      case CheckoutStep.delivery:
        body = _DeliveryStep(state: state, ctrl: ctrl);
      case CheckoutStep.payment:
        body = _PaymentStep(state: state, ctrl: ctrl);
    }

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        title: const Text("Checkout"),
        leading: state.step == CheckoutStep.information
            ? null
            : IconButton(
                icon: Icon(PhosphorIcons.arrowLeft()),
                onPressed: state.busy ? null : ctrl.back,
              ),
        automaticallyImplyLeading: state.step == CheckoutStep.information,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: _StepIndicator(step: state.step),
        ),
      ),
      body: SafeArea(child: body),
    );
  }
}

/// The three-dot step progress under the app bar.
class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.step});

  final CheckoutStep step;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const labels = ["Information", "Delivery", "Payment"];
    final index = CheckoutStep.values.indexOf(step);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.md),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            _dot(context, active: i <= index),
            const Gap(AppSpacing.xs),
            Text(
              labels[i],
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: i <= index ? c.textPrimary : c.textMuted,
                    fontWeight: i == index ? FontWeight.w700 : FontWeight.w500,
                  ),
            ),
            if (i < labels.length - 1)
              Expanded(
                child: Container(
                  height: 1,
                  margin:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                  color: i < index ? c.primary : c.border,
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _dot(BuildContext context, {required bool active}) {
    final c = context.colors;
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: active ? c.primary : c.border,
        shape: BoxShape.circle,
      ),
    );
  }
}

/// A small inline error banner shown above a step's action button.
class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.dangerBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.dangerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.warning(), size: 18, color: c.danger),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: text.bodySmall?.copyWith(color: c.danger),
            ),
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Step 1 — Information
// --------------------------------------------------------------------------

class _InformationStep extends StatefulWidget {
  const _InformationStep({required this.state, required this.ctrl});

  final CheckoutState state;
  final CheckoutController ctrl;

  @override
  State<_InformationStep> createState() => _InformationStepState();
}

class _InformationStepState extends State<_InformationStep> {
  late final TextEditingController _email;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.state.email);
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final ctrl = widget.ctrl;
    final text = Theme.of(context).textTheme;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: AppSpacing.screen,
            children: [
              Text("Contact", style: text.titleMedium),
              const Gap(AppSpacing.md),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                onChanged: ctrl.setEmail,
                decoration: const InputDecoration(
                  labelText: "Email",
                  prefixIcon: Icon(Icons.mail_outline),
                ),
              ),
              const Gap(AppSpacing.xl),
              Text("Shipping address", style: text.titleMedium),
              const Gap(AppSpacing.md),
              _AddressFormFields(
                key: const ValueKey("shipping"),
                initial: state.shipping,
                countries: state.countries,
                loadingCountries: state.loadingCountries,
                onChanged: ctrl.updateShipping,
              ),
              const Gap(AppSpacing.lg),
              _BillingToggle(
                sameAsShipping: state.billingSameAsShipping,
                onChanged: ctrl.setBillingSameAsShipping,
              ),
              if (!state.billingSameAsShipping) ...[
                const Gap(AppSpacing.lg),
                Text("Billing address", style: text.titleMedium),
                const Gap(AppSpacing.md),
                _AddressFormFields(
                  key: const ValueKey("billing"),
                  initial: state.billing,
                  countries: state.countries,
                  loadingCountries: state.loadingCountries,
                  onChanged: ctrl.updateBilling,
                ),
              ],
            ],
          ),
        ),
        _StepFooter(
          error: state.error,
          child: PrimaryButton(
            label: "Continue to delivery",
            icon: PhosphorIcons.arrowRight(),
            fullWidth: true,
            isLoading: state.busy,
            onPressed: (state.informationValid && !state.busy)
                ? ctrl.submitInformation
                : null,
          ),
        ),
      ],
    );
  }
}

class _BillingToggle extends StatelessWidget {
  const _BillingToggle({required this.sameAsShipping, required this.onChanged});

  final bool sameAsShipping;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return InkWell(
      onTap: () => onChanged(!sameAsShipping),
      borderRadius: AppRadius.mdAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            Icon(
              sameAsShipping
                  ? PhosphorIcons.checkSquare(PhosphorIconsStyle.fill)
                  : PhosphorIcons.square(),
              color: sameAsShipping ? c.primary : c.textMuted,
              size: 22,
            ),
            const Gap(AppSpacing.sm),
            Expanded(
              child: Text(
                "Billing address same as shipping",
                style: text.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The address field group — owns its own controllers, seeded from [initial],
/// and reports edits up as a rebuilt [AddressInput].
class _AddressFormFields extends StatefulWidget {
  const _AddressFormFields({
    super.key,
    required this.initial,
    required this.countries,
    required this.loadingCountries,
    required this.onChanged,
  });

  final AddressInput initial;
  final List<Country> countries;
  final bool loadingCountries;
  final ValueChanged<AddressInput> onChanged;

  @override
  State<_AddressFormFields> createState() => _AddressFormFieldsState();
}

class _AddressFormFieldsState extends State<_AddressFormFields> {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _address1;
  late final TextEditingController _city;
  late final TextEditingController _postal;
  late final TextEditingController _province;
  late final TextEditingController _phone;

  @override
  void initState() {
    super.initState();
    _firstName = TextEditingController(text: widget.initial.firstName);
    _lastName = TextEditingController(text: widget.initial.lastName);
    _address1 = TextEditingController(text: widget.initial.address1);
    _city = TextEditingController(text: widget.initial.city);
    _postal = TextEditingController(text: widget.initial.postalCode);
    _province = TextEditingController(text: widget.initial.province);
    _phone = TextEditingController(text: widget.initial.phone);
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _address1.dispose();
    _city.dispose();
    _postal.dispose();
    _province.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _emit() {
    widget.onChanged(
      widget.initial.copyWith(
        firstName: _firstName.text,
        lastName: _lastName.text,
        address1: _address1.text,
        city: _city.text,
        postalCode: _postal.text,
        province: _province.text,
        phone: _phone.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final country = _selectedCountry();
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _field(_firstName, "First name",
                  hints: const [AutofillHints.givenName]),
            ),
            const Gap(AppSpacing.md),
            Expanded(
              child: _field(_lastName, "Last name",
                  hints: const [AutofillHints.familyName]),
            ),
          ],
        ),
        const Gap(AppSpacing.md),
        _field(_address1, "Address",
            hints: const [AutofillHints.fullStreetAddress]),
        const Gap(AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: _field(_city, "City",
                  hints: const [AutofillHints.addressCity]),
            ),
            const Gap(AppSpacing.md),
            Expanded(
              child: _field(_postal, "Postal code",
                  keyboard: TextInputType.streetAddress,
                  hints: const [AutofillHints.postalCode]),
            ),
          ],
        ),
        const Gap(AppSpacing.md),
        _field(_province, "State / Province (optional)"),
        const Gap(AppSpacing.md),
        _CountryField(
          country: country,
          countries: widget.countries,
          loading: widget.loadingCountries,
          onSelected: (iso) {
            widget.onChanged(widget.initial.copyWith(countryCode: iso));
          },
        ),
        const Gap(AppSpacing.md),
        _field(_phone, "Phone (optional)",
            keyboard: TextInputType.phone,
            hints: const [AutofillHints.telephoneNumber]),
      ],
    );
  }

  Country? _selectedCountry() {
    for (final c in widget.countries) {
      if (c.iso2 == widget.initial.countryCode) return c;
    }
    return null;
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    List<String>? hints,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      autofillHints: hints,
      textCapitalization: keyboard == TextInputType.phone
          ? TextCapitalization.none
          : TextCapitalization.words,
      onChanged: (_) => _emit(),
      decoration: InputDecoration(labelText: label),
    );
  }
}

/// A tap-to-open country field backed by a searchable bottom sheet.
class _CountryField extends StatelessWidget {
  const _CountryField({
    required this.country,
    required this.countries,
    required this.loading,
    required this.onSelected,
  });

  final Country? country;
  final List<Country> countries;
  final bool loading;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return InkWell(
      borderRadius: AppRadius.mdAll,
      onTap: (loading || countries.isEmpty)
          ? null
          : () async {
              final selected = await showModalBottomSheet<Country>(
                context: context,
                isScrollControlled: true,
                backgroundColor: c.surface,
                builder: (_) => _CountrySheet(countries: countries),
              );
              if (selected != null) onSelected(selected.iso2);
            },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: "Country",
          suffixIcon: loading
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Icon(PhosphorIcons.caretDown(), size: 18),
        ),
        child: Text(
          country?.displayName ??
              (loading ? "Loading countries…" : "Select a country"),
          style: text.bodyLarge?.copyWith(
            color: country == null ? c.textMuted : c.textPrimary,
          ),
        ),
      ),
    );
  }
}

class _CountrySheet extends StatefulWidget {
  const _CountrySheet({required this.countries});

  final List<Country> countries;

  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  String _query = "";

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? widget.countries
        : widget.countries
            .where((x) => x.displayName.toLowerCase().contains(q))
            .toList();

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            const Gap(AppSpacing.md),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: AppSpacing.screen,
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: "Search countries",
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final country = filtered[i];
                  return ListTile(
                    title: Text(country.displayName),
                    onTap: () => Navigator.of(context).pop(country),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Step 2 — Delivery
// --------------------------------------------------------------------------

class _DeliveryStep extends StatelessWidget {
  const _DeliveryStep({required this.state, required this.ctrl});

  final CheckoutState state;
  final CheckoutController ctrl;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final currency = state.cart?.currencyCode ?? state.currencyCode;

    Widget list;
    if (state.loadingShippingOptions) {
      list = const _OptionsSkeleton();
    } else if (state.shippingOptions.isEmpty) {
      list = EmptyState(
        icon: PhosphorIcons.truck(),
        title: "No delivery options",
        message:
            "This store has no delivery methods for your address yet. Try a different address or check back later.",
      );
    } else {
      list = ListView(
        padding: AppSpacing.screen,
        children: [
          Text("Delivery method", style: text.titleMedium),
          const Gap(AppSpacing.md),
          for (final o in state.shippingOptions)
            _RadioTile(
              selected: o.id == state.selectedShippingOptionId,
              title: o.name,
              trailing: o.isFree ? "Free" : formatMoney(o.amount, currency),
              onTap: () => ctrl.selectShippingOption(o.id),
            ),
        ],
      );
    }

    return Column(
      children: [
        Expanded(child: list),
        _StepFooter(
          error: state.error,
          child: PrimaryButton(
            label: "Continue to payment",
            icon: PhosphorIcons.arrowRight(),
            fullWidth: true,
            isLoading: state.busy,
            onPressed: (state.deliveryValid && !state.busy)
                ? ctrl.confirmDelivery
                : null,
          ),
        ),
      ],
    );
  }
}

// --------------------------------------------------------------------------
// Step 3 — Payment
// --------------------------------------------------------------------------

class _PaymentStep extends StatelessWidget {
  const _PaymentStep({required this.state, required this.ctrl});

  final CheckoutState state;
  final CheckoutController ctrl;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final provider = state.selectedProvider;

    Widget methods;
    if (state.loadingProviders) {
      methods = const _OptionsSkeleton(padded: false, showTitle: false);
    } else if (state.providers.isEmpty) {
      methods = Padding(
        padding: AppSpacing.screen,
        child: EmptyState(
          icon: PhosphorIcons.creditCard(),
          title: "No payment methods",
          message:
              "This store hasn't configured a payment method yet, so orders can't be placed. Please contact the store.",
        ),
      );
    } else {
      methods = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final p in state.providers)
            _RadioTile(
              selected: p.id == state.selectedProviderId,
              title: p.label,
              subtitle: p.canCompleteWithoutCard
                  ? "Pay when your order arrives"
                  : null,
              onTap: () => ctrl.selectProvider(p.id),
            ),
          if (provider != null && provider.requiresCardEntry) ...[
            const Gap(AppSpacing.md),
            _CardNotice(),
          ],
        ],
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: AppSpacing.screen,
            children: [
              Text("Payment method", style: text.titleMedium),
              const Gap(AppSpacing.md),
              methods,
              const Gap(AppSpacing.xl),
              if (state.cart != null)
                _OrderSummary(
                  cart: state.cart!,
                  shipping: state.selectedShippingOption,
                ),
            ],
          ),
        ),
        _StepFooter(
          error: state.error,
          child: PrimaryButton(
            label: "Place order",
            icon: PhosphorIcons.lock(),
            fullWidth: true,
            isLoading: state.busy,
            onPressed: (state.paymentValid &&
                    state.providers.isNotEmpty &&
                    !state.busy)
                ? ctrl.placeOrder
                : null,
          ),
        ),
      ],
    );
  }
}

/// The card-gateway notice — states that card details are entered securely at
/// runtime. It intentionally does NOT collect or store card data here.
class _CardNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: AppSpacing.card,
      decoration: BoxDecoration(
        color: c.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.creditCard(), size: 18, color: c.textSecondary),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              "You'll enter your card details securely to finish this payment. "
              "Your card is never stored on this device.",
              style: text.bodySmall?.copyWith(color: c.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

/// The order summary — items, subtotal, shipping and total.
class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.cart, this.shipping});

  final Cart cart;
  final ShippingOption? shipping;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final currency = cart.currencyCode;
    final subtotal = cart.subtotal;
    final total = cart.total ?? cart.subtotal;

    // Prefer the cart's derived shipping (total - subtotal) so it matches the
    // recalculated cart; fall back to the chosen option's amount.
    num? shippingAmount;
    if (total != null && subtotal != null) {
      final diff = total - subtotal;
      shippingAmount = diff > 0 ? diff : (shipping?.amount ?? 0);
    } else {
      shippingAmount = shipping?.amount;
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      padding: AppSpacing.card,
      child: Column(
        children: [
          Row(
            children: [
              Icon(PhosphorIcons.receipt(), size: 18, color: c.textSecondary),
              const Gap(AppSpacing.sm),
              Text("Order summary", style: text.titleSmall),
            ],
          ),
          const Gap(AppSpacing.md),
          for (final item in cart.items)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      "${item.quantity} x ${item.title}",
                      style: text.bodyMedium?.copyWith(color: c.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Gap(AppSpacing.sm),
                  if (item.total != null)
                    Text(formatMoney(item.total!, currency),
                        style: text.bodyMedium),
                ],
              ),
            ),
          const Divider(height: AppSpacing.lg),
          if (subtotal != null) _line(context, "Subtotal", subtotal, currency),
          _line(
            context,
            "Shipping",
            shippingAmount,
            currency,
            freeWhenZero: true,
          ),
          const Gap(AppSpacing.xs),
          _line(context, "Total", total, currency, strong: true),
        ],
      ),
    );
  }

  Widget _line(
    BuildContext context,
    String label,
    num? amount,
    String? currency, {
    bool strong = false,
    bool freeWhenZero = false,
  }) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final display = amount == null
        ? "—"
        : (freeWhenZero && amount <= 0
            ? "Free"
            : formatMoney(amount, currency));
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: strong
                ? text.titleMedium
                : text.bodyMedium?.copyWith(color: c.textSecondary),
          ),
          Text(
            display,
            style: strong
                ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700)
                : text.bodyMedium,
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Shared step widgets
// --------------------------------------------------------------------------

/// A selectable row for shipping options and payment methods.
class _RadioTile extends StatelessWidget {
  const _RadioTile({
    required this.selected,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailing,
  });

  final bool selected;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: onTap,
        child: Container(
          padding: AppSpacing.card,
          decoration: BoxDecoration(
            color: selected ? c.surface : c.surface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: selected ? c.primary : c.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? PhosphorIcons.radioButton(PhosphorIconsStyle.fill)
                    : PhosphorIcons.circle(),
                color: selected ? c.primary : c.textMuted,
                size: 22,
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: text.titleSmall),
                    if (subtitle != null) ...[
                      const Gap(AppSpacing.xxs),
                      Text(
                        subtitle!,
                        style:
                            text.bodySmall?.copyWith(color: c.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const Gap(AppSpacing.sm),
                Text(
                  trailing!,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The pinned bottom action area: an optional inline error over the CTA.
class _StepFooter extends StatelessWidget {
  const _StepFooter({required this.child, this.error});

  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (error != null) _ErrorBanner(message: error!),
          child,
        ],
      ),
    );
  }
}


/// A shimmering placeholder for the delivery / payment option lists, mirroring
/// the [_RadioTile] footprint so the step doesn't jump when options load.
class _OptionsSkeleton extends StatelessWidget {
  const _OptionsSkeleton({this.padded = true, this.showTitle = true});

  /// Wrap in the standard screen padding (delivery uses this; payment already
  /// sits inside a padded list so it passes false).
  final bool padded;

  /// Render a leading title placeholder (delivery has its own title row).
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final content = Shimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showTitle) ...[
            const SkeletonBox(width: 140, height: 16),
            const Gap(AppSpacing.md),
          ],
          for (var i = 0; i < 3; i++)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: SkeletonBox(
                width: double.infinity,
                height: 64,
                borderRadius: AppRadius.mdAll,
              ),
            ),
        ],
      ),
    );
    if (!padded) return content;
    return Padding(padding: AppSpacing.screen, child: content);
  }
}
