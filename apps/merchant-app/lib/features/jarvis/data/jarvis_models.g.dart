// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'jarvis_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$JarvisUndoImpl _$$JarvisUndoImplFromJson(Map<String, dynamic> json) =>
    _$JarvisUndoImpl(
      token: json['token'] as String,
      label: json['label'] as String? ?? "Undo",
    );

Map<String, dynamic> _$$JarvisUndoImplToJson(_$JarvisUndoImpl instance) =>
    <String, dynamic>{
      'token': instance.token,
      'label': instance.label,
    };

_$JarvisApplyResultImpl _$$JarvisApplyResultImplFromJson(
        Map<String, dynamic> json) =>
    _$JarvisApplyResultImpl(
      ok: json['ok'] as bool? ?? false,
      message: json['message'] as String?,
      undo: json['undo'] == null
          ? null
          : JarvisUndo.fromJson(json['undo'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$JarvisApplyResultImplToJson(
        _$JarvisApplyResultImpl instance) =>
    <String, dynamic>{
      'ok': instance.ok,
      'message': instance.message,
      'undo': instance.undo,
    };

_$JarvisConversationImpl _$$JarvisConversationImplFromJson(
        Map<String, dynamic> json) =>
    _$JarvisConversationImpl(
      id: json['id'] as String,
      title: json['title'] as String? ?? "New chat",
      updatedAt: json['updated_at'] as String?,
    );

Map<String, dynamic> _$$JarvisConversationImplToJson(
        _$JarvisConversationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'updated_at': instance.updatedAt,
    };

_$JarvisStoredMessageImpl _$$JarvisStoredMessageImplFromJson(
        Map<String, dynamic> json) =>
    _$JarvisStoredMessageImpl(
      role: json['role'] as String,
      content: json['content'] as String? ?? "",
      meta: json['meta'] as Map<String, dynamic>?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$$JarvisStoredMessageImplToJson(
        _$JarvisStoredMessageImpl instance) =>
    <String, dynamic>{
      'role': instance.role,
      'content': instance.content,
      'meta': instance.meta,
      'created_at': instance.createdAt,
    };

_$JarvisConversationDetailImpl _$$JarvisConversationDetailImplFromJson(
        Map<String, dynamic> json) =>
    _$JarvisConversationDetailImpl(
      id: json['id'] as String,
      title: json['title'] as String? ?? "New chat",
      messages: (json['messages'] as List<dynamic>?)
              ?.map((e) =>
                  JarvisStoredMessage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <JarvisStoredMessage>[],
    );

Map<String, dynamic> _$$JarvisConversationDetailImplToJson(
        _$JarvisConversationDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'messages': instance.messages,
    };
