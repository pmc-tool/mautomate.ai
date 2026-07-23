// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inbox_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$InboxContactImpl _$$InboxContactImplFromJson(Map<String, dynamic> json) =>
    _$InboxContactImpl(
      id: json['id'] as String? ?? "",
      displayName: json['display_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      customerId: json['customer_id'] as String?,
    );

Map<String, dynamic> _$$InboxContactImplToJson(_$InboxContactImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'display_name': instance.displayName,
      'avatar_url': instance.avatarUrl,
      'phone': instance.phone,
      'email': instance.email,
      'customer_id': instance.customerId,
    };

_$InboxConversationImpl _$$InboxConversationImplFromJson(
        Map<String, dynamic> json) =>
    _$InboxConversationImpl(
      id: json['id'] as String? ?? "",
      channel: json['channel'] as String? ?? "",
      status: json['status'] as String? ?? "open",
      handlerMode: json['handler_mode'] as String? ?? "ai",
      handoffReason: json['handoff_reason'] as String?,
      chatbotId: json['chatbot_id'] as String?,
      starred: json['starred'] as bool? ?? false,
      unreadCount:
          json['unread_count'] == null ? 0 : _toInt(json['unread_count']),
      lastMessageAt: json['last_message_at'] as String?,
      assignedUserId: json['assigned_user_id'] as String?,
      contact: json['contact'] == null
          ? null
          : InboxContact.fromJson(json['contact'] as Map<String, dynamic>),
      preview: json['preview'] as String?,
    );

Map<String, dynamic> _$$InboxConversationImplToJson(
        _$InboxConversationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'channel': instance.channel,
      'status': instance.status,
      'handler_mode': instance.handlerMode,
      'handoff_reason': instance.handoffReason,
      'chatbot_id': instance.chatbotId,
      'starred': instance.starred,
      'unread_count': instance.unreadCount,
      'last_message_at': instance.lastMessageAt,
      'assigned_user_id': instance.assignedUserId,
      'contact': instance.contact,
      'preview': instance.preview,
    };

_$InboxMessageImpl _$$InboxMessageImplFromJson(Map<String, dynamic> json) =>
    _$InboxMessageImpl(
      id: json['id'] as String? ?? "",
      direction: json['direction'] as String? ?? "",
      author: json['author'] as String? ?? "",
      body: json['body'] as String?,
      sentAt: json['sent_at'] as String?,
      deliveryStatus: json['delivery_status'] as String?,
    );

Map<String, dynamic> _$$InboxMessageImplToJson(_$InboxMessageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'direction': instance.direction,
      'author': instance.author,
      'body': instance.body,
      'sent_at': instance.sentAt,
      'delivery_status': instance.deliveryStatus,
    };

_$InboxViewCountsImpl _$$InboxViewCountsImplFromJson(
        Map<String, dynamic> json) =>
    _$InboxViewCountsImpl(
      needsYou: json['needs_you'] == null ? 0 : _toInt(json['needs_you']),
      unassigned: json['unassigned'] == null ? 0 : _toInt(json['unassigned']),
      mine: json['mine'] == null ? 0 : _toInt(json['mine']),
      starred: json['starred'] == null ? 0 : _toInt(json['starred']),
      open: json['open'] == null ? 0 : _toInt(json['open']),
      closed: json['closed'] == null ? 0 : _toInt(json['closed']),
      all: json['all'] == null ? 0 : _toInt(json['all']),
      unread: json['unread'] == null ? 0 : _toInt(json['unread']),
    );

Map<String, dynamic> _$$InboxViewCountsImplToJson(
        _$InboxViewCountsImpl instance) =>
    <String, dynamic>{
      'needs_you': instance.needsYou,
      'unassigned': instance.unassigned,
      'mine': instance.mine,
      'starred': instance.starred,
      'open': instance.open,
      'closed': instance.closed,
      'all': instance.all,
      'unread': instance.unread,
    };

_$InboxCountsImpl _$$InboxCountsImplFromJson(Map<String, dynamic> json) =>
    _$InboxCountsImpl(
      views: json['views'] == null
          ? const InboxViewCounts()
          : InboxViewCounts.fromJson(json['views'] as Map<String, dynamic>),
      channels: (json['channels'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, (e as num).toInt()),
          ) ??
          const <String, int>{},
    );

Map<String, dynamic> _$$InboxCountsImplToJson(_$InboxCountsImpl instance) =>
    <String, dynamic>{
      'views': instance.views,
      'channels': instance.channels,
    };
