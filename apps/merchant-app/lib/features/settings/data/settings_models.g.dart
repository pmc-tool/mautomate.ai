// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$StoreProfileImpl _$$StoreProfileImplFromJson(Map<String, dynamic> json) =>
    _$StoreProfileImpl(
      name: json['name'] as String? ?? "",
      slug: json['slug'] as String? ?? "",
      domain: json['domain'] as String?,
      status: json['status'] as String? ?? "",
    );

Map<String, dynamic> _$$StoreProfileImplToJson(_$StoreProfileImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'slug': instance.slug,
      'domain': instance.domain,
      'status': instance.status,
    };

_$StoreCurrenciesImpl _$$StoreCurrenciesImplFromJson(
        Map<String, dynamic> json) =>
    _$StoreCurrenciesImpl(
      currencies: (json['currencies'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      defaultCurrency: json['default_currency'] as String? ?? "usd",
    );

Map<String, dynamic> _$$StoreCurrenciesImplToJson(
        _$StoreCurrenciesImpl instance) =>
    <String, dynamic>{
      'currencies': instance.currencies,
      'default_currency': instance.defaultCurrency,
    };

_$GatewayCredentialImpl _$$GatewayCredentialImplFromJson(
        Map<String, dynamic> json) =>
    _$GatewayCredentialImpl(
      key: json['key'] as String? ?? "",
      label: json['label'] as String? ?? "",
      secret: json['secret'] as bool? ?? false,
      optional: json['optional'] as bool? ?? false,
      isSet: json['is_set'] as bool?,
    );

Map<String, dynamic> _$$GatewayCredentialImplToJson(
        _$GatewayCredentialImpl instance) =>
    <String, dynamic>{
      'key': instance.key,
      'label': instance.label,
      'secret': instance.secret,
      'optional': instance.optional,
      'is_set': instance.isSet,
    };

_$PaymentGatewayImpl _$$PaymentGatewayImplFromJson(Map<String, dynamic> json) =>
    _$PaymentGatewayImpl(
      id: json['id'] as String? ?? "",
      providerId: json['provider_id'] as String? ?? "",
      name: json['name'] as String? ?? "",
      blurb: json['blurb'] as String? ?? "",
      countries: (json['countries'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      mode: json['mode'] as String? ?? "direct",
      configured: json['configured'] as bool? ?? false,
      enabled: json['enabled'] as bool? ?? false,
      enabledRegions: (json['enabled_regions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      credentials: (json['credentials'] as List<dynamic>?)
              ?.map(
                  (e) => GatewayCredential.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <GatewayCredential>[],
    );

Map<String, dynamic> _$$PaymentGatewayImplToJson(
        _$PaymentGatewayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'provider_id': instance.providerId,
      'name': instance.name,
      'blurb': instance.blurb,
      'countries': instance.countries,
      'mode': instance.mode,
      'configured': instance.configured,
      'enabled': instance.enabled,
      'enabled_regions': instance.enabledRegions,
      'credentials': instance.credentials,
    };

_$GatewaysResponseImpl _$$GatewaysResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$GatewaysResponseImpl(
      tenantCountry: json['tenant_country'] as String?,
      gateways: (json['gateways'] as List<dynamic>?)
              ?.map((e) => PaymentGateway.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <PaymentGateway>[],
    );

Map<String, dynamic> _$$GatewaysResponseImplToJson(
        _$GatewaysResponseImpl instance) =>
    <String, dynamic>{
      'tenant_country': instance.tenantCountry,
      'gateways': instance.gateways,
    };
