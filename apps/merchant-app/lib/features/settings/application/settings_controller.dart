import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../data/settings_models.dart";
import "../data/settings_repository.dart";

/// A one-shot feedback message surfaced after a save (success or failure).
class SettingsFeedback {
  const SettingsFeedback(this.text, {this.isError = false});
  final String text;
  final bool isError;
}

/// Immutable state for the Settings screen: the loaded profile, currency
/// selection, store country and payment gateways, plus the initial load/error
/// flags and per-section busy tags for inline spinners.
class SettingsState {
  const SettingsState({
    this.profile,
    this.currencies,
    this.country,
    this.gateways = const <PaymentGateway>[],
    this.isLoading = true,
    this.isRefreshing = false,
    this.error,
    this.savingName = false,
    this.busyCurrency,
    this.savingCountry = false,
    this.busyGatewayId,
    this.feedback,
  });

  final StoreProfile? profile;
  final StoreCurrencies? currencies;

  /// Lowercase ISO alpha-2 store country, or null when not yet set.
  final String? country;
  final List<PaymentGateway> gateways;

  /// Initial load in flight (no data yet).
  final bool isLoading;

  /// A pull-to-refresh is in flight (data already on screen).
  final bool isRefreshing;

  /// The initial-load error, when any (drives the full-screen error state).
  final ApiError? error;

  final bool savingName;

  /// A currency-row operation tag in flight (e.g. "default-usd", "add",
  /// "remove-eur").
  final String? busyCurrency;
  final bool savingCountry;

  /// The id of the gateway whose toggle is currently saving.
  final String? busyGatewayId;

  /// A transient success/error message for the last mutation.
  final SettingsFeedback? feedback;

  /// True once a load completed with no data and no error (defensive — the
  /// profile is effectively always present, but the currencies list could be
  /// empty).
  bool get isEmpty =>
      !isLoading && error == null && profile == null;

  static const Object _keep = Object();

  SettingsState copyWith({
    Object? profile = _keep,
    Object? currencies = _keep,
    Object? country = _keep,
    List<PaymentGateway>? gateways,
    bool? isLoading,
    bool? isRefreshing,
    Object? error = _keep,
    bool? savingName,
    Object? busyCurrency = _keep,
    bool? savingCountry,
    Object? busyGatewayId = _keep,
    Object? feedback = _keep,
  }) {
    return SettingsState(
      profile: profile == _keep ? this.profile : profile as StoreProfile?,
      currencies:
          currencies == _keep ? this.currencies : currencies as StoreCurrencies?,
      country: country == _keep ? this.country : country as String?,
      gateways: gateways ?? this.gateways,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      error: error == _keep ? this.error : error as ApiError?,
      savingName: savingName ?? this.savingName,
      busyCurrency:
          busyCurrency == _keep ? this.busyCurrency : busyCurrency as String?,
      savingCountry: savingCountry ?? this.savingCountry,
      busyGatewayId:
          busyGatewayId == _keep ? this.busyGatewayId : busyGatewayId as String?,
      feedback: feedback == _keep ? this.feedback : feedback as SettingsFeedback?,
    );
  }
}

/// Loads and mutates the merchant's store settings. Every mutation calls the
/// repository (which throws a typed [ApiError]), then reflects the persisted
/// result in state and posts a one-shot [SettingsFeedback] the screen shows as
/// a snackbar.
class SettingsController extends Notifier<SettingsState> {
  SettingsRepository get _repo => ref.read(settingsRepositoryProvider);

  @override
  SettingsState build() {
    Future.microtask(_load);
    return const SettingsState();
  }

  Future<void> _load({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: refreshing ? state.isLoading : true,
      isRefreshing: refreshing,
      error: null,
    );
    try {
      // Load in parallel; each call maps its own failure. The store country is
      // best-effort — a fresh tenant may not have one yet, which is not an
      // error, so a failure there degrades to null rather than failing the page.
      final results = await Future.wait([
        _repo.getProfile(),
        _repo.getCurrencies(),
        _repo.getStoreCountry().then<String?>((v) => v).catchError((_) => null),
        _repo.listGateways(),
      ]);
      state = state.copyWith(
        profile: results[0] as StoreProfile,
        currencies: results[1] as StoreCurrencies,
        country: results[2] as String?,
        gateways: (results[3] as GatewaysResponse).gateways,
        isLoading: false,
        isRefreshing: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        error: ApiError.from(e),
      );
    }
  }

  /// Pull-to-refresh.
  Future<void> refresh() => _load(refreshing: true);

  /// Re-run the initial load after an error.
  void retry() => _load();

  /// Clear the one-shot feedback after the screen has shown it.
  void clearFeedback() {
    if (state.feedback != null) state = state.copyWith(feedback: null);
  }

  /// Rename the store (PUT /merchant/settings).
  Future<void> saveName(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty || trimmed == state.profile?.name) return;
    state = state.copyWith(savingName: true);
    try {
      final persisted = await _repo.updateName(trimmed);
      final profile = (state.profile ?? const StoreProfile())
          .copyWith(name: persisted);
      state = state.copyWith(
        profile: profile,
        savingName: false,
        feedback: const SettingsFeedback("Store name saved"),
      );
    } catch (e) {
      state = state.copyWith(
        savingName: false,
        feedback: SettingsFeedback(ApiError.from(e).message, isError: true),
      );
    }
  }

  Future<void> _persistCurrencies(
    String tag,
    List<String> currencies,
    String defaultCurrency,
    String okMessage,
  ) async {
    state = state.copyWith(busyCurrency: tag);
    try {
      final next = await _repo.updateCurrencies(
        currencies: currencies,
        defaultCurrency: defaultCurrency,
      );
      state = state.copyWith(
        currencies: next,
        busyCurrency: null,
        feedback: SettingsFeedback(okMessage),
      );
    } catch (e) {
      state = state.copyWith(
        busyCurrency: null,
        feedback: SettingsFeedback(ApiError.from(e).message, isError: true),
      );
    }
  }

  /// Make [code] the store's default currency.
  Future<void> setDefaultCurrency(String code) async {
    final cur = state.currencies;
    if (cur == null || code == cur.defaultCurrency) return;
    await _persistCurrencies(
      "default-$code",
      cur.currencies,
      code,
      "Default currency updated",
    );
  }

  /// Add one or more currencies to the enabled set.
  Future<void> addCurrencies(List<String> codes) async {
    final cur = state.currencies;
    if (cur == null || codes.isEmpty) return;
    final next = <String>{...cur.currencies, ...codes.map((c) => c.toLowerCase())}
        .toList();
    await _persistCurrencies(
      "add",
      next,
      cur.defaultCurrency,
      "Currencies updated",
    );
  }

  /// Remove a currency (never the default; never the last one).
  Future<void> removeCurrency(String code) async {
    final cur = state.currencies;
    if (cur == null) return;
    if (code == cur.defaultCurrency || cur.currencies.length <= 1) return;
    final next = cur.currencies.where((c) => c != code).toList();
    await _persistCurrencies(
      "remove-$code",
      next,
      cur.defaultCurrency,
      "Currency removed",
    );
  }

  /// Set the store country (PATCH /merchant/setup).
  Future<void> setCountry(String code) async {
    if (code.toLowerCase() == state.country) return;
    state = state.copyWith(savingCountry: true);
    try {
      final cc = await _repo.updateStoreCountry(code);
      state = state.copyWith(
        country: cc,
        savingCountry: false,
        feedback: const SettingsFeedback("Store country updated"),
      );
    } catch (e) {
      state = state.copyWith(
        savingCountry: false,
        feedback: SettingsFeedback(ApiError.from(e).message, isError: true),
      );
    }
  }

  /// Enable or disable a payment gateway (POST /merchant/payments/gateways).
  Future<void> toggleGateway(PaymentGateway gateway, bool enabled) async {
    state = state.copyWith(busyGatewayId: gateway.id);
    try {
      final updated = await _repo.setGatewayEnabled(gateway, enabled);
      final gateways = state.gateways
          .map((g) => g.id == updated.id ? updated : g)
          .toList();
      state = state.copyWith(
        gateways: gateways,
        busyGatewayId: null,
        feedback: SettingsFeedback(
          enabled ? "${updated.name} enabled" : "${updated.name} disabled",
        ),
      );
    } catch (e) {
      state = state.copyWith(
        busyGatewayId: null,
        feedback: SettingsFeedback(ApiError.from(e).message, isError: true),
      );
    }
  }
}

final settingsControllerProvider =
    NotifierProvider<SettingsController, SettingsState>(SettingsController.new);
