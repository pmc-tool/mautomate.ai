// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setup_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SetupTaskImpl _$$SetupTaskImplFromJson(Map<String, dynamic> json) =>
    _$SetupTaskImpl(
      key: json['key'] as String? ?? "",
      label: json['label'] as String? ?? "",
      why: json['why'] as String? ?? "",
      required: json['required'] as bool? ?? false,
      done: json['done'] as bool? ?? false,
      ctaHref: json['cta_href'] as String? ?? "",
      blockerDetail: json['blocker_detail'] as String?,
    );

Map<String, dynamic> _$$SetupTaskImplToJson(_$SetupTaskImpl instance) =>
    <String, dynamic>{
      'key': instance.key,
      'label': instance.label,
      'why': instance.why,
      'required': instance.required,
      'done': instance.done,
      'cta_href': instance.ctaHref,
      'blocker_detail': instance.blockerDetail,
    };

_$SetupStatusImpl _$$SetupStatusImplFromJson(Map<String, dynamic> json) =>
    _$SetupStatusImpl(
      tasks: (json['tasks'] as List<dynamic>?)
              ?.map((e) => SetupTask.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <SetupTask>[],
      percent: json['percent'] == null ? 0 : _toInt(json['percent']),
      requiredPercent: json['required_percent'] == null
          ? 0
          : _toInt(json['required_percent']),
      readyToSell: json['ready_to_sell'] as bool? ?? false,
      missingRequired: (json['missing_required'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      shippingCountries: (json['shipping_countries'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      storeCountry: json['store_country'] as String? ?? "us",
      pendingDomain: json['pending_domain'] as String?,
      products: json['products'] as bool? ?? false,
      shipping: json['shipping'] as bool? ?? false,
      payment: json['payment'] as bool? ?? false,
      domain: json['domain'] as bool? ?? false,
    );

Map<String, dynamic> _$$SetupStatusImplToJson(_$SetupStatusImpl instance) =>
    <String, dynamic>{
      'tasks': instance.tasks,
      'percent': instance.percent,
      'required_percent': instance.requiredPercent,
      'ready_to_sell': instance.readyToSell,
      'missing_required': instance.missingRequired,
      'shipping_countries': instance.shippingCountries,
      'store_country': instance.storeCountry,
      'pending_domain': instance.pendingDomain,
      'products': instance.products,
      'shipping': instance.shipping,
      'payment': instance.payment,
      'domain': instance.domain,
    };

_$SetupDraftImpl _$$SetupDraftImplFromJson(Map<String, dynamic> json) =>
    _$SetupDraftImpl(
      currentStep: json['current_step'] as String?,
      completed: (json['completed'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      skipped: (json['skipped'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      answers:
          json['answers'] as Map<String, dynamic>? ?? const <String, dynamic>{},
      dismissed: json['dismissed'] as bool?,
      startedAt: json['started_at'] as String?,
      completedAt: json['completed_at'] as String?,
    );

Map<String, dynamic> _$$SetupDraftImplToJson(_$SetupDraftImpl instance) =>
    <String, dynamic>{
      if (instance.currentStep case final value?) 'current_step': value,
      'completed': instance.completed,
      'skipped': instance.skipped,
      'answers': instance.answers,
      if (instance.dismissed case final value?) 'dismissed': value,
      if (instance.startedAt case final value?) 'started_at': value,
      if (instance.completedAt case final value?) 'completed_at': value,
    };

_$SetupBusinessImpl _$$SetupBusinessImplFromJson(Map<String, dynamic> json) =>
    _$SetupBusinessImpl(
      type: json['type'] as String?,
      category: json['category'] as String?,
      description: json['description'] as String?,
    );

Map<String, dynamic> _$$SetupBusinessImplToJson(_$SetupBusinessImpl instance) =>
    <String, dynamic>{
      if (instance.type case final value?) 'type': value,
      if (instance.category case final value?) 'category': value,
      if (instance.description case final value?) 'description': value,
    };

_$SetupSnapshotImpl _$$SetupSnapshotImplFromJson(Map<String, dynamic> json) =>
    _$SetupSnapshotImpl(
      name: json['name'] as String? ?? "",
      defaultCountry: json['default_country'] as String?,
      currencyCode: json['currency_code'] as String? ?? "usd",
      supportedCurrencies: (json['supported_currencies'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      business: json['business'] == null
          ? const SetupBusiness()
          : SetupBusiness.fromJson(json['business'] as Map<String, dynamic>),
      logoUrl: json['logo_url'] as String?,
      setup: json['setup'] == null
          ? const SetupDraft()
          : SetupDraft.fromJson(json['setup'] as Map<String, dynamic>),
      status: json['status'] == null
          ? null
          : SetupStatus.fromJson(json['status'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SetupSnapshotImplToJson(_$SetupSnapshotImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'default_country': instance.defaultCountry,
      'currency_code': instance.currencyCode,
      'supported_currencies': instance.supportedCurrencies,
      'business': instance.business,
      'logo_url': instance.logoUrl,
      'setup': instance.setup,
      'status': instance.status,
    };
