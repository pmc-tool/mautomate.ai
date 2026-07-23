// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'domain_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DnsInstructionImpl _$$DnsInstructionImplFromJson(Map<String, dynamic> json) =>
    _$DnsInstructionImpl(
      kind: json['kind'] as String? ?? "note",
      name: json['name'] as String? ?? "",
      value: json['value'] as String? ?? "",
      ttl: (json['ttl'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$DnsInstructionImplToJson(
        _$DnsInstructionImpl instance) =>
    <String, dynamic>{
      'kind': instance.kind,
      'name': instance.name,
      'value': instance.value,
      'ttl': instance.ttl,
    };

_$DomainImpl _$$DomainImplFromJson(Map<String, dynamic> json) => _$DomainImpl(
      id: json['id'] as String,
      domain: json['domain'] as String? ?? "",
      type: json['type'] as String? ?? "custom",
      isPrimary: json['is_primary'] as bool? ?? false,
      sslStatus: json['ssl_status'] as String? ?? "",
      verificationStatus: json['verification_status'] as String? ?? "",
      instructions: (json['instructions'] as List<dynamic>?)
              ?.map((e) => DnsInstruction.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <DnsInstruction>[],
      registrarManaged: json['registrar_managed'] as bool? ?? false,
    );

Map<String, dynamic> _$$DomainImplToJson(_$DomainImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'domain': instance.domain,
      'type': instance.type,
      'is_primary': instance.isPrimary,
      'ssl_status': instance.sslStatus,
      'verification_status': instance.verificationStatus,
      'instructions': instance.instructions,
      'registrar_managed': instance.registrarManaged,
    };

_$DomainsResponseImpl _$$DomainsResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$DomainsResponseImpl(
      domains: (json['domains'] as List<dynamic>?)
              ?.map((e) => Domain.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <Domain>[],
    );

Map<String, dynamic> _$$DomainsResponseImplToJson(
        _$DomainsResponseImpl instance) =>
    <String, dynamic>{
      'domains': instance.domains,
    };

_$ConnectDomainResponseImpl _$$ConnectDomainResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$ConnectDomainResponseImpl(
      domainId: json['domain_id'] as String,
      domain: json['domain'] as String? ?? "",
      instructions: (json['instructions'] as List<dynamic>?)
              ?.map((e) => DnsInstruction.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <DnsInstruction>[],
      message: json['message'] as String? ?? "",
    );

Map<String, dynamic> _$$ConnectDomainResponseImplToJson(
        _$ConnectDomainResponseImpl instance) =>
    <String, dynamic>{
      'domain_id': instance.domainId,
      'domain': instance.domain,
      'instructions': instance.instructions,
      'message': instance.message,
    };

_$VerifyDomainResponseImpl _$$VerifyDomainResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$VerifyDomainResponseImpl(
      domainId: json['domain_id'] as String? ?? "",
      sslStatus: json['ssl_status'] as String? ?? "",
      verificationStatus: json['verification_status'] as String? ?? "",
      pending: json['pending'] as bool? ?? true,
    );

Map<String, dynamic> _$$VerifyDomainResponseImplToJson(
        _$VerifyDomainResponseImpl instance) =>
    <String, dynamic>{
      'domain_id': instance.domainId,
      'ssl_status': instance.sslStatus,
      'verification_status': instance.verificationStatus,
      'pending': instance.pending,
    };

_$DomainPriceImpl _$$DomainPriceImplFromJson(Map<String, dynamic> json) =>
    _$DomainPriceImpl(
      register: json['register'] as num? ?? 0,
      renew: json['renew'] as num? ?? 0,
      transfer: json['transfer'] as num? ?? 0,
      currency: json['currency'] as String? ?? "USD",
    );

Map<String, dynamic> _$$DomainPriceImplToJson(_$DomainPriceImpl instance) =>
    <String, dynamic>{
      'register': instance.register,
      'renew': instance.renew,
      'transfer': instance.transfer,
      'currency': instance.currency,
    };

_$DomainSearchResultImpl _$$DomainSearchResultImplFromJson(
        Map<String, dynamic> json) =>
    _$DomainSearchResultImpl(
      domain: json['domain'] as String? ?? "",
      tld: json['tld'] as String? ?? "",
      available: json['available'] as bool? ?? false,
      status: json['status'] as String? ?? "",
      isPremium: json['isPremium'] as bool? ?? false,
      price: json['price'] == null
          ? null
          : DomainPrice.fromJson(json['price'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DomainSearchResultImplToJson(
        _$DomainSearchResultImpl instance) =>
    <String, dynamic>{
      'domain': instance.domain,
      'tld': instance.tld,
      'available': instance.available,
      'status': instance.status,
      'isPremium': instance.isPremium,
      'price': instance.price,
    };

_$DomainSearchResponseImpl _$$DomainSearchResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$DomainSearchResponseImpl(
      query: json['query'] as String? ?? "",
      configured: json['configured'] as bool? ?? false,
      results: (json['results'] as List<dynamic>?)
              ?.map(
                  (e) => DomainSearchResult.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <DomainSearchResult>[],
      note: json['note'] as String?,
    );

Map<String, dynamic> _$$DomainSearchResponseImplToJson(
        _$DomainSearchResponseImpl instance) =>
    <String, dynamic>{
      'query': instance.query,
      'configured': instance.configured,
      'results': instance.results,
      'note': instance.note,
    };

_$DomainBuyResponseImpl _$$DomainBuyResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$DomainBuyResponseImpl(
      ok: json['ok'] as bool? ?? false,
      awaitingPayment: json['awaiting_payment'] as bool? ?? false,
      orderId: json['order_id'] as String?,
      domain: json['domain'] as String? ?? "",
      priceUsd: json['price_usd'] as num?,
      years: (json['years'] as num?)?.toInt() ?? 1,
      checkoutUrl: json['checkout_url'] as String?,
    );

Map<String, dynamic> _$$DomainBuyResponseImplToJson(
        _$DomainBuyResponseImpl instance) =>
    <String, dynamic>{
      'ok': instance.ok,
      'awaiting_payment': instance.awaitingPayment,
      'order_id': instance.orderId,
      'domain': instance.domain,
      'price_usd': instance.priceUsd,
      'years': instance.years,
      'checkout_url': instance.checkoutUrl,
    };

_$DnsRecordImpl _$$DnsRecordImplFromJson(Map<String, dynamic> json) =>
    _$DnsRecordImpl(
      id: json['id'] as String?,
      type: json['type'] as String? ?? "",
      host: json['host'] as String? ?? "",
      value: json['value'] as String? ?? "",
      ttl: (json['ttl'] as num?)?.toInt(),
      priority: (json['priority'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$DnsRecordImplToJson(_$DnsRecordImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'host': instance.host,
      'value': instance.value,
      'ttl': instance.ttl,
      'priority': instance.priority,
    };

_$DnsRecordsResponseImpl _$$DnsRecordsResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$DnsRecordsResponseImpl(
      records: (json['records'] as List<dynamic>?)
              ?.map((e) => DnsRecord.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <DnsRecord>[],
    );

Map<String, dynamic> _$$DnsRecordsResponseImplToJson(
        _$DnsRecordsResponseImpl instance) =>
    <String, dynamic>{
      'records': instance.records,
    };
