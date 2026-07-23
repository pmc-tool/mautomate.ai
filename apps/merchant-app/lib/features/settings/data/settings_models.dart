// DTOs for the merchant Settings feature, mirroring the web client's `Settings`,
// the /merchant/store/currencies contract, the /merchant/setup snapshot (store
// country) and `PaymentGateway`
// (apps/storefront/src/lib/merchant-admin/api.ts). freezed + json_serializable
// generate parsing, equality and copyWith.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern (same
// convention as the Orders + Products DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "settings_models.freezed.dart";
part "settings_models.g.dart";

/// The store profile — GET /merchant/settings -> { name, slug, domain, status }.
/// Only [name] is editable (PUT /merchant/settings { name }); slug/domain are
/// fixed by the platform.
@freezed
class StoreProfile with _$StoreProfile {
  const factory StoreProfile({
    @Default("") String name,
    @Default("") String slug,
    String? domain,
    @Default("") String status,
  }) = _StoreProfile;

  factory StoreProfile.fromJson(Map<String, dynamic> json) =>
      _$StoreProfileFromJson(json);
}

/// The tenant's currency selection — GET/POST /merchant/store/currencies ->
/// { currencies: string[], default_currency }.
@freezed
class StoreCurrencies with _$StoreCurrencies {
  const factory StoreCurrencies({
    @Default(<String>[]) List<String> currencies,
    @JsonKey(name: "default_currency") @Default("usd") String defaultCurrency,
  }) = _StoreCurrencies;

  factory StoreCurrencies.fromJson(Map<String, dynamic> json) =>
      _$StoreCurrenciesFromJson(json);
}

/// One credential slot on a gateway (used only to render the "configured"
/// status honestly — secret entry itself is out of the app's scope).
@freezed
class GatewayCredential with _$GatewayCredential {
  const factory GatewayCredential({
    @Default("") String key,
    @Default("") String label,
    @Default(false) bool secret,
    @Default(false) bool optional,
    @JsonKey(name: "is_set") bool? isSet,
  }) = _GatewayCredential;

  factory GatewayCredential.fromJson(Map<String, dynamic> json) =>
      _$GatewayCredentialFromJson(json);
}

/// A checkout payment gateway — mirrors the web `PaymentGateway`
/// (GET /merchant/payments/gateways). The app surfaces the enable/disable
/// toggle + configured status; full credential setup lives on the web
/// dashboard.
@freezed
class PaymentGateway with _$PaymentGateway {
  const factory PaymentGateway({
    @Default("") String id,
    @JsonKey(name: "provider_id") @Default("") String providerId,
    @Default("") String name,
    @Default("") String blurb,
    @Default(<String>[]) List<String> countries,
    @Default("direct") String mode,
    @Default(false) bool configured,
    @Default(false) bool enabled,
    @JsonKey(name: "enabled_regions")
    @Default(<String>[])
    List<String> enabledRegions,
    @Default(<GatewayCredential>[]) List<GatewayCredential> credentials,
  }) = _PaymentGateway;

  factory PaymentGateway.fromJson(Map<String, dynamic> json) =>
      _$PaymentGatewayFromJson(json);
}

/// GET /merchant/payments/gateways -> { tenant_country, gateways }.
@freezed
class GatewaysResponse with _$GatewaysResponse {
  const factory GatewaysResponse({
    @JsonKey(name: "tenant_country") String? tenantCountry,
    @Default(<PaymentGateway>[]) List<PaymentGateway> gateways,
  }) = _GatewaysResponse;

  factory GatewaysResponse.fromJson(Map<String, dynamic> json) =>
      _$GatewaysResponseFromJson(json);
}
