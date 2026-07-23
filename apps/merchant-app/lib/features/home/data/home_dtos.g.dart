// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$HomeOrderImpl _$$HomeOrderImplFromJson(Map<String, dynamic> json) =>
    _$HomeOrderImpl(
      id: json['id'] as String? ?? "",
      displayId: (json['display_id'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? "",
      paymentStatus: json['payment_status'] as String?,
      fulfillmentStatus: json['fulfillment_status'] as String?,
      createdAt: json['created_at'] as String?,
      total: json['total'] as num? ?? 0,
      currencyCode: json['currency_code'] as String? ?? "USD",
      email: json['email'] as String?,
      customerName: json['customer_name'] as String?,
      itemCount: (json['item_count'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$HomeOrderImplToJson(_$HomeOrderImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'display_id': instance.displayId,
      'status': instance.status,
      'payment_status': instance.paymentStatus,
      'fulfillment_status': instance.fulfillmentStatus,
      'created_at': instance.createdAt,
      'total': instance.total,
      'currency_code': instance.currencyCode,
      'email': instance.email,
      'customer_name': instance.customerName,
      'item_count': instance.itemCount,
    };

_$HomeProductImpl _$$HomeProductImplFromJson(Map<String, dynamic> json) =>
    _$HomeProductImpl(
      id: json['id'] as String? ?? "",
      title: json['title'] as String? ?? "",
      status: json['status'] as String? ?? "",
      thumbnail: json['thumbnail'] as String?,
      currencyCode: json['currency_code'] as String?,
      price: json['price'] as num?,
      stock: json['stock'] as num?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$HomeProductImplToJson(_$HomeProductImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'status': instance.status,
      'thumbnail': instance.thumbnail,
      'currency_code': instance.currencyCode,
      'price': instance.price,
      'stock': instance.stock,
      'metadata': instance.metadata,
    };

_$SetupTaskDtoImpl _$$SetupTaskDtoImplFromJson(Map<String, dynamic> json) =>
    _$SetupTaskDtoImpl(
      key: json['key'] as String? ?? "",
      label: json['label'] as String? ?? "",
      why: json['why'] as String? ?? "",
      isRequired: json['required'] as bool? ?? false,
      done: json['done'] as bool? ?? false,
      blockerDetail: json['blocker_detail'] as String?,
    );

Map<String, dynamic> _$$SetupTaskDtoImplToJson(_$SetupTaskDtoImpl instance) =>
    <String, dynamic>{
      'key': instance.key,
      'label': instance.label,
      'why': instance.why,
      'required': instance.isRequired,
      'done': instance.done,
      'blocker_detail': instance.blockerDetail,
    };

_$SetupStatusDtoImpl _$$SetupStatusDtoImplFromJson(Map<String, dynamic> json) =>
    _$SetupStatusDtoImpl(
      tasks: (json['tasks'] as List<dynamic>?)
              ?.map((e) => SetupTaskDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <SetupTaskDto>[],
      percent: (json['percent'] as num?)?.toInt() ?? 0,
      readyToSell: json['ready_to_sell'] as bool? ?? true,
      missingRequired: (json['missing_required'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
    );

Map<String, dynamic> _$$SetupStatusDtoImplToJson(
        _$SetupStatusDtoImpl instance) =>
    <String, dynamic>{
      'tasks': instance.tasks,
      'percent': instance.percent,
      'ready_to_sell': instance.readyToSell,
      'missing_required': instance.missingRequired,
    };

_$InboxViewCountsImpl _$$InboxViewCountsImplFromJson(
        Map<String, dynamic> json) =>
    _$InboxViewCountsImpl(
      needsYou: (json['needs_you'] as num?)?.toInt() ?? 0,
      unread: (json['unread'] as num?)?.toInt() ?? 0,
      open: (json['open'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$InboxViewCountsImplToJson(
        _$InboxViewCountsImpl instance) =>
    <String, dynamic>{
      'needs_you': instance.needsYou,
      'unread': instance.unread,
      'open': instance.open,
    };

_$InboxCountsDtoImpl _$$InboxCountsDtoImplFromJson(Map<String, dynamic> json) =>
    _$InboxCountsDtoImpl(
      views: json['views'] == null
          ? const InboxViewCounts()
          : InboxViewCounts.fromJson(json['views'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$InboxCountsDtoImplToJson(
        _$InboxCountsDtoImpl instance) =>
    <String, dynamic>{
      'views': instance.views,
    };
