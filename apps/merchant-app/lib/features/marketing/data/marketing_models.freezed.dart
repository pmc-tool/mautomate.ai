// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'marketing_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

MarketingPostsSummary _$MarketingPostsSummaryFromJson(
    Map<String, dynamic> json) {
  return _MarketingPostsSummary.fromJson(json);
}

/// @nodoc
mixin _$MarketingPostsSummary {
  int get total => throw _privateConstructorUsedError;
  @JsonKey(name: "by_status")
  Map<String, int> get byStatus => throw _privateConstructorUsedError;

  /// Serializes this MarketingPostsSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingPostsSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingPostsSummaryCopyWith<MarketingPostsSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingPostsSummaryCopyWith<$Res> {
  factory $MarketingPostsSummaryCopyWith(MarketingPostsSummary value,
          $Res Function(MarketingPostsSummary) then) =
      _$MarketingPostsSummaryCopyWithImpl<$Res, MarketingPostsSummary>;
  @useResult
  $Res call({int total, @JsonKey(name: "by_status") Map<String, int> byStatus});
}

/// @nodoc
class _$MarketingPostsSummaryCopyWithImpl<$Res,
        $Val extends MarketingPostsSummary>
    implements $MarketingPostsSummaryCopyWith<$Res> {
  _$MarketingPostsSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingPostsSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? byStatus = null,
  }) {
    return _then(_value.copyWith(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      byStatus: null == byStatus
          ? _value.byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, int>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MarketingPostsSummaryImplCopyWith<$Res>
    implements $MarketingPostsSummaryCopyWith<$Res> {
  factory _$$MarketingPostsSummaryImplCopyWith(
          _$MarketingPostsSummaryImpl value,
          $Res Function(_$MarketingPostsSummaryImpl) then) =
      __$$MarketingPostsSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int total, @JsonKey(name: "by_status") Map<String, int> byStatus});
}

/// @nodoc
class __$$MarketingPostsSummaryImplCopyWithImpl<$Res>
    extends _$MarketingPostsSummaryCopyWithImpl<$Res,
        _$MarketingPostsSummaryImpl>
    implements _$$MarketingPostsSummaryImplCopyWith<$Res> {
  __$$MarketingPostsSummaryImplCopyWithImpl(_$MarketingPostsSummaryImpl _value,
      $Res Function(_$MarketingPostsSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingPostsSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? byStatus = null,
  }) {
    return _then(_$MarketingPostsSummaryImpl(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      byStatus: null == byStatus
          ? _value._byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, int>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingPostsSummaryImpl implements _MarketingPostsSummary {
  const _$MarketingPostsSummaryImpl(
      {this.total = 0,
      @JsonKey(name: "by_status")
      final Map<String, int> byStatus = const <String, int>{}})
      : _byStatus = byStatus;

  factory _$MarketingPostsSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingPostsSummaryImplFromJson(json);

  @override
  @JsonKey()
  final int total;
  final Map<String, int> _byStatus;
  @override
  @JsonKey(name: "by_status")
  Map<String, int> get byStatus {
    if (_byStatus is EqualUnmodifiableMapView) return _byStatus;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_byStatus);
  }

  @override
  String toString() {
    return 'MarketingPostsSummary(total: $total, byStatus: $byStatus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingPostsSummaryImpl &&
            (identical(other.total, total) || other.total == total) &&
            const DeepCollectionEquality().equals(other._byStatus, _byStatus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, total, const DeepCollectionEquality().hash(_byStatus));

  /// Create a copy of MarketingPostsSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingPostsSummaryImplCopyWith<_$MarketingPostsSummaryImpl>
      get copyWith => __$$MarketingPostsSummaryImplCopyWithImpl<
          _$MarketingPostsSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingPostsSummaryImplToJson(
      this,
    );
  }
}

abstract class _MarketingPostsSummary implements MarketingPostsSummary {
  const factory _MarketingPostsSummary(
          {final int total,
          @JsonKey(name: "by_status") final Map<String, int> byStatus}) =
      _$MarketingPostsSummaryImpl;

  factory _MarketingPostsSummary.fromJson(Map<String, dynamic> json) =
      _$MarketingPostsSummaryImpl.fromJson;

  @override
  int get total;
  @override
  @JsonKey(name: "by_status")
  Map<String, int> get byStatus;

  /// Create a copy of MarketingPostsSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingPostsSummaryImplCopyWith<_$MarketingPostsSummaryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

MarketingSummary _$MarketingSummaryFromJson(Map<String, dynamic> json) {
  return _MarketingSummary.fromJson(json);
}

/// @nodoc
mixin _$MarketingSummary {
  MarketingPostsSummary? get posts => throw _privateConstructorUsedError;
  @JsonKey(name: "scheduled_next_7d")
  int get scheduledNext7d => throw _privateConstructorUsedError;
  @JsonKey(name: "brand_voice_count")
  int get brandVoiceCount => throw _privateConstructorUsedError;
  @JsonKey(name: "connected_accounts_count")
  int get connectedAccountsCount => throw _privateConstructorUsedError;
  @JsonKey(name: "recent_conversations_count")
  int get recentConversationsCount => throw _privateConstructorUsedError;

  /// Serializes this MarketingSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingSummaryCopyWith<MarketingSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingSummaryCopyWith<$Res> {
  factory $MarketingSummaryCopyWith(
          MarketingSummary value, $Res Function(MarketingSummary) then) =
      _$MarketingSummaryCopyWithImpl<$Res, MarketingSummary>;
  @useResult
  $Res call(
      {MarketingPostsSummary? posts,
      @JsonKey(name: "scheduled_next_7d") int scheduledNext7d,
      @JsonKey(name: "brand_voice_count") int brandVoiceCount,
      @JsonKey(name: "connected_accounts_count") int connectedAccountsCount,
      @JsonKey(name: "recent_conversations_count")
      int recentConversationsCount});

  $MarketingPostsSummaryCopyWith<$Res>? get posts;
}

/// @nodoc
class _$MarketingSummaryCopyWithImpl<$Res, $Val extends MarketingSummary>
    implements $MarketingSummaryCopyWith<$Res> {
  _$MarketingSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? posts = freezed,
    Object? scheduledNext7d = null,
    Object? brandVoiceCount = null,
    Object? connectedAccountsCount = null,
    Object? recentConversationsCount = null,
  }) {
    return _then(_value.copyWith(
      posts: freezed == posts
          ? _value.posts
          : posts // ignore: cast_nullable_to_non_nullable
              as MarketingPostsSummary?,
      scheduledNext7d: null == scheduledNext7d
          ? _value.scheduledNext7d
          : scheduledNext7d // ignore: cast_nullable_to_non_nullable
              as int,
      brandVoiceCount: null == brandVoiceCount
          ? _value.brandVoiceCount
          : brandVoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      connectedAccountsCount: null == connectedAccountsCount
          ? _value.connectedAccountsCount
          : connectedAccountsCount // ignore: cast_nullable_to_non_nullable
              as int,
      recentConversationsCount: null == recentConversationsCount
          ? _value.recentConversationsCount
          : recentConversationsCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $MarketingPostsSummaryCopyWith<$Res>? get posts {
    if (_value.posts == null) {
      return null;
    }

    return $MarketingPostsSummaryCopyWith<$Res>(_value.posts!, (value) {
      return _then(_value.copyWith(posts: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$MarketingSummaryImplCopyWith<$Res>
    implements $MarketingSummaryCopyWith<$Res> {
  factory _$$MarketingSummaryImplCopyWith(_$MarketingSummaryImpl value,
          $Res Function(_$MarketingSummaryImpl) then) =
      __$$MarketingSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {MarketingPostsSummary? posts,
      @JsonKey(name: "scheduled_next_7d") int scheduledNext7d,
      @JsonKey(name: "brand_voice_count") int brandVoiceCount,
      @JsonKey(name: "connected_accounts_count") int connectedAccountsCount,
      @JsonKey(name: "recent_conversations_count")
      int recentConversationsCount});

  @override
  $MarketingPostsSummaryCopyWith<$Res>? get posts;
}

/// @nodoc
class __$$MarketingSummaryImplCopyWithImpl<$Res>
    extends _$MarketingSummaryCopyWithImpl<$Res, _$MarketingSummaryImpl>
    implements _$$MarketingSummaryImplCopyWith<$Res> {
  __$$MarketingSummaryImplCopyWithImpl(_$MarketingSummaryImpl _value,
      $Res Function(_$MarketingSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? posts = freezed,
    Object? scheduledNext7d = null,
    Object? brandVoiceCount = null,
    Object? connectedAccountsCount = null,
    Object? recentConversationsCount = null,
  }) {
    return _then(_$MarketingSummaryImpl(
      posts: freezed == posts
          ? _value.posts
          : posts // ignore: cast_nullable_to_non_nullable
              as MarketingPostsSummary?,
      scheduledNext7d: null == scheduledNext7d
          ? _value.scheduledNext7d
          : scheduledNext7d // ignore: cast_nullable_to_non_nullable
              as int,
      brandVoiceCount: null == brandVoiceCount
          ? _value.brandVoiceCount
          : brandVoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      connectedAccountsCount: null == connectedAccountsCount
          ? _value.connectedAccountsCount
          : connectedAccountsCount // ignore: cast_nullable_to_non_nullable
              as int,
      recentConversationsCount: null == recentConversationsCount
          ? _value.recentConversationsCount
          : recentConversationsCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingSummaryImpl implements _MarketingSummary {
  const _$MarketingSummaryImpl(
      {this.posts,
      @JsonKey(name: "scheduled_next_7d") this.scheduledNext7d = 0,
      @JsonKey(name: "brand_voice_count") this.brandVoiceCount = 0,
      @JsonKey(name: "connected_accounts_count")
      this.connectedAccountsCount = 0,
      @JsonKey(name: "recent_conversations_count")
      this.recentConversationsCount = 0});

  factory _$MarketingSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingSummaryImplFromJson(json);

  @override
  final MarketingPostsSummary? posts;
  @override
  @JsonKey(name: "scheduled_next_7d")
  final int scheduledNext7d;
  @override
  @JsonKey(name: "brand_voice_count")
  final int brandVoiceCount;
  @override
  @JsonKey(name: "connected_accounts_count")
  final int connectedAccountsCount;
  @override
  @JsonKey(name: "recent_conversations_count")
  final int recentConversationsCount;

  @override
  String toString() {
    return 'MarketingSummary(posts: $posts, scheduledNext7d: $scheduledNext7d, brandVoiceCount: $brandVoiceCount, connectedAccountsCount: $connectedAccountsCount, recentConversationsCount: $recentConversationsCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingSummaryImpl &&
            (identical(other.posts, posts) || other.posts == posts) &&
            (identical(other.scheduledNext7d, scheduledNext7d) ||
                other.scheduledNext7d == scheduledNext7d) &&
            (identical(other.brandVoiceCount, brandVoiceCount) ||
                other.brandVoiceCount == brandVoiceCount) &&
            (identical(other.connectedAccountsCount, connectedAccountsCount) ||
                other.connectedAccountsCount == connectedAccountsCount) &&
            (identical(
                    other.recentConversationsCount, recentConversationsCount) ||
                other.recentConversationsCount == recentConversationsCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, posts, scheduledNext7d,
      brandVoiceCount, connectedAccountsCount, recentConversationsCount);

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingSummaryImplCopyWith<_$MarketingSummaryImpl> get copyWith =>
      __$$MarketingSummaryImplCopyWithImpl<_$MarketingSummaryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingSummaryImplToJson(
      this,
    );
  }
}

abstract class _MarketingSummary implements MarketingSummary {
  const factory _MarketingSummary(
      {final MarketingPostsSummary? posts,
      @JsonKey(name: "scheduled_next_7d") final int scheduledNext7d,
      @JsonKey(name: "brand_voice_count") final int brandVoiceCount,
      @JsonKey(name: "connected_accounts_count")
      final int connectedAccountsCount,
      @JsonKey(name: "recent_conversations_count")
      final int recentConversationsCount}) = _$MarketingSummaryImpl;

  factory _MarketingSummary.fromJson(Map<String, dynamic> json) =
      _$MarketingSummaryImpl.fromJson;

  @override
  MarketingPostsSummary? get posts;
  @override
  @JsonKey(name: "scheduled_next_7d")
  int get scheduledNext7d;
  @override
  @JsonKey(name: "brand_voice_count")
  int get brandVoiceCount;
  @override
  @JsonKey(name: "connected_accounts_count")
  int get connectedAccountsCount;
  @override
  @JsonKey(name: "recent_conversations_count")
  int get recentConversationsCount;

  /// Create a copy of MarketingSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingSummaryImplCopyWith<_$MarketingSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MarketingPostTarget _$MarketingPostTargetFromJson(Map<String, dynamic> json) {
  return _MarketingPostTarget.fromJson(json);
}

/// @nodoc
mixin _$MarketingPostTarget {
  String get id => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  @JsonKey(name: "social_account_id")
  String? get socialAccountId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "override_body")
  String? get overrideBody => throw _privateConstructorUsedError;
  @JsonKey(name: "override_hashtags")
  List<String>? get overrideHashtags => throw _privateConstructorUsedError;
  @JsonKey(name: "scheduled_at")
  String? get scheduledAt => throw _privateConstructorUsedError;
  @JsonKey(name: "published_at")
  String? get publishedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "external_url")
  String? get externalUrl => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;

  /// Serializes this MarketingPostTarget to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingPostTarget
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingPostTargetCopyWith<MarketingPostTarget> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingPostTargetCopyWith<$Res> {
  factory $MarketingPostTargetCopyWith(
          MarketingPostTarget value, $Res Function(MarketingPostTarget) then) =
      _$MarketingPostTargetCopyWithImpl<$Res, MarketingPostTarget>;
  @useResult
  $Res call(
      {String id,
      String platform,
      @JsonKey(name: "social_account_id") String? socialAccountId,
      String status,
      @JsonKey(name: "override_body") String? overrideBody,
      @JsonKey(name: "override_hashtags") List<String>? overrideHashtags,
      @JsonKey(name: "scheduled_at") String? scheduledAt,
      @JsonKey(name: "published_at") String? publishedAt,
      @JsonKey(name: "external_url") String? externalUrl,
      String? error});
}

/// @nodoc
class _$MarketingPostTargetCopyWithImpl<$Res, $Val extends MarketingPostTarget>
    implements $MarketingPostTargetCopyWith<$Res> {
  _$MarketingPostTargetCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingPostTarget
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? socialAccountId = freezed,
    Object? status = null,
    Object? overrideBody = freezed,
    Object? overrideHashtags = freezed,
    Object? scheduledAt = freezed,
    Object? publishedAt = freezed,
    Object? externalUrl = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      socialAccountId: freezed == socialAccountId
          ? _value.socialAccountId
          : socialAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      overrideBody: freezed == overrideBody
          ? _value.overrideBody
          : overrideBody // ignore: cast_nullable_to_non_nullable
              as String?,
      overrideHashtags: freezed == overrideHashtags
          ? _value.overrideHashtags
          : overrideHashtags // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      scheduledAt: freezed == scheduledAt
          ? _value.scheduledAt
          : scheduledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      publishedAt: freezed == publishedAt
          ? _value.publishedAt
          : publishedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      externalUrl: freezed == externalUrl
          ? _value.externalUrl
          : externalUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MarketingPostTargetImplCopyWith<$Res>
    implements $MarketingPostTargetCopyWith<$Res> {
  factory _$$MarketingPostTargetImplCopyWith(_$MarketingPostTargetImpl value,
          $Res Function(_$MarketingPostTargetImpl) then) =
      __$$MarketingPostTargetImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String platform,
      @JsonKey(name: "social_account_id") String? socialAccountId,
      String status,
      @JsonKey(name: "override_body") String? overrideBody,
      @JsonKey(name: "override_hashtags") List<String>? overrideHashtags,
      @JsonKey(name: "scheduled_at") String? scheduledAt,
      @JsonKey(name: "published_at") String? publishedAt,
      @JsonKey(name: "external_url") String? externalUrl,
      String? error});
}

/// @nodoc
class __$$MarketingPostTargetImplCopyWithImpl<$Res>
    extends _$MarketingPostTargetCopyWithImpl<$Res, _$MarketingPostTargetImpl>
    implements _$$MarketingPostTargetImplCopyWith<$Res> {
  __$$MarketingPostTargetImplCopyWithImpl(_$MarketingPostTargetImpl _value,
      $Res Function(_$MarketingPostTargetImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingPostTarget
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? socialAccountId = freezed,
    Object? status = null,
    Object? overrideBody = freezed,
    Object? overrideHashtags = freezed,
    Object? scheduledAt = freezed,
    Object? publishedAt = freezed,
    Object? externalUrl = freezed,
    Object? error = freezed,
  }) {
    return _then(_$MarketingPostTargetImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      socialAccountId: freezed == socialAccountId
          ? _value.socialAccountId
          : socialAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      overrideBody: freezed == overrideBody
          ? _value.overrideBody
          : overrideBody // ignore: cast_nullable_to_non_nullable
              as String?,
      overrideHashtags: freezed == overrideHashtags
          ? _value._overrideHashtags
          : overrideHashtags // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      scheduledAt: freezed == scheduledAt
          ? _value.scheduledAt
          : scheduledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      publishedAt: freezed == publishedAt
          ? _value.publishedAt
          : publishedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      externalUrl: freezed == externalUrl
          ? _value.externalUrl
          : externalUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingPostTargetImpl implements _MarketingPostTarget {
  const _$MarketingPostTargetImpl(
      {this.id = "",
      this.platform = "",
      @JsonKey(name: "social_account_id") this.socialAccountId,
      this.status = "pending",
      @JsonKey(name: "override_body") this.overrideBody,
      @JsonKey(name: "override_hashtags") final List<String>? overrideHashtags,
      @JsonKey(name: "scheduled_at") this.scheduledAt,
      @JsonKey(name: "published_at") this.publishedAt,
      @JsonKey(name: "external_url") this.externalUrl,
      this.error})
      : _overrideHashtags = overrideHashtags;

  factory _$MarketingPostTargetImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingPostTargetImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey(name: "social_account_id")
  final String? socialAccountId;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "override_body")
  final String? overrideBody;
  final List<String>? _overrideHashtags;
  @override
  @JsonKey(name: "override_hashtags")
  List<String>? get overrideHashtags {
    final value = _overrideHashtags;
    if (value == null) return null;
    if (_overrideHashtags is EqualUnmodifiableListView)
      return _overrideHashtags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: "scheduled_at")
  final String? scheduledAt;
  @override
  @JsonKey(name: "published_at")
  final String? publishedAt;
  @override
  @JsonKey(name: "external_url")
  final String? externalUrl;
  @override
  final String? error;

  @override
  String toString() {
    return 'MarketingPostTarget(id: $id, platform: $platform, socialAccountId: $socialAccountId, status: $status, overrideBody: $overrideBody, overrideHashtags: $overrideHashtags, scheduledAt: $scheduledAt, publishedAt: $publishedAt, externalUrl: $externalUrl, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingPostTargetImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.socialAccountId, socialAccountId) ||
                other.socialAccountId == socialAccountId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.overrideBody, overrideBody) ||
                other.overrideBody == overrideBody) &&
            const DeepCollectionEquality()
                .equals(other._overrideHashtags, _overrideHashtags) &&
            (identical(other.scheduledAt, scheduledAt) ||
                other.scheduledAt == scheduledAt) &&
            (identical(other.publishedAt, publishedAt) ||
                other.publishedAt == publishedAt) &&
            (identical(other.externalUrl, externalUrl) ||
                other.externalUrl == externalUrl) &&
            (identical(other.error, error) || other.error == error));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      platform,
      socialAccountId,
      status,
      overrideBody,
      const DeepCollectionEquality().hash(_overrideHashtags),
      scheduledAt,
      publishedAt,
      externalUrl,
      error);

  /// Create a copy of MarketingPostTarget
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingPostTargetImplCopyWith<_$MarketingPostTargetImpl> get copyWith =>
      __$$MarketingPostTargetImplCopyWithImpl<_$MarketingPostTargetImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingPostTargetImplToJson(
      this,
    );
  }
}

abstract class _MarketingPostTarget implements MarketingPostTarget {
  const factory _MarketingPostTarget(
      {final String id,
      final String platform,
      @JsonKey(name: "social_account_id") final String? socialAccountId,
      final String status,
      @JsonKey(name: "override_body") final String? overrideBody,
      @JsonKey(name: "override_hashtags") final List<String>? overrideHashtags,
      @JsonKey(name: "scheduled_at") final String? scheduledAt,
      @JsonKey(name: "published_at") final String? publishedAt,
      @JsonKey(name: "external_url") final String? externalUrl,
      final String? error}) = _$MarketingPostTargetImpl;

  factory _MarketingPostTarget.fromJson(Map<String, dynamic> json) =
      _$MarketingPostTargetImpl.fromJson;

  @override
  String get id;
  @override
  String get platform;
  @override
  @JsonKey(name: "social_account_id")
  String? get socialAccountId;
  @override
  String get status;
  @override
  @JsonKey(name: "override_body")
  String? get overrideBody;
  @override
  @JsonKey(name: "override_hashtags")
  List<String>? get overrideHashtags;
  @override
  @JsonKey(name: "scheduled_at")
  String? get scheduledAt;
  @override
  @JsonKey(name: "published_at")
  String? get publishedAt;
  @override
  @JsonKey(name: "external_url")
  String? get externalUrl;
  @override
  String? get error;

  /// Create a copy of MarketingPostTarget
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingPostTargetImplCopyWith<_$MarketingPostTargetImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MarketingPostMedia _$MarketingPostMediaFromJson(Map<String, dynamic> json) {
  return _MarketingPostMedia.fromJson(json);
}

/// @nodoc
mixin _$MarketingPostMedia {
  String get id => throw _privateConstructorUsedError;
  String get kind => throw _privateConstructorUsedError;
  String? get url => throw _privateConstructorUsedError;
  String? get alt => throw _privateConstructorUsedError;
  int get position => throw _privateConstructorUsedError;

  /// Serializes this MarketingPostMedia to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingPostMedia
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingPostMediaCopyWith<MarketingPostMedia> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingPostMediaCopyWith<$Res> {
  factory $MarketingPostMediaCopyWith(
          MarketingPostMedia value, $Res Function(MarketingPostMedia) then) =
      _$MarketingPostMediaCopyWithImpl<$Res, MarketingPostMedia>;
  @useResult
  $Res call({String id, String kind, String? url, String? alt, int position});
}

/// @nodoc
class _$MarketingPostMediaCopyWithImpl<$Res, $Val extends MarketingPostMedia>
    implements $MarketingPostMediaCopyWith<$Res> {
  _$MarketingPostMediaCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingPostMedia
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? kind = null,
    Object? url = freezed,
    Object? alt = freezed,
    Object? position = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      kind: null == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String,
      url: freezed == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String?,
      alt: freezed == alt
          ? _value.alt
          : alt // ignore: cast_nullable_to_non_nullable
              as String?,
      position: null == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MarketingPostMediaImplCopyWith<$Res>
    implements $MarketingPostMediaCopyWith<$Res> {
  factory _$$MarketingPostMediaImplCopyWith(_$MarketingPostMediaImpl value,
          $Res Function(_$MarketingPostMediaImpl) then) =
      __$$MarketingPostMediaImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String kind, String? url, String? alt, int position});
}

/// @nodoc
class __$$MarketingPostMediaImplCopyWithImpl<$Res>
    extends _$MarketingPostMediaCopyWithImpl<$Res, _$MarketingPostMediaImpl>
    implements _$$MarketingPostMediaImplCopyWith<$Res> {
  __$$MarketingPostMediaImplCopyWithImpl(_$MarketingPostMediaImpl _value,
      $Res Function(_$MarketingPostMediaImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingPostMedia
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? kind = null,
    Object? url = freezed,
    Object? alt = freezed,
    Object? position = null,
  }) {
    return _then(_$MarketingPostMediaImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      kind: null == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String,
      url: freezed == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String?,
      alt: freezed == alt
          ? _value.alt
          : alt // ignore: cast_nullable_to_non_nullable
              as String?,
      position: null == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingPostMediaImpl implements _MarketingPostMedia {
  const _$MarketingPostMediaImpl(
      {this.id = "",
      this.kind = "image",
      this.url,
      this.alt,
      this.position = 0});

  factory _$MarketingPostMediaImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingPostMediaImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String kind;
  @override
  final String? url;
  @override
  final String? alt;
  @override
  @JsonKey()
  final int position;

  @override
  String toString() {
    return 'MarketingPostMedia(id: $id, kind: $kind, url: $url, alt: $alt, position: $position)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingPostMediaImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.kind, kind) || other.kind == kind) &&
            (identical(other.url, url) || other.url == url) &&
            (identical(other.alt, alt) || other.alt == alt) &&
            (identical(other.position, position) ||
                other.position == position));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, kind, url, alt, position);

  /// Create a copy of MarketingPostMedia
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingPostMediaImplCopyWith<_$MarketingPostMediaImpl> get copyWith =>
      __$$MarketingPostMediaImplCopyWithImpl<_$MarketingPostMediaImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingPostMediaImplToJson(
      this,
    );
  }
}

abstract class _MarketingPostMedia implements MarketingPostMedia {
  const factory _MarketingPostMedia(
      {final String id,
      final String kind,
      final String? url,
      final String? alt,
      final int position}) = _$MarketingPostMediaImpl;

  factory _MarketingPostMedia.fromJson(Map<String, dynamic> json) =
      _$MarketingPostMediaImpl.fromJson;

  @override
  String get id;
  @override
  String get kind;
  @override
  String? get url;
  @override
  String? get alt;
  @override
  int get position;

  /// Create a copy of MarketingPostMedia
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingPostMediaImplCopyWith<_$MarketingPostMediaImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MarketingPost _$MarketingPostFromJson(Map<String, dynamic> json) {
  return _MarketingPost.fromJson(json);
}

/// @nodoc
mixin _$MarketingPost {
  String get id => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get title => throw _privateConstructorUsedError;
  String? get body => throw _privateConstructorUsedError;
  String get source => throw _privateConstructorUsedError;
  List<String>? get hashtags => throw _privateConstructorUsedError;
  @JsonKey(name: "link_url")
  String? get linkUrl => throw _privateConstructorUsedError;
  @JsonKey(name: "campaign_id")
  String? get campaignId => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "updated_at")
  String get updatedAt => throw _privateConstructorUsedError;
  List<MarketingPostTarget>? get targets => throw _privateConstructorUsedError;
  List<MarketingPostMedia>? get media => throw _privateConstructorUsedError;

  /// Serializes this MarketingPost to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingPost
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingPostCopyWith<MarketingPost> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingPostCopyWith<$Res> {
  factory $MarketingPostCopyWith(
          MarketingPost value, $Res Function(MarketingPost) then) =
      _$MarketingPostCopyWithImpl<$Res, MarketingPost>;
  @useResult
  $Res call(
      {String id,
      String status,
      String? title,
      String? body,
      String source,
      List<String>? hashtags,
      @JsonKey(name: "link_url") String? linkUrl,
      @JsonKey(name: "campaign_id") String? campaignId,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "updated_at") String updatedAt,
      List<MarketingPostTarget>? targets,
      List<MarketingPostMedia>? media});
}

/// @nodoc
class _$MarketingPostCopyWithImpl<$Res, $Val extends MarketingPost>
    implements $MarketingPostCopyWith<$Res> {
  _$MarketingPostCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingPost
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? title = freezed,
    Object? body = freezed,
    Object? source = null,
    Object? hashtags = freezed,
    Object? linkUrl = freezed,
    Object? campaignId = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? targets = freezed,
    Object? media = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      title: freezed == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String?,
      body: freezed == body
          ? _value.body
          : body // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      hashtags: freezed == hashtags
          ? _value.hashtags
          : hashtags // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      campaignId: freezed == campaignId
          ? _value.campaignId
          : campaignId // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      targets: freezed == targets
          ? _value.targets
          : targets // ignore: cast_nullable_to_non_nullable
              as List<MarketingPostTarget>?,
      media: freezed == media
          ? _value.media
          : media // ignore: cast_nullable_to_non_nullable
              as List<MarketingPostMedia>?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MarketingPostImplCopyWith<$Res>
    implements $MarketingPostCopyWith<$Res> {
  factory _$$MarketingPostImplCopyWith(
          _$MarketingPostImpl value, $Res Function(_$MarketingPostImpl) then) =
      __$$MarketingPostImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String status,
      String? title,
      String? body,
      String source,
      List<String>? hashtags,
      @JsonKey(name: "link_url") String? linkUrl,
      @JsonKey(name: "campaign_id") String? campaignId,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "updated_at") String updatedAt,
      List<MarketingPostTarget>? targets,
      List<MarketingPostMedia>? media});
}

/// @nodoc
class __$$MarketingPostImplCopyWithImpl<$Res>
    extends _$MarketingPostCopyWithImpl<$Res, _$MarketingPostImpl>
    implements _$$MarketingPostImplCopyWith<$Res> {
  __$$MarketingPostImplCopyWithImpl(
      _$MarketingPostImpl _value, $Res Function(_$MarketingPostImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingPost
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? title = freezed,
    Object? body = freezed,
    Object? source = null,
    Object? hashtags = freezed,
    Object? linkUrl = freezed,
    Object? campaignId = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? targets = freezed,
    Object? media = freezed,
  }) {
    return _then(_$MarketingPostImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      title: freezed == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String?,
      body: freezed == body
          ? _value.body
          : body // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      hashtags: freezed == hashtags
          ? _value._hashtags
          : hashtags // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      campaignId: freezed == campaignId
          ? _value.campaignId
          : campaignId // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      targets: freezed == targets
          ? _value._targets
          : targets // ignore: cast_nullable_to_non_nullable
              as List<MarketingPostTarget>?,
      media: freezed == media
          ? _value._media
          : media // ignore: cast_nullable_to_non_nullable
              as List<MarketingPostMedia>?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingPostImpl implements _MarketingPost {
  const _$MarketingPostImpl(
      {this.id = "",
      this.status = "draft",
      this.title,
      this.body,
      this.source = "manual",
      final List<String>? hashtags,
      @JsonKey(name: "link_url") this.linkUrl,
      @JsonKey(name: "campaign_id") this.campaignId,
      @JsonKey(name: "created_at") this.createdAt = "",
      @JsonKey(name: "updated_at") this.updatedAt = "",
      final List<MarketingPostTarget>? targets,
      final List<MarketingPostMedia>? media})
      : _hashtags = hashtags,
        _targets = targets,
        _media = media;

  factory _$MarketingPostImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingPostImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String status;
  @override
  final String? title;
  @override
  final String? body;
  @override
  @JsonKey()
  final String source;
  final List<String>? _hashtags;
  @override
  List<String>? get hashtags {
    final value = _hashtags;
    if (value == null) return null;
    if (_hashtags is EqualUnmodifiableListView) return _hashtags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: "link_url")
  final String? linkUrl;
  @override
  @JsonKey(name: "campaign_id")
  final String? campaignId;
  @override
  @JsonKey(name: "created_at")
  final String createdAt;
  @override
  @JsonKey(name: "updated_at")
  final String updatedAt;
  final List<MarketingPostTarget>? _targets;
  @override
  List<MarketingPostTarget>? get targets {
    final value = _targets;
    if (value == null) return null;
    if (_targets is EqualUnmodifiableListView) return _targets;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  final List<MarketingPostMedia>? _media;
  @override
  List<MarketingPostMedia>? get media {
    final value = _media;
    if (value == null) return null;
    if (_media is EqualUnmodifiableListView) return _media;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'MarketingPost(id: $id, status: $status, title: $title, body: $body, source: $source, hashtags: $hashtags, linkUrl: $linkUrl, campaignId: $campaignId, createdAt: $createdAt, updatedAt: $updatedAt, targets: $targets, media: $media)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingPostImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.body, body) || other.body == body) &&
            (identical(other.source, source) || other.source == source) &&
            const DeepCollectionEquality().equals(other._hashtags, _hashtags) &&
            (identical(other.linkUrl, linkUrl) || other.linkUrl == linkUrl) &&
            (identical(other.campaignId, campaignId) ||
                other.campaignId == campaignId) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._targets, _targets) &&
            const DeepCollectionEquality().equals(other._media, _media));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      status,
      title,
      body,
      source,
      const DeepCollectionEquality().hash(_hashtags),
      linkUrl,
      campaignId,
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_targets),
      const DeepCollectionEquality().hash(_media));

  /// Create a copy of MarketingPost
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingPostImplCopyWith<_$MarketingPostImpl> get copyWith =>
      __$$MarketingPostImplCopyWithImpl<_$MarketingPostImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingPostImplToJson(
      this,
    );
  }
}

abstract class _MarketingPost implements MarketingPost {
  const factory _MarketingPost(
      {final String id,
      final String status,
      final String? title,
      final String? body,
      final String source,
      final List<String>? hashtags,
      @JsonKey(name: "link_url") final String? linkUrl,
      @JsonKey(name: "campaign_id") final String? campaignId,
      @JsonKey(name: "created_at") final String createdAt,
      @JsonKey(name: "updated_at") final String updatedAt,
      final List<MarketingPostTarget>? targets,
      final List<MarketingPostMedia>? media}) = _$MarketingPostImpl;

  factory _MarketingPost.fromJson(Map<String, dynamic> json) =
      _$MarketingPostImpl.fromJson;

  @override
  String get id;
  @override
  String get status;
  @override
  String? get title;
  @override
  String? get body;
  @override
  String get source;
  @override
  List<String>? get hashtags;
  @override
  @JsonKey(name: "link_url")
  String? get linkUrl;
  @override
  @JsonKey(name: "campaign_id")
  String? get campaignId;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;
  @override
  @JsonKey(name: "updated_at")
  String get updatedAt;
  @override
  List<MarketingPostTarget>? get targets;
  @override
  List<MarketingPostMedia>? get media;

  /// Create a copy of MarketingPost
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingPostImplCopyWith<_$MarketingPostImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SocialAccount _$SocialAccountFromJson(Map<String, dynamic> json) {
  return _SocialAccount.fromJson(json);
}

/// @nodoc
mixin _$SocialAccount {
  String get id => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  String? get handle => throw _privateConstructorUsedError;
  @JsonKey(name: "display_name")
  String? get displayName => throw _privateConstructorUsedError;
  @JsonKey(name: "avatar_url")
  String? get avatarUrl => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "connected_at")
  String? get connectedAt => throw _privateConstructorUsedError;

  /// Serializes this SocialAccount to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SocialAccount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SocialAccountCopyWith<SocialAccount> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SocialAccountCopyWith<$Res> {
  factory $SocialAccountCopyWith(
          SocialAccount value, $Res Function(SocialAccount) then) =
      _$SocialAccountCopyWithImpl<$Res, SocialAccount>;
  @useResult
  $Res call(
      {String id,
      String platform,
      String? handle,
      @JsonKey(name: "display_name") String? displayName,
      @JsonKey(name: "avatar_url") String? avatarUrl,
      String status,
      @JsonKey(name: "connected_at") String? connectedAt});
}

/// @nodoc
class _$SocialAccountCopyWithImpl<$Res, $Val extends SocialAccount>
    implements $SocialAccountCopyWith<$Res> {
  _$SocialAccountCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SocialAccount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? handle = freezed,
    Object? displayName = freezed,
    Object? avatarUrl = freezed,
    Object? status = null,
    Object? connectedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      handle: freezed == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String?,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      connectedAt: freezed == connectedAt
          ? _value.connectedAt
          : connectedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SocialAccountImplCopyWith<$Res>
    implements $SocialAccountCopyWith<$Res> {
  factory _$$SocialAccountImplCopyWith(
          _$SocialAccountImpl value, $Res Function(_$SocialAccountImpl) then) =
      __$$SocialAccountImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String platform,
      String? handle,
      @JsonKey(name: "display_name") String? displayName,
      @JsonKey(name: "avatar_url") String? avatarUrl,
      String status,
      @JsonKey(name: "connected_at") String? connectedAt});
}

/// @nodoc
class __$$SocialAccountImplCopyWithImpl<$Res>
    extends _$SocialAccountCopyWithImpl<$Res, _$SocialAccountImpl>
    implements _$$SocialAccountImplCopyWith<$Res> {
  __$$SocialAccountImplCopyWithImpl(
      _$SocialAccountImpl _value, $Res Function(_$SocialAccountImpl) _then)
      : super(_value, _then);

  /// Create a copy of SocialAccount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? handle = freezed,
    Object? displayName = freezed,
    Object? avatarUrl = freezed,
    Object? status = null,
    Object? connectedAt = freezed,
  }) {
    return _then(_$SocialAccountImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      handle: freezed == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String?,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      connectedAt: freezed == connectedAt
          ? _value.connectedAt
          : connectedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SocialAccountImpl implements _SocialAccount {
  const _$SocialAccountImpl(
      {this.id = "",
      this.platform = "",
      this.handle,
      @JsonKey(name: "display_name") this.displayName,
      @JsonKey(name: "avatar_url") this.avatarUrl,
      this.status = "connected",
      @JsonKey(name: "connected_at") this.connectedAt});

  factory _$SocialAccountImpl.fromJson(Map<String, dynamic> json) =>
      _$$SocialAccountImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String platform;
  @override
  final String? handle;
  @override
  @JsonKey(name: "display_name")
  final String? displayName;
  @override
  @JsonKey(name: "avatar_url")
  final String? avatarUrl;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "connected_at")
  final String? connectedAt;

  @override
  String toString() {
    return 'SocialAccount(id: $id, platform: $platform, handle: $handle, displayName: $displayName, avatarUrl: $avatarUrl, status: $status, connectedAt: $connectedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SocialAccountImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.handle, handle) || other.handle == handle) &&
            (identical(other.displayName, displayName) ||
                other.displayName == displayName) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.connectedAt, connectedAt) ||
                other.connectedAt == connectedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, platform, handle,
      displayName, avatarUrl, status, connectedAt);

  /// Create a copy of SocialAccount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SocialAccountImplCopyWith<_$SocialAccountImpl> get copyWith =>
      __$$SocialAccountImplCopyWithImpl<_$SocialAccountImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SocialAccountImplToJson(
      this,
    );
  }
}

abstract class _SocialAccount implements SocialAccount {
  const factory _SocialAccount(
          {final String id,
          final String platform,
          final String? handle,
          @JsonKey(name: "display_name") final String? displayName,
          @JsonKey(name: "avatar_url") final String? avatarUrl,
          final String status,
          @JsonKey(name: "connected_at") final String? connectedAt}) =
      _$SocialAccountImpl;

  factory _SocialAccount.fromJson(Map<String, dynamic> json) =
      _$SocialAccountImpl.fromJson;

  @override
  String get id;
  @override
  String get platform;
  @override
  String? get handle;
  @override
  @JsonKey(name: "display_name")
  String? get displayName;
  @override
  @JsonKey(name: "avatar_url")
  String? get avatarUrl;
  @override
  String get status;
  @override
  @JsonKey(name: "connected_at")
  String? get connectedAt;

  /// Create a copy of SocialAccount
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SocialAccountImplCopyWith<_$SocialAccountImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SocialProvider _$SocialProviderFromJson(Map<String, dynamic> json) {
  return _SocialProvider.fromJson(json);
}

/// @nodoc
mixin _$SocialProvider {
  String get platform => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  bool get configured => throw _privateConstructorUsedError;
  String get connect => throw _privateConstructorUsedError;
  bool get connected => throw _privateConstructorUsedError;

  /// Serializes this SocialProvider to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SocialProvider
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SocialProviderCopyWith<SocialProvider> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SocialProviderCopyWith<$Res> {
  factory $SocialProviderCopyWith(
          SocialProvider value, $Res Function(SocialProvider) then) =
      _$SocialProviderCopyWithImpl<$Res, SocialProvider>;
  @useResult
  $Res call(
      {String platform,
      String label,
      bool configured,
      String connect,
      bool connected});
}

/// @nodoc
class _$SocialProviderCopyWithImpl<$Res, $Val extends SocialProvider>
    implements $SocialProviderCopyWith<$Res> {
  _$SocialProviderCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SocialProvider
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? label = null,
    Object? configured = null,
    Object? connect = null,
    Object? connected = null,
  }) {
    return _then(_value.copyWith(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      connect: null == connect
          ? _value.connect
          : connect // ignore: cast_nullable_to_non_nullable
              as String,
      connected: null == connected
          ? _value.connected
          : connected // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SocialProviderImplCopyWith<$Res>
    implements $SocialProviderCopyWith<$Res> {
  factory _$$SocialProviderImplCopyWith(_$SocialProviderImpl value,
          $Res Function(_$SocialProviderImpl) then) =
      __$$SocialProviderImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String platform,
      String label,
      bool configured,
      String connect,
      bool connected});
}

/// @nodoc
class __$$SocialProviderImplCopyWithImpl<$Res>
    extends _$SocialProviderCopyWithImpl<$Res, _$SocialProviderImpl>
    implements _$$SocialProviderImplCopyWith<$Res> {
  __$$SocialProviderImplCopyWithImpl(
      _$SocialProviderImpl _value, $Res Function(_$SocialProviderImpl) _then)
      : super(_value, _then);

  /// Create a copy of SocialProvider
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? label = null,
    Object? configured = null,
    Object? connect = null,
    Object? connected = null,
  }) {
    return _then(_$SocialProviderImpl(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      connect: null == connect
          ? _value.connect
          : connect // ignore: cast_nullable_to_non_nullable
              as String,
      connected: null == connected
          ? _value.connected
          : connected // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SocialProviderImpl implements _SocialProvider {
  const _$SocialProviderImpl(
      {this.platform = "",
      this.label = "",
      this.configured = false,
      this.connect = "oauth",
      this.connected = false});

  factory _$SocialProviderImpl.fromJson(Map<String, dynamic> json) =>
      _$$SocialProviderImplFromJson(json);

  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final bool configured;
  @override
  @JsonKey()
  final String connect;
  @override
  @JsonKey()
  final bool connected;

  @override
  String toString() {
    return 'SocialProvider(platform: $platform, label: $label, configured: $configured, connect: $connect, connected: $connected)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SocialProviderImpl &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.configured, configured) ||
                other.configured == configured) &&
            (identical(other.connect, connect) || other.connect == connect) &&
            (identical(other.connected, connected) ||
                other.connected == connected));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, platform, label, configured, connect, connected);

  /// Create a copy of SocialProvider
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SocialProviderImplCopyWith<_$SocialProviderImpl> get copyWith =>
      __$$SocialProviderImplCopyWithImpl<_$SocialProviderImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SocialProviderImplToJson(
      this,
    );
  }
}

abstract class _SocialProvider implements SocialProvider {
  const factory _SocialProvider(
      {final String platform,
      final String label,
      final bool configured,
      final String connect,
      final bool connected}) = _$SocialProviderImpl;

  factory _SocialProvider.fromJson(Map<String, dynamic> json) =
      _$SocialProviderImpl.fromJson;

  @override
  String get platform;
  @override
  String get label;
  @override
  bool get configured;
  @override
  String get connect;
  @override
  bool get connected;

  /// Create a copy of SocialProvider
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SocialProviderImplCopyWith<_$SocialProviderImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MarketingCampaign _$MarketingCampaignFromJson(Map<String, dynamic> json) {
  return _MarketingCampaign.fromJson(json);
}

/// @nodoc
mixin _$MarketingCampaign {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get objective => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "starts_at")
  String? get startsAt => throw _privateConstructorUsedError;
  @JsonKey(name: "ends_at")
  String? get endsAt => throw _privateConstructorUsedError;
  @JsonKey(name: "product_ids")
  List<String>? get productIds => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "updated_at")
  String get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this MarketingCampaign to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MarketingCampaign
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MarketingCampaignCopyWith<MarketingCampaign> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MarketingCampaignCopyWith<$Res> {
  factory $MarketingCampaignCopyWith(
          MarketingCampaign value, $Res Function(MarketingCampaign) then) =
      _$MarketingCampaignCopyWithImpl<$Res, MarketingCampaign>;
  @useResult
  $Res call(
      {String id,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "starts_at") String? startsAt,
      @JsonKey(name: "ends_at") String? endsAt,
      @JsonKey(name: "product_ids") List<String>? productIds,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "updated_at") String updatedAt});
}

/// @nodoc
class _$MarketingCampaignCopyWithImpl<$Res, $Val extends MarketingCampaign>
    implements $MarketingCampaignCopyWith<$Res> {
  _$MarketingCampaignCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MarketingCampaign
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? startsAt = freezed,
    Object? endsAt = freezed,
    Object? productIds = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      startsAt: freezed == startsAt
          ? _value.startsAt
          : startsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      endsAt: freezed == endsAt
          ? _value.endsAt
          : endsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      productIds: freezed == productIds
          ? _value.productIds
          : productIds // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MarketingCampaignImplCopyWith<$Res>
    implements $MarketingCampaignCopyWith<$Res> {
  factory _$$MarketingCampaignImplCopyWith(_$MarketingCampaignImpl value,
          $Res Function(_$MarketingCampaignImpl) then) =
      __$$MarketingCampaignImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "starts_at") String? startsAt,
      @JsonKey(name: "ends_at") String? endsAt,
      @JsonKey(name: "product_ids") List<String>? productIds,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "updated_at") String updatedAt});
}

/// @nodoc
class __$$MarketingCampaignImplCopyWithImpl<$Res>
    extends _$MarketingCampaignCopyWithImpl<$Res, _$MarketingCampaignImpl>
    implements _$$MarketingCampaignImplCopyWith<$Res> {
  __$$MarketingCampaignImplCopyWithImpl(_$MarketingCampaignImpl _value,
      $Res Function(_$MarketingCampaignImpl) _then)
      : super(_value, _then);

  /// Create a copy of MarketingCampaign
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? startsAt = freezed,
    Object? endsAt = freezed,
    Object? productIds = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$MarketingCampaignImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      startsAt: freezed == startsAt
          ? _value.startsAt
          : startsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      endsAt: freezed == endsAt
          ? _value.endsAt
          : endsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      productIds: freezed == productIds
          ? _value._productIds
          : productIds // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MarketingCampaignImpl implements _MarketingCampaign {
  const _$MarketingCampaignImpl(
      {this.id = "",
      this.name = "",
      this.objective,
      this.status = "draft",
      @JsonKey(name: "starts_at") this.startsAt,
      @JsonKey(name: "ends_at") this.endsAt,
      @JsonKey(name: "product_ids") final List<String>? productIds,
      @JsonKey(name: "created_at") this.createdAt = "",
      @JsonKey(name: "updated_at") this.updatedAt = ""})
      : _productIds = productIds;

  factory _$MarketingCampaignImpl.fromJson(Map<String, dynamic> json) =>
      _$$MarketingCampaignImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String name;
  @override
  final String? objective;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "starts_at")
  final String? startsAt;
  @override
  @JsonKey(name: "ends_at")
  final String? endsAt;
  final List<String>? _productIds;
  @override
  @JsonKey(name: "product_ids")
  List<String>? get productIds {
    final value = _productIds;
    if (value == null) return null;
    if (_productIds is EqualUnmodifiableListView) return _productIds;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: "created_at")
  final String createdAt;
  @override
  @JsonKey(name: "updated_at")
  final String updatedAt;

  @override
  String toString() {
    return 'MarketingCampaign(id: $id, name: $name, objective: $objective, status: $status, startsAt: $startsAt, endsAt: $endsAt, productIds: $productIds, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MarketingCampaignImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.objective, objective) ||
                other.objective == objective) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.startsAt, startsAt) ||
                other.startsAt == startsAt) &&
            (identical(other.endsAt, endsAt) || other.endsAt == endsAt) &&
            const DeepCollectionEquality()
                .equals(other._productIds, _productIds) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      name,
      objective,
      status,
      startsAt,
      endsAt,
      const DeepCollectionEquality().hash(_productIds),
      createdAt,
      updatedAt);

  /// Create a copy of MarketingCampaign
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MarketingCampaignImplCopyWith<_$MarketingCampaignImpl> get copyWith =>
      __$$MarketingCampaignImplCopyWithImpl<_$MarketingCampaignImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MarketingCampaignImplToJson(
      this,
    );
  }
}

abstract class _MarketingCampaign implements MarketingCampaign {
  const factory _MarketingCampaign(
          {final String id,
          final String name,
          final String? objective,
          final String status,
          @JsonKey(name: "starts_at") final String? startsAt,
          @JsonKey(name: "ends_at") final String? endsAt,
          @JsonKey(name: "product_ids") final List<String>? productIds,
          @JsonKey(name: "created_at") final String createdAt,
          @JsonKey(name: "updated_at") final String updatedAt}) =
      _$MarketingCampaignImpl;

  factory _MarketingCampaign.fromJson(Map<String, dynamic> json) =
      _$MarketingCampaignImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get objective;
  @override
  String get status;
  @override
  @JsonKey(name: "starts_at")
  String? get startsAt;
  @override
  @JsonKey(name: "ends_at")
  String? get endsAt;
  @override
  @JsonKey(name: "product_ids")
  List<String>? get productIds;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;
  @override
  @JsonKey(name: "updated_at")
  String get updatedAt;

  /// Create a copy of MarketingCampaign
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MarketingCampaignImplCopyWith<_$MarketingCampaignImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
